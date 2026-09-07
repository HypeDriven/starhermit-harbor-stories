/**
 * Harbor Stories — end-to-end QA playthrough (dev only, not shipped).
 *
 * Drives the real visible UI in headless Chrome through the full player flow:
 * title screen → Play (journey stage 1, "First Light Repairs") → hint button →
 * select/merge/deliver on the board until the win screen ("Harbor restored!")
 * → Play again. Runs twice: desktop 1280x800 and mobile 390x844 (touch).
 *
 * The game is deterministic (seeded rules engine in js/rules.js). The test
 * mirrors the game in Node with the same engine and uses Rules.hint() only to
 * DECIDE which visible cells to click — every action is performed through
 * page clicks on the real board buttons, exactly as a player would.
 *
 * Note: Harbor Stories is a single-screen merge puzzler. It has no
 * pause/resume or settings screens, so those are not applicable here; the
 * Hint button and Play-again flow are exercised instead.
 *
 * Run: npm run test:e2e
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The game scripts are UMD (browser global + CJS). Under "type": "module"
// they cannot be require()'d, so evaluate them against a shared root object.
const gameRoot = {};
for (const f of ['rng.js', 'content.js', 'rules.js']) {
  const src = readFileSync(path.join(ROOT, 'js', f), 'utf8');
  new Function('self', src).call(gameRoot, gameRoot);
}
const Rules = gameRoot.HSRules;
const Content = gameRoot.HSContent;

const browserNoise = /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL|EnableWebGLDeveloperExtensions/i;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.ts': 'video/mp2t',
};

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/' || p === '/index') p = '/index.html';
    if (p === '/favicon.ico') p = '/favicon.svg';
    const filePath = path.join(ROOT, p);
    if (!filePath.startsWith(ROOT)) throw new Error('bad path');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

const step = async (name, fn) => {
  await fn();
  console.log(`ok - ${name}`);
};

const cellSel = (r, c) => `button.hs-cell[data-r="${r}"][data-c="${c}"]`;

async function movesShown(page) {
  return Number(await page.locator('.hs-score b').first().textContent());
}

/** Play one full game of journey stage 1 through the visible UI. */
async function playthrough(page, tag) {
  const shot = (n) => `/tmp/harbor-stories-e2e-${n}-${tag}.png`;

  await step(`[${tag}] load + title visible`, async () => {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('#btn-start', { timeout: 10000 });
    const title = await page.textContent('.hs-title-name');
    if (!/Harbor Stories/.test(title)) throw new Error('title missing: ' + title);
    await page.screenshot({ path: shot('title') });
  });

  await step(`[${tag}] start journey stage 1`, async () => {
    await page.click('#btn-start');
    await page.waitForSelector('.hs-board', { timeout: 5000 });
    const cells = await page.locator('.hs-cell').count();
    if (cells !== 25) throw new Error(`expected 25 board cells, got ${cells}`);
    const tasks = await page.locator('.hs-tasks li').count();
    if (tasks !== 2) throw new Error(`expected 2 tasks, got ${tasks}`);
    if (await movesShown(page) !== 0) throw new Error('moves not 0 at start');
    await page.screenshot({ path: shot('board') });
  });

  await step(`[${tag}] hint button updates status line`, async () => {
    await page.click('#btn-hint');
    await page.waitForFunction(
      () => /^Hint:|^No legal action/.test(document.getElementById('hs-status').textContent),
      null, { timeout: 3000 }
    );
  });

  let mirror = Rules.createGame(Content.JOURNEY[0]);
  await step(`[${tag}] play to win via board clicks (merge/move/deliver)`, async () => {
    for (let i = 0; i < 200 && !mirror.terminal; i++) {
      const h = Rules.hint(mirror);
      if (!h) throw new Error('rules engine reports no legal action but game not terminal');
      const expectedMoves = mirror.moves + 1;
      if (h.type === 'deliver') {
        await page.click(cellSel(h.at.r, h.at.c)); // select the requested tool
        await page.waitForSelector(`${cellSel(h.at.r, h.at.c)}.selected`);
        await page.click('#btn-deliver');
      } else {
        await page.click(cellSel(h.from.r, h.from.c)); // select source
        await page.waitForSelector(`${cellSel(h.from.r, h.from.c)}.selected`);
        await page.click(cellSel(h.to.r, h.to.c)); // destination: move or merge
      }
      // Apply the same command to the Node mirror and confirm the visible UI agrees.
      const cmd = h.type === 'deliver'
        ? { type: 'deliver', at: h.at }
        : { type: h.type, from: h.from, to: h.to };
      const res = Rules.applyCommand(mirror, cmd);
      if (!res.ok) throw new Error(`mirror rejected hint action: ${res.reason}`);
      mirror = res.state;
      await page.waitForFunction(
        (n) => Number(document.querySelector('.hs-score b').textContent) === n,
        expectedMoves, { timeout: 3000 }
      );
      if (i === 0) await page.screenshot({ path: shot('play') });
    }
    if (!mirror.terminal) throw new Error('game did not reach a terminal state within 200 moves');
    console.log(`  [${tag}] terminal: ${mirror.terminal.reason}, moves: ${mirror.moves}, score: ${mirror.score.total}`);
  });

  await step(`[${tag}] win screen shows result`, async () => {
    if (!mirror.terminal.won) throw new Error('expected a win, got: ' + mirror.terminal.reason);
    await page.waitForSelector('.hs-terminal', { timeout: 5000 });
    const headline = await page.textContent('.hs-terminal h2');
    if (!/Harbor restored!/.test(headline)) throw new Error('unexpected terminal headline: ' + headline);
    const scoreLine = await page.textContent('.hs-terminal p');
    const uiScore = Number((scoreLine.match(/Score (\d+)/) || [])[1]);
    // The UI adds a real-time par bonus on top of the deterministic mirror
    // score, so only require it to be present and at least the mirror total.
    if (!Number.isFinite(uiScore) || uiScore < mirror.score.total) {
      throw new Error(`score mismatch: UI "${scoreLine}" vs mirror ${mirror.score.total}`);
    }
    await page.screenshot({ path: shot('results') });
  });

  await step(`[${tag}] play again restarts a fresh board`, async () => {
    await page.click('#btn-again');
    await page.waitForSelector('.hs-board', { timeout: 5000 });
    if (await page.locator('.hs-terminal').count() !== 0) throw new Error('terminal dialog still visible');
    if (await movesShown(page) !== 0) throw new Error('moves not reset after play again');
    const cells = await page.locator('.hs-cell').count();
    if (cells !== 25) throw new Error(`expected 25 board cells after replay, got ${cells}`);
    await page.screenshot({ path: shot('replay') });
  });
}

const allErrors = [];
let browser;
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}`;

  browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });

  for (const pass of [
    { tag: 'desktop', viewport: { width: 1280, height: 800 }, hasTouch: false },
    { tag: 'mobile', viewport: { width: 390, height: 844 }, hasTouch: true },
  ]) {
    const context = await browser.newContext({ viewport: pass.viewport, hasTouch: pass.hasTouch, baseURL });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !browserNoise.test(m.text())) errors.push(`console: ${m.text()}`);
    });
    try {
      await playthrough(page, pass.tag);
    } catch (err) {
      if (errors.length) console.error(`page errors during ${pass.tag} pass:\n` + errors.join('\n'));
      throw err;
    } finally {
      await context.close();
    }
    if (errors.length) {
      allErrors.push(...errors.map((e) => `[${pass.tag}] ${e}`));
      throw new Error(`page errors during ${pass.tag} pass:\n` + errors.join('\n'));
    }
    console.log(`ok - [${pass.tag}] pass clean (no page errors)`);
  }

  if (allErrors.length) throw new Error('page errors:\n' + allErrors.join('\n'));
  console.log('\nE2E PASS — harbor-stories completed on desktop and mobile, no page errors');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
