// Graphics benchmark hook for tools/gfx-bench.mjs (dev-only): picks a preset in Settings → Graphics,
// then plays Journey stage 1 through visible board clicks (select → move/merge, Deliver), following the
// rules engine's own hint on a Node mirror like tests/e2e.mjs — merge and delivery sparks, the animated
// harbor backdrop, embers and the board re-render all run — and presses Play again after each win.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const presets = ['low', 'balanced', 'high', 'ultra'];
export const levels = { low: 0, balanced: 4, high: 10, ultra: 17 };

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gameRoot = {};
for (const f of ['rng.js', 'content.js', 'rules.js']) new Function('self', readFileSync(path.join(ROOT, 'js', f), 'utf8')).call(gameRoot, gameRoot);
const Rules = gameRoot.HSRules;
const Content = gameRoot.HSContent;
const cell = (p) => `button.hs-cell[data-r="${p.r}"][data-c="${p.c}"]`;

export async function setPreset(page, preset) {
  await page.waitForSelector('#btn-start', { timeout: 20000 });
  await page.click('#btn-start');
  await page.waitForSelector('.hs-board', { timeout: 5000 });
  await page.click('#btn-settings');
  await page.waitForSelector('#hs-settings-root .hs-settings', { timeout: 5000 });
  await page.selectOption('#gfx-preset', preset);
  await page.waitForFunction((p) => document.body.getAttribute('data-gfx-preset') === p, preset);
  await page.click('#btn-settings-close');
  await page.waitForSelector('#hs-settings-root', { state: 'detached', timeout: 5000 });
}

export async function start(page) {
  let mirror = Rules.createGame(Content.JOURNEY[0]);
  let open = true;
  page.once('close', () => { open = false; });
  (async () => {
    while (open) {
      try {
        if (mirror.terminal) {
          await page.click('#btn-again', { timeout: 5000 });
          await page.waitForSelector('.hs-terminal', { state: 'detached', timeout: 5000 });
          mirror = Rules.createGame(Content.JOURNEY[0]);
          continue;
        }
        const h = Rules.hint(mirror);
        if (h.type === 'deliver') {
          await page.click(cell(h.at));
          await page.waitForSelector(`${cell(h.at)}.selected`, { timeout: 3000 });
          await page.click('#btn-deliver');
        } else {
          await page.click(cell(h.from));
          await page.waitForSelector(`${cell(h.from)}.selected`, { timeout: 3000 });
          await page.click(cell(h.to));
        }
        const res = Rules.applyCommand(mirror, h.type === 'deliver' ? { type: 'deliver', at: h.at } : { type: h.type, from: h.from, to: h.to });
        mirror = res.state;
      } catch (e) {
        if (!open) return;
        if (process.env.BENCH_DEBUG) console.error(e.message);
        // Out of step with the page: start a fresh round from the visible UI.
        await page.click('#btn-again', { timeout: 2000 }).catch(() => {});
        mirror = Rules.createGame(Content.JOURNEY[0]);
      }
      await page.waitForTimeout(250).catch(() => {});
    }
  })();
  await page.waitForTimeout(1500);
}
