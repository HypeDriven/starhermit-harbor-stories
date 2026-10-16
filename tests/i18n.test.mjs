// Localization coverage: every English key the code and the reachable content
// use is translated in every locale (en-GB → en-US, es-ES → es-419, fr-CA →
// fr-FR inherit), placeholders survive, the language follows sh-language.js
// and switches live. Run: node --test tests/i18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTables, codeKeys, audit, bootI18n } from './i18n-common.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gameRoot = {};
for (const f of ['rng.js', 'content.js']) new Function('self', readFileSync(path.join(DIR, 'js', f), 'utf8')).call(gameRoot, gameRoot);
const Content = gameRoot.HSContent;

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
  for (const f of ['js/main.js', 'js/platform.js']) codeKeys(read(f)).forEach((k) => keys.add(k));
  return [...keys].filter((k) => /[A-Za-z]/.test(k)).sort();
}

test('every used key is translated in every locale; placeholders intact', () => {
  assert.deepEqual(audit(loadTables(ROOT, 'js/strings.js', 'HS_STRINGS'), usedKeys()), []);
});

test('the locale follows sh-language and switches live', () => {
  const { I18N, events, doc } = bootI18n(ROOT, { strings: 'js/strings.js', i18n: 'js/i18n.js', global: 'HSI18N', languages: ['de-DE'] });
  assert.equal(I18N.lang, 'de-DE');
  assert.equal(doc.documentElement.lang, 'de-DE');
  assert.equal(I18N.T('Play again'), 'Nochmal spielen');
  I18N.language.setChoice('fr-CA');
  assert.equal(I18N.lang, 'fr-CA');
  assert.equal(events.at(-1), 'fr-CA');
  assert.equal(I18N.T('Score {score}', { score: 7 }), 'Pointage 7');
  I18N.language.setChoice('it-IT');
  assert.equal(I18N.TH('Moves {moves} · Score {score}', { moves: '<b>1</b>', score: '<b>2</b>' }), 'Mosse <b>1</b> · Punti <b>2</b>');
});
