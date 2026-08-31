/* Harbor Stories — pure deterministic rules engine.
 * No rendering, no DOM, no Date.now(): every transition derives from
 * (state, command) only. Usable from browser (window.HSRules) and Node.
 *
 * Core loop: repair a seaside neighborhood by merging tool chains.
 * Two identical items (same chain, same tier) on ADJACENT cells merge into
 * the next tier. Finished tools are delivered to restoration tasks; every
 * few actions the tide brings new tier-0 supplies onto the board. You win
 * when every task is complete; you lose when the board jams solid — no
 * empty cell, no adjacent merge, and nothing a task still wants.
 */
(function (root, factory) {
  var RNG = (typeof module === 'object' && module.exports) ? require('./rng.js') : root.HSRNG;
  var api = factory(RNG);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HSRules = api;
})(typeof self !== 'undefined' ? self : this, function (RNG) {
  'use strict';

  var STATE_VERSION = 1;

  var MERGE_PT = [0, 20, 50, 120];   // points for creating tier 1/2/3
  var DELIVER_PT = [10, 30, 80, 200]; // points for delivering tier 0..3
  var TASK_PT = 150;                  // bonus per completed task
  var STREAK_PT = 5;                  // extra per productive streak length
  var PAR_MOVE_PT = 15;               // win bonus per move under par
  var TIME_PT_PER_SEC = 4;            // win bonus per second under par

  var TERMINAL = {
    TASKS: 'tasks-complete',
    LOCKED: 'harbor-locked',
    MOVES: 'move-limit',
    TIME: 'time-up',
    RESIGN: 'resigned'
  };

  var INVALID = {
    EMPTY_SOURCE: 'empty-source',
    OCCUPIED: 'occupied-target',
    SAME_CELL: 'same-cell',
    NOT_ADJACENT: 'not-adjacent',
    MISMATCH: 'merge-mismatch',
    MAX_TIER: 'max-tier',
    NOT_NEEDED: 'not-needed',
    ENDED: 'game-ended',
    BAD_CMD: 'unknown-command',
    BAD_LOC: 'bad-location',
    BAD_SHAPE: 'malformed-command'
  };

  // ---------- helpers ----------

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Stable stringify: object keys sorted recursively → canonical hashing.
  function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) {
      var out = '[';
      for (var i = 0; i < v.length; i++) out += (i ? ',' : '') + stableStringify(v[i]);
      return out + ']';
    }
    var keys = Object.keys(v).sort(), s = '{';
    for (var k = 0; k < keys.length; k++) {
      s += (k ? ',' : '') + JSON.stringify(keys[k]) + ':' + stableStringify(v[keys[k]]);
    }
    return s + '}';
  }

  function hashState(state) {
    var copy = clone(state);
    delete copy.events;
    return RNG.hashString(stableStringify(copy));
  }

  function locEq(a, b) { return !!a && !!b && a.r === b.r && a.c === b.c; }

  function inBounds(cfg, loc) {
    return !!loc && typeof loc === 'object' &&
      Number.isInteger(loc.r) && Number.isInteger(loc.c) &&
      loc.r >= 0 && loc.r < cfg.board.rows && loc.c >= 0 && loc.c < cfg.board.cols;
  }

  function adjacent(a, b) {
    var dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
    return (dr <= 1 && dc <= 1) && (dr + dc > 0);
  }

  function getCell(state, loc) { return state.board[loc.r][loc.c]; }
  function setCell(state, loc, v) { state.board[loc.r][loc.c] = v; }

  function emptyCells(state) {
    var out = [];
    for (var r = 0; r < state.cfg.board.rows; r++)
      for (var c = 0; c < state.cfg.board.cols; c++)
        if (!state.board[r][c]) out.push({ r: r, c: c });
    return out;
  }

  function occupiedCells(state) {
    var out = [];
    for (var r = 0; r < state.cfg.board.rows; r++)
      for (var c = 0; c < state.cfg.board.cols; c++)
        if (state.board[r][c]) out.push({ r: r, c: c });
    return out;
  }

  // First unfinished requirement this item satisfies, or null.
  function matchingReq(state, item) {
    if (!item) return null;
    for (var ti = 0; ti < state.tasks.length; ti++) {
      var task = state.tasks[ti];
      if (task.done) continue;
      for (var ri = 0; ri < task.reqs.length; ri++) {
        var req = task.reqs[ri];
        if (req.chain === item.c && req.tier === item.t && task.got[ri] < req.count)
          return { task: ti, req: ri };
      }
    }
    return null;
  }

  function tasksComplete(state) {
    for (var i = 0; i < state.tasks.length; i++) if (!state.tasks[i].done) return false;
    return true;
  }

  // ---------- game creation ----------

  // cfg: { id, version, kind, seed, board:{rows,cols}, chains:[], maxTier,
  //        startItems, spawn:{every,per} | null,
  //        tasks:[{label, reqs:[{chain,tier,count}]}],
  //        moveLimit, timeLimitSec, par:{moves,timeSec} | null,
  //        mechanics:{undo,hint}, endless, theme, intro }
  function createGame(cfg) {
    var seed = cfg.seed >>> 0;
    var rng = RNG.derive(seed, RNG.STREAM_RULES);
    var rows = cfg.board.rows, cols = cfg.board.cols;
    var board = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(null);
      board.push(row);
    }

    var state = {
      v: STATE_VERSION,
      cfg: clone(cfg),
      seed: seed,
      rngState: 0,
      tick: 0,
      board: board,
      tasks: [],
      score: { merges: 0, mergePoints: 0, delivers: 0, deliverPoints: 0,
               taskBonus: 0, moveBonus: 0, timeBonus: 0, streakBest: 0,
               rounds: 0, total: 0 },
      streak: 0,
      moves: 0,
      elapsedMs: 0,
      endlessRound: 1,
      terminal: null,
      events: []
    };
    cfg.tasks.forEach(function (t) {
      state.tasks.push({ label: t.label, reqs: clone(t.reqs), got: t.reqs.map(function () { return 0; }), done: false });
    });

    // Seeded initial supplies: tier-0 items, weighted toward chains the
    // tasks actually need, scattered across random cells.
    var cells = emptyCells(state);
    rng.shuffle(cells);
    var n = Math.min(cfg.startItems == null ? 8 : cfg.startItems, cells.length - 1);
    for (var i = 0; i < n; i++) {
      board[cells[i].r][cells[i].c] = { c: drawSpawnChain(state, rng), t: 0 };
    }

    state.rngState = rng.state;
    return state;
  }

  // Spawn chain weights: unfinished task chains 3×, everything else 1×.
  // Fully driven by the rules stream.
  function drawSpawnChain(state, rng) {
    var weights = [], total = 0;
    var needed = {};
    state.tasks.forEach(function (task) {
      if (task.done) return;
      task.reqs.forEach(function (req, ri) {
        if (task.got[ri] < req.count) needed[req.chain] = true;
      });
    });
    state.cfg.chains.forEach(function (ch) {
      var w = needed[ch] ? 3 : 1;
      weights.push(w); total += w;
    });
    var roll = rng.next() * total;
    for (var i = 0; i < state.cfg.chains.length; i++) {
      roll -= weights[i];
      if (roll < 0) return state.cfg.chains[i];
    }
    return state.cfg.chains[state.cfg.chains.length - 1];
  }

  // ---------- legality ----------

  function checkAction(state, cmd) {
    if (state.terminal) return INVALID.ENDED;
    if (!cmd || typeof cmd !== 'object') return INVALID.BAD_SHAPE;
    var type = cmd.type;
    if (type === 'deliver') {
      if (!inBounds(state.cfg, cmd.at)) return INVALID.BAD_LOC;
      var item = getCell(state, cmd.at);
      if (!item) return INVALID.EMPTY_SOURCE;
      if (!matchingReq(state, item)) return INVALID.NOT_NEEDED;
      return null;
    }
    if (type !== 'move' && type !== 'merge') return INVALID.BAD_CMD;
    if (!inBounds(state.cfg, cmd.from) || !inBounds(state.cfg, cmd.to)) return INVALID.BAD_LOC;
    if (locEq(cmd.from, cmd.to)) return INVALID.SAME_CELL;
    var src = getCell(state, cmd.from);
    if (!src) return INVALID.EMPTY_SOURCE;
    if (type === 'move') {
      if (getCell(state, cmd.to)) return INVALID.OCCUPIED;
      return null;
    }
    // merge
    var dst = getCell(state, cmd.to);
    if (!dst) return INVALID.OCCUPIED;
    if (!adjacent(cmd.from, cmd.to)) return INVALID.NOT_ADJACENT;
    if (src.c !== dst.c || src.t !== dst.t) return INVALID.MISMATCH;
    if (src.t >= (state.cfg.maxTier || 3)) return INVALID.MAX_TIER;
    return null;
  }

  function legalActions(state) {
    if (state.terminal) return [];
    var actions = [];
    var occ = occupiedCells(state);
    var empty = emptyCells(state);
    var i, j;
    for (i = 0; i < occ.length; i++) {
      var loc = occ[i];
      var item = getCell(state, loc);
      if (matchingReq(state, item)) {
        actions.push({ type: 'deliver', at: loc, item: clone(item) });
      }
      for (j = 0; j < empty.length; j++) {
        actions.push({ type: 'move', from: loc, to: empty[j], item: clone(item) });
      }
    }
    for (i = 0; i < occ.length; i++) {
      for (j = i + 1; j < occ.length; j++) {
        var a = occ[i], b = occ[j];
        if (!adjacent(a, b)) continue;
        var ia = getCell(state, a), ib = getCell(state, b);
        if (ia.c === ib.c && ia.t === ib.t && ia.t < (state.cfg.maxTier || 3)) {
          actions.push({ type: 'merge', from: a, to: b, item: clone(ia) });
          actions.push({ type: 'merge', from: b, to: a, item: clone(ib) });
        }
      }
    }
    return actions;
  }

  // ---------- resolution ----------

  function applyCommand(state, cmd) {
    if (!cmd || typeof cmd !== 'object' || typeof cmd.type !== 'string') {
      return { ok: false, reason: INVALID.BAD_SHAPE, state: state, events: [] };
    }
    if (cmd.type === 'resign') {
      if (state.terminal) return { ok: false, reason: INVALID.ENDED, state: state, events: [] };
      var ns = clone(state);
      ns.tick++;
      ns.terminal = { reason: TERMINAL.RESIGN, won: false };
      ns.events = [{ type: 'lose', reason: TERMINAL.RESIGN }];
      finalizeScore(ns);
      return { ok: true, state: ns, events: ns.events };
    }
    var reason = checkAction(state, cmd);
    if (reason) return { ok: false, reason: reason, state: state, events: [] };

    var s = clone(state);
    s.events = [];
    s.tick++;
    s.moves++;
    if (typeof cmd.atMs === 'number' && isFinite(cmd.atMs) && cmd.atMs >= 0) {
      s.elapsedMs = Math.floor(cmd.atMs / 100) * 100; // quantized, replay-safe
    }
    var rng = RNG.create(s.rngState);
    var productive = false;

    if (cmd.type === 'move') {
      var mv = getCell(s, cmd.from);
      setCell(s, cmd.from, null);
      setCell(s, cmd.to, mv);
      s.events.push({ type: 'move', item: clone(mv), from: clone(cmd.from), to: clone(cmd.to) });
    } else if (cmd.type === 'merge') {
      var src = getCell(s, cmd.from);
      var dst = getCell(s, cmd.to);
      setCell(s, cmd.from, null);
      var newTier = dst.t + 1;
      setCell(s, cmd.to, { c: dst.c, t: newTier });
      s.streak++;
      productive = true;
      var mpts = MERGE_PT[newTier] + STREAK_PT * (s.streak - 1);
      s.score.merges++;
      s.score.mergePoints += mpts;
      s.score.streakBest = Math.max(s.score.streakBest, s.streak);
      s.events.push({ type: 'merge', chain: dst.c, tier: newTier, from: clone(cmd.from), to: clone(cmd.to), points: mpts, streak: s.streak });
    } else if (cmd.type === 'deliver') {
      var at = cmd.at;
      var dItem = getCell(s, at);
      var match = matchingReq(s, dItem);
      var task = s.tasks[match.task];
      setCell(s, at, null);
      task.got[match.req]++;
      s.streak++;
      productive = true;
      var dpts = DELIVER_PT[dItem.t] + STREAK_PT * (s.streak - 1);
      s.score.delivers++;
      s.score.deliverPoints += dpts;
      s.score.streakBest = Math.max(s.score.streakBest, s.streak);
      s.events.push({ type: 'deliver', chain: dItem.c, tier: dItem.t, at: clone(at), task: match.task, label: task.label, points: dpts, streak: s.streak });
      var done = true;
      for (var ri = 0; ri < task.reqs.length; ri++) if (task.got[ri] < task.reqs[ri].count) done = false;
      if (done) {
        task.done = true;
        s.score.taskBonus += TASK_PT;
        s.events.push({ type: 'task-complete', task: match.task, label: task.label });
      }
    }
    if (!productive) s.streak = 0;

    // Terminal: victory first, then limits.
    if (tasksComplete(s)) {
      if (s.cfg.endless) {
        s.score.rounds++;
        s.endlessRound++;
        s.events.push({ type: 'round', round: s.endlessRound });
        regenerateTasks(s, rng);
        s.events.push({ type: 'tasks-new', tasks: clone(s.tasks) });
      } else {
        s.terminal = { reason: TERMINAL.TASKS, won: true };
        if (s.cfg.par && s.cfg.par.moves && s.moves < s.cfg.par.moves) {
          s.score.moveBonus = (s.cfg.par.moves - s.moves) * PAR_MOVE_PT;
        }
        if (s.cfg.par && s.cfg.par.timeSec && s.elapsedMs > 0 && s.elapsedMs < s.cfg.par.timeSec * 1000) {
          s.score.timeBonus = Math.floor((s.cfg.par.timeSec * 1000 - s.elapsedMs) / 1000) * TIME_PT_PER_SEC;
        }
        s.events.push({ type: 'win', reason: TERMINAL.TASKS });
      }
    }
    if (!s.terminal && s.cfg.moveLimit && s.moves >= s.cfg.moveLimit) {
      s.terminal = { reason: TERMINAL.MOVES, won: false };
      s.events.push({ type: 'lose', reason: TERMINAL.MOVES });
    }
    if (!s.terminal && s.cfg.timeLimitSec && s.elapsedMs >= s.cfg.timeLimitSec * 1000) {
      s.terminal = { reason: TERMINAL.TIME, won: false };
      s.events.push({ type: 'lose', reason: TERMINAL.TIME });
    }

    // The tide brings fresh supplies.
    if (!s.terminal && s.cfg.spawn && s.tick % s.cfg.spawn.every === 0) {
      spawnItems(s, rng, s.cfg.spawn.per);
    }

    // Board-jam guard: no empty cell, no adjacent merge, nothing a task
    // still wants → the harbor is locked. Because deliver always consumes,
    // any non-terminal state with an empty cell or a wanted item keeps at
    // least one legal action: no soft locks.
    if (!s.terminal && !hasEscape(s)) {
      s.terminal = { reason: TERMINAL.LOCKED, won: false };
      s.events.push({ type: 'lose', reason: TERMINAL.LOCKED });
    }

    // Empty-board guard: a delivery may remove the last item in play.
    // Restock deterministically so the round can never deadlock.
    if (!s.terminal && occupiedCells(s).length === 0) {
      spawnItems(s, rng, (s.cfg.spawn && s.cfg.spawn.per) || 2, true);
    }

    s.rngState = rng.state;
    if (s.terminal) finalizeScore(s);
    return { ok: true, state: s, events: s.events };
  }

  function spawnItems(s, rng, want, restock) {
    var cells = emptyCells(s);
    rng.shuffle(cells);
    var fit = Math.min(want, cells.length);
    for (var i = 0; i < fit; i++) {
      var tier = 0;
      // Late endless rounds occasionally deliver pre-built tier-1 supplies.
      if (s.cfg.endless && s.endlessRound >= 3 && rng.next() < 0.18) tier = 1;
      var item = { c: drawSpawnChain(s, rng), t: tier };
      s.board[cells[i].r][cells[i].c] = item;
      s.events.push({ type: 'spawn', item: clone(item), at: cells[i], restock: !!restock });
    }
  }

  // Fresh, seeded task wave for the next endless round: harder each time.
  function regenerateTasks(s, rng) {
    var round = s.endlessRound;
    var chains = s.cfg.chains;
    var nTasks = Math.min(2 + Math.floor(round / 3), 3);
    var shuffled = chains.slice();
    rng.shuffle(shuffled);
    var tasks = [];
    for (var i = 0; i < nTasks; i++) {
      var chain = shuffled[i % shuffled.length];
      var tier = Math.min(1 + Math.floor((round - 1) / 2) + rng.int(2), s.cfg.maxTier || 3);
      var count = 1 + (round >= 4 ? rng.int(2) : 0);
      tasks.push({
        label: 'Harbor commission ' + round + '.' + (i + 1),
        reqs: [{ chain: chain, tier: tier, count: count }],
        got: [0],
        done: false
      });
    }
    s.tasks = tasks;
  }

  function hasEscape(s) {
    if (emptyCells(s).length > 0) return true;
    var occ = occupiedCells(s);
    for (var i = 0; i < occ.length; i++) {
      var item = getCell(s, occ[i]);
      if (matchingReq(s, item)) return true;
      for (var j = i + 1; j < occ.length; j++) {
        if (!adjacent(occ[i], occ[j])) continue;
        var other = getCell(s, occ[j]);
        if (item.c === other.c && item.t === other.t && item.t < (s.cfg.maxTier || 3)) return true;
      }
    }
    return false;
  }

  function finalizeScore(s) {
    s.score.total = s.score.mergePoints + s.score.deliverPoints + s.score.taskBonus +
      s.score.moveBonus + s.score.timeBonus;
  }

  // ---------- hints (same legality surface as play) ----------

  function hint(state) {
    var actions = legalActions(state);
    if (!actions.length) return null;
    var i, a;
    // 1) deliver something a task wants right now.
    for (i = 0; i < actions.length; i++) {
      if (actions[i].type === 'deliver') {
        return { type: 'deliver', at: actions[i].at, item: actions[i].item, why: 'deliver-task' };
      }
    }
    // 2) merge into a tier a task still needs.
    var wanted = {};
    state.tasks.forEach(function (task) {
      if (task.done) return;
      task.reqs.forEach(function (req, ri) {
        if (task.got[ri] < req.count && req.tier > 0) wanted[req.chain + ':' + req.tier] = true;
      });
    });
    for (i = 0; i < actions.length; i++) {
      a = actions[i];
      if (a.type === 'merge' && wanted[a.item.c + ':' + (a.item.t + 1)]) {
        return { type: 'merge', from: a.from, to: a.to, item: a.item, why: 'craft-needed' };
      }
    }
    // 3) any merge: building tiers is always progress.
    for (i = 0; i < actions.length; i++) {
      a = actions[i];
      if (a.type === 'merge') return { type: 'merge', from: a.from, to: a.to, item: a.item, why: 'merge-up' };
    }
    // 4) a move that sets up a merge for next action.
    for (i = 0; i < actions.length; i++) {
      a = actions[i];
      if (a.type !== 'move') continue;
      var occ = occupiedCells(state);
      for (var j = 0; j < occ.length; j++) {
        if (locEq(occ[j], a.from)) continue;
        var other = getCell(state, occ[j]);
        if (other.c === a.item.c && other.t === a.item.t && a.item.t < (state.cfg.maxTier || 3) && adjacent(a.to, occ[j])) {
          return { type: 'move', from: a.from, to: a.to, item: a.item, why: 'setup-merge' };
        }
      }
    }
    // 5) anything legal.
    a = actions[0];
    return { type: a.type, from: a.from, to: a.to, at: a.at, item: a.item, why: 'any' };
  }

  // ---------- validation (network / replay boundary) ----------

  function validateCommandShape(cmd, maxLen) {
    if (!cmd || typeof cmd !== 'object') return INVALID.BAD_SHAPE;
    if (JSON.stringify(cmd).length > (maxLen || 512)) return INVALID.BAD_SHAPE;
    if (cmd.type !== 'move' && cmd.type !== 'merge' && cmd.type !== 'deliver' && cmd.type !== 'resign') return INVALID.BAD_CMD;
    if (cmd.id != null && (typeof cmd.id !== 'string' || cmd.id.length > 64)) return INVALID.BAD_SHAPE;
    if (cmd.type === 'move' || cmd.type === 'merge') {
      if (!cmd.from || !cmd.to) return INVALID.BAD_SHAPE;
      if (typeof cmd.from !== 'object' || typeof cmd.to !== 'object') return INVALID.BAD_SHAPE;
    }
    if (cmd.type === 'deliver' && (!cmd.at || typeof cmd.at !== 'object')) return INVALID.BAD_SHAPE;
    return null;
  }

  // ---------- serialization ----------

  function serialize(state) { return JSON.stringify(state); }
  function deserialize(json) {
    var s = JSON.parse(json);
    if (s.v !== STATE_VERSION) throw new Error('unsupported state version ' + s.v);
    return s;
  }

  return {
    STATE_VERSION: STATE_VERSION,
    TERMINAL: TERMINAL,
    INVALID: INVALID,
    MERGE_PT: MERGE_PT,
    DELIVER_PT: DELIVER_PT,
    TASK_PT: TASK_PT,
    createGame: createGame,
    applyCommand: applyCommand,
    checkAction: checkAction,
    legalActions: legalActions,
    hint: hint,
    tasksComplete: tasksComplete,
    matchingReq: matchingReq,
    hasEscape: hasEscape,
    emptyCells: emptyCells,
    occupiedCells: occupiedCells,
    getCell: getCell,
    locEq: locEq,
    adjacent: adjacent,
    inBounds: inBounds,
    hashState: hashState,
    stableStringify: stableStringify,
    serialize: serialize,
    deserialize: deserialize,
    clone: clone,
    validateCommandShape: validateCommandShape
  };
});
