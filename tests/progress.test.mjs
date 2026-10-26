// The progress document (js/progress.js): counters, achievements, merging two
// devices' saves, and the browser build's cloud save migrating as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './load.mjs';

const G = loadClassic('rng.js', 'content.js', 'progress.js');
const P = G.HSProgress, Content = G.HSContent;

test('the browser build\'s save.json migrates as it was written', () => {
  // As js/main.js of the browser build wrote it (zipped as save.json in game:<slug>).
  const old = JSON.stringify({ v: 1, best: 640, achievements: { 'first-merge': 1700000000000 },
    stats: { merges: 12, delivers: 4, bestStreak: 3, tier3: 0, repairs: 1, stagesDone: 1, dailiesDone: 0 } });
  const doc = P.merge(P.empty(), P.parse(old));
  assert.equal(doc.best, 640);
  assert.equal(doc.stats.merges, 12);
  assert.equal(doc.achievements['first-merge'], 1700000000000);
  assert.equal(P.parse('not json'), null);
  assert.equal(P.parse(JSON.stringify({ v: 2 })), null);
});

test('two devices merge by max and union (earliest unlock), never double-counting', () => {
  const a = P.empty(); a.best = 300; a.stats.merges = 10; a.achievements.tier3 = 50;
  const b = P.empty(); b.best = 200; b.stats.merges = 14; b.stats.delivers = 3; b.achievements.tier3 = 40; b.achievements['first-deliver'] = 60;
  const m = P.merge(a, b);
  assert.equal(m.best, 300);
  assert.equal(m.stats.merges, 14);
  assert.equal(m.stats.delivers, 3);
  assert.deepEqual(m.achievements, { tier3: 40, 'first-deliver': 60 });
  assert.deepEqual(P.merge(m, m), m);
});

test('events count and unlock the reachable achievements once', () => {
  const doc = P.empty();
  let r = P.track(doc, { type: 'merge', streak: 1, tier: 1 }, Content.ACHIEVEMENTS, 5);
  assert.deepEqual(r.fresh.map((a) => a.key), ['first-merge']);
  r = P.track(doc, { type: 'merge', streak: 2, tier: 1 }, Content.ACHIEVEMENTS, 6);
  assert.equal(r.fresh.length, 0);
  assert.equal(r.changed, true);
  r = P.track(doc, { type: 'deliver' }, Content.ACHIEVEMENTS, 7);
  assert.deepEqual(r.fresh.map((a) => a.key), ['first-deliver']);
  r = P.track(doc, { type: 'win' }, Content.ACHIEVEMENTS, 8);
  assert.deepEqual(r.fresh.map((a) => a.key), ['first-repair']);
  assert.equal(P.track(doc, { type: 'spawn' }, Content.ACHIEVEMENTS, 9).changed, false);
  assert.equal(doc.stats.merges, 2);
  assert.equal(doc.achievements['first-merge'], 5);
});

test('the best score only goes up', () => {
  const doc = P.empty();
  assert.equal(P.recordBest(doc, 120), true);
  assert.equal(P.recordBest(doc, 80), false);
  assert.equal(doc.best, 120);
});
