// Localization coverage: every English key the client (src/*.ts) and the
// reachable content use is translated in every locale (en-GB → en-US, es-ES →
// es-419, fr-CA → fr-FR inherit), placeholders survive, and no table holds a
// key nothing uses. Run: node --test tests/i18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { loadTables, codeKeys, audit } from './i18n-common.mjs';
import { loadClassic } from './load.mjs';

const ROOT = new URL('../', import.meta.url);
const Content = loadClassic('rng.js', 'content.js').HSContent;

/** Content shown in play: tool names, the opening stage, achievement names. */
function contentKeys() {
  const keys = [];
  for (const ch of Object.values(Content.CHAINS)) keys.push(...ch.tiers);
  const stage = Content.JOURNEY[0];
  keys.push(stage.name, stage.intro, ...stage.tasks.map((t) => t.label));
  for (const a of Content.ACHIEVEMENTS) keys.push(a.name);
  return keys;
}

function usedKeys() {
  const keys = new Set(contentKeys());
  const dir = new URL('src/', ROOT);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    codeKeys(readFileSync(new URL(f, dir), 'utf8')).forEach((k) => keys.add(k));
  }
  return [...keys].filter((k) => /[A-Za-z]/.test(k)).sort();
}

test('every used key is translated in every locale; placeholders intact; no unused rows', () => {
  assert.deepEqual(audit(loadTables(ROOT, 'js/strings.js', 'HS_STRINGS'), usedKeys()), []);
});

test('the client finds its keys (the scan is not empty)', () => {
  const keys = usedKeys();
  for (const k of ['Play', 'Deliver selected', 'Moves {moves} · Score {score}', 'Invite a friend', 'Harbor restored!']) assert.ok(keys.includes(k), k);
});
