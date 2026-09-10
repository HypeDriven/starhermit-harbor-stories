/**
 * Harbor Stories — rules-engine unit tests (dev only, not shipped).
 * Runs with `npm test` (node --test, zero dependencies). Loads the UMD game
 * scripts the same way tests/e2e.mjs does and checks the rules contract that
 * spec.md documents: legality reasons, resolution order, scoring components,
 * terminal states, seeding/determinism, hints and serialization.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gameRoot = {};
for (const f of ['rng.js', 'content.js', 'rules.js']) {
  const src = readFileSync(path.join(ROOT, 'js', f), 'utf8');
  new Function('self', src).call(gameRoot, gameRoot);
}
const Rules = gameRoot.HSRules;
const Content = gameRoot.HSContent;

function emptyCfg(extra) {
  return Object.assign({
    id: 'unit', version: 1, kind: 'practice', seed: 7,
    board: { rows: 4, cols: 4 }, chains: ['hammer', 'rope'], maxTier: 3,
    startItems: 0, spawn: null,
    tasks: [{ label: 'Fix the sign', reqs: [{ chain: 'hammer', tier: 1, count: 1 }] }],
    moveLimit: 0, timeLimitSec: 0, par: { moves: 10, timeSec: 60 },
    mechanics: { undo: false, hint: true }, endless: false
  }, extra || {});
}
function put(state, r, c, chain, tier) { state.board[r][c] = { c: chain, t: tier }; return state; }

test('createGame is deterministic for a seed and differs across seeds', () => {
  const a = Rules.createGame(Content.JOURNEY[0]);
  const b = Rules.createGame(Content.JOURNEY[0]);
  assert.equal(Rules.hashState(a), Rules.hashState(b));
  assert.equal(Rules.occupiedCells(a).length, Content.JOURNEY[0].startItems);
  const c = Rules.createGame(Object.assign({}, Content.JOURNEY[0], { seed: 999 }));
  assert.notEqual(Rules.hashState(a), Rules.hashState(c));
});

test('every journey stage, challenge, practice preset and daily config creates a legal board', () => {
  const cfgs = [...Content.JOURNEY, ...Content.CHALLENGES, ...Content.PRACTICE, Content.SCORE_CHASE,
    Content.dailyConfig('2026-09-09'), ...Content.tutorialLessons()];
  assert.equal(Content.JOURNEY.length, 40);
  for (const entry of cfgs) {
    const cfg = entry.cfg || entry;
    const s = Rules.createGame(cfg);
    // Tutorial lessons place their teaching pieces explicitly (lesson.force).
    for (const f of entry.force || []) s.board[f.r][f.c] = f.item;
    assert.equal(s.terminal, null, cfg.id);
    assert.ok(Rules.hasEscape(s), cfg.id + ' starts with a legal action');
    assert.ok(Rules.legalActions(s).length > 0, cfg.id);
  }
});

test('invalid actions report the documented reason and do not mutate state', () => {
  const s = put(put(Rules.createGame(emptyCfg()), 0, 0, 'hammer', 0), 0, 2, 'hammer', 0);
  put(s, 1, 0, 'rope', 0);
  const before = Rules.hashState(s);
  const cases = [
    [{ type: 'move', from: { r: 3, c: 3 }, to: { r: 3, c: 2 } }, 'empty-source'],
    [{ type: 'move', from: { r: 0, c: 0 }, to: { r: 1, c: 0 } }, 'occupied-target'],
    [{ type: 'move', from: { r: 0, c: 0 }, to: { r: 0, c: 0 } }, 'same-cell'],
    [{ type: 'merge', from: { r: 0, c: 0 }, to: { r: 3, c: 3 } }, 'empty-target'],
    [{ type: 'merge', from: { r: 0, c: 0 }, to: { r: 0, c: 2 } }, 'not-adjacent'],
    [{ type: 'merge', from: { r: 0, c: 0 }, to: { r: 1, c: 0 } }, 'merge-mismatch'],
    [{ type: 'deliver', at: { r: 0, c: 0 } }, 'not-needed'],
    [{ type: 'deliver', at: { r: 9, c: 9 } }, 'bad-location'],
    [{ type: 'jump' }, 'unknown-command'],
    [null, 'malformed-command']
  ];
  for (const [cmd, reason] of cases) {
    const res = Rules.applyCommand(s, cmd);
    assert.equal(res.ok, false);
    assert.equal(res.reason, reason, JSON.stringify(cmd));
  }
  assert.equal(Rules.hashState(s), before);
});

test('merge, deliver and task bonus score exactly as documented (worked example)', () => {
  let s = put(put(Rules.createGame(emptyCfg()), 1, 1, 'hammer', 0), 1, 2, 'hammer', 0);
  let res = Rules.applyCommand(s, { type: 'merge', from: { r: 1, c: 1 }, to: { r: 1, c: 2 } });
  assert.ok(res.ok);
  s = res.state;
  assert.deepEqual(s.board[1][2], { c: 'hammer', t: 1 });
  assert.equal(s.board[1][1], null);
  assert.equal(s.score.mergePoints, 20);      // MERGE_PT[1] + 5 * (streak 1 - 1)
  assert.equal(s.streak, 1);
  res = Rules.applyCommand(s, { type: 'deliver', at: { r: 1, c: 2 } });
  assert.ok(res.ok);
  s = res.state;
  assert.equal(s.score.deliverPoints, 35);    // DELIVER_PT[1] 30 + 5 * (streak 2 - 1)
  assert.equal(s.score.taskBonus, 150);
  assert.equal(s.score.moveBonus, (10 - 2) * 15);
  assert.equal(s.score.timeBonus, 0);          // no atMs supplied => no time bonus
  assert.equal(s.score.total, 20 + 35 + 150 + 120);
  assert.deepEqual(s.terminal, { reason: 'tasks-complete', won: true });
  assert.ok(s.events.some((e) => e.type === 'task-complete'));
  assert.ok(s.events.some((e) => e.type === 'win'));
});

test('a plain move resets the productive streak and time is quantized to 100 ms', () => {
  let s = put(put(Rules.createGame(emptyCfg()), 1, 1, 'hammer', 0), 1, 2, 'hammer', 0);
  put(s, 3, 3, 'rope', 0);
  s = Rules.applyCommand(s, { type: 'merge', from: { r: 1, c: 1 }, to: { r: 1, c: 2 } }).state;
  assert.equal(s.streak, 1);
  s = Rules.applyCommand(s, { type: 'move', from: { r: 3, c: 3 }, to: { r: 3, c: 2 }, atMs: 1234 }).state;
  assert.equal(s.streak, 0);
  assert.equal(s.elapsedMs, 1200);
});

test('move limit, time limit, resign and board jam are terminal with the documented reasons', () => {
  let s = put(put(Rules.createGame(emptyCfg({ moveLimit: 1 })), 0, 0, 'rope', 0), 3, 3, 'rope', 0);
  s = Rules.applyCommand(s, { type: 'move', from: { r: 0, c: 0 }, to: { r: 0, c: 1 } }).state;
  assert.deepEqual(s.terminal, { reason: 'move-limit', won: false });
  assert.equal(Rules.applyCommand(s, { type: 'resign' }).reason, 'game-ended');

  s = put(put(Rules.createGame(emptyCfg({ timeLimitSec: 1 })), 0, 0, 'rope', 0), 3, 3, 'rope', 0);
  s = Rules.applyCommand(s, { type: 'move', from: { r: 0, c: 0 }, to: { r: 0, c: 1 }, atMs: 1500 }).state;
  assert.deepEqual(s.terminal, { reason: 'time-up', won: false });

  s = put(Rules.createGame(emptyCfg()), 0, 0, 'rope', 0);
  const r = Rules.applyCommand(s, { type: 'resign' });
  assert.ok(r.ok);
  assert.deepEqual(r.state.terminal, { reason: 'resigned', won: false });
  assert.equal(r.events[0].type, 'lose');

  // 2x2 board: fill with a checkerboard of unmergeable, unwanted items; the
  // last move fills the final cell and the harbor locks.
  s = Rules.createGame(emptyCfg({ board: { rows: 2, cols: 2 }, chains: ['hammer', 'rope', 'lantern', 'brush'] }));
  put(s, 0, 0, 'rope', 0); put(s, 0, 1, 'lantern', 0); put(s, 1, 0, 'brush', 0);
  put(s, 1, 1, null, 0); s.board[1][1] = null;
  // move rope so that the remaining empty cell is filled by the tide (spawn every 1)
  s.cfg.spawn = { every: 1, per: 1 };
  s = Rules.applyCommand(s, { type: 'move', from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }).state;
  if (!Rules.hasEscape(s)) assert.deepEqual(s.terminal, { reason: 'harbor-locked', won: false });
  else assert.equal(s.terminal, null);
});

test('the tide spawns every cfg.spawn.every ticks and restocks an emptied board', () => {
  let s = put(Rules.createGame(emptyCfg({ spawn: { every: 2, per: 1 } })), 0, 0, 'rope', 0);
  s = Rules.applyCommand(s, { type: 'move', from: { r: 0, c: 0 }, to: { r: 0, c: 1 } }).state;
  assert.equal(Rules.occupiedCells(s).length, 1);
  s = Rules.applyCommand(s, { type: 'move', from: { r: 0, c: 1 }, to: { r: 0, c: 2 } }).state;
  assert.equal(Rules.occupiedCells(s).length, 2);
  assert.ok(s.events.some((e) => e.type === 'spawn' && !e.restock));

  s = put(Rules.createGame(emptyCfg({ tasks: [{ label: 'x', reqs: [{ chain: 'hammer', tier: 0, count: 2 }] }] })), 0, 0, 'hammer', 0);
  s = Rules.applyCommand(s, { type: 'deliver', at: { r: 0, c: 0 } }).state;
  assert.equal(s.terminal, null);
  assert.ok(s.events.some((e) => e.type === 'spawn' && e.restock), 'restock after the last item is delivered');
  assert.ok(Rules.occupiedCells(s).length >= 1);
});

test('endless rulesets roll a new task wave instead of ending', () => {
  const cfg = Object.assign({}, Content.SCORE_CHASE, { startItems: 0 });
  let s = put(Rules.createGame(cfg), 0, 0, 'hammer', 1);
  put(s, 5, 5, 'lantern', 1);
  s = Rules.applyCommand(s, { type: 'deliver', at: { r: 0, c: 0 } }).state;
  s = Rules.applyCommand(s, { type: 'deliver', at: { r: 5, c: 5 } }).state;
  assert.equal(s.terminal, null);
  assert.equal(s.endlessRound, 2);
  assert.equal(s.score.rounds, 1);
  assert.ok(s.events.some((e) => e.type === 'round' && e.round === 2));
  assert.ok(s.events.some((e) => e.type === 'tasks-new'));
  assert.ok(s.tasks.every((t) => !t.done && /^Harbor commission 2\./.test(t.label)));
});

test('hint prefers deliver, then a needed merge, and always returns a legal action', () => {
  let s = put(put(Rules.createGame(emptyCfg()), 0, 0, 'hammer', 1), 2, 2, 'rope', 0);
  put(s, 2, 3, 'rope', 0);
  let h = Rules.hint(s);
  assert.equal(h.type, 'deliver');
  assert.equal(h.why, 'deliver-task');
  s.board[0][0] = { c: 'hammer', t: 0 };
  s.board[0][1] = { c: 'hammer', t: 0 };
  h = Rules.hint(s);
  assert.equal(h.type, 'merge');
  assert.equal(h.why, 'craft-needed');
  assert.equal(h.item.c, 'hammer');
  // Following hints from a real stage always reaches a terminal state.
  let g = Rules.createGame(Content.JOURNEY[0]);
  for (let i = 0; i < 300 && !g.terminal; i++) {
    const x = Rules.hint(g);
    assert.ok(x, 'hint available while non-terminal');
    const res = Rules.applyCommand(g, x.type === 'deliver' ? { type: 'deliver', at: x.at } : { type: x.type, from: x.from, to: x.to });
    assert.ok(res.ok, res.reason);
    g = res.state;
  }
  assert.ok(g.terminal);
});

test('serialize/deserialize round-trips and rejects other state versions', () => {
  const s = Rules.createGame(Content.JOURNEY[3]);
  const back = Rules.deserialize(Rules.serialize(s));
  assert.equal(Rules.hashState(back), Rules.hashState(s));
  assert.throws(() => Rules.deserialize(JSON.stringify(Object.assign({}, s, { v: 99 }))), /unsupported state version/);
});

test('validateCommandShape guards the replay boundary', () => {
  assert.equal(Rules.validateCommandShape({ type: 'move', from: { r: 0, c: 0 }, to: { r: 0, c: 1 } }), null);
  assert.equal(Rules.validateCommandShape({ type: 'deliver' }), 'malformed-command');
  assert.equal(Rules.validateCommandShape({ type: 'teleport' }), 'unknown-command');
  assert.equal(Rules.validateCommandShape({ type: 'resign', id: 'x'.repeat(65) }), 'malformed-command');
});

test('daily config is a pure function of the date string', () => {
  const a = Content.dailyConfig('2026-09-09');
  const b = Content.dailyConfig('2026-09-09');
  assert.deepEqual(a, b);
  assert.notEqual(a.seed, Content.dailyConfig('2026-09-10').seed);
  assert.equal(Content.utcDateString(Date.UTC(2026, 8, 9, 23, 59)), '2026-09-09');
});
