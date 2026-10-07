/* Harbor Stories — responsive browser entry point. */
(function () {
'use strict';

var Rules = window.HSRules;
var Content = window.HSContent;
var state = null;
var selected = null;
var startedAt = 0;
var statusText = '';
var BEST_KEY = 'hs-best';
var SAVE_KEY = 'hs-save';
var pendingFx = null; // rules events waiting for their particle burst after the next render

function app() { return document.getElementById('app'); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
function loc(r, c) { return { r: r, c: c }; }
function same(a, b) { return a && b && a.r === b.r && a.c === b.c; }
function itemAt(p) { return state && state.board[p.r][p.c]; }
function itemName(item) { return item ? Content.itemLabel(item.c, item.t) : 'Open water'; }
function icon(item) { return item ? Content.CHAINS[item.c].icon : '·'; }
function chainHex(item) { return '#' + ('00000' + Content.CHAINS[item.c].color.toString(16)).slice(-6); }
function settingsLabel() { return window.HSSettings ? window.HSSettings.label() : 'Settings'; }
function settingsButton(extra) {
  return window.HSSettings ? '<button id="btn-settings" class="hs-btn secondary' + (extra || '') + '" type="button">' +
    escapeHtml(settingsLabel()) + '</button>' : '';
}
function t(key, vars) { return window.HSSettings ? window.HSSettings.t(key, vars) : key; }
var P = window.HSPlatform || null;

// ---------- keyboard bindings (StarHermit controls; defaults mirror starhermit.txt) ----------
var DEFAULT_BINDINGS = { deliver: ['KeyD'], hint: ['KeyH'], restart: ['KeyR'], clear: ['Escape'] };
var bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
function codeLabel(code) {
  if (!code) return '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (code === 'Escape') return 'Esc';
  return code.replace(/^Arrow/, '');
}
function keyHint(action) { var c = (bindings[action] || [])[0]; return c ? ' <kbd>' + escapeHtml(codeLabel(c)) + '</kbd>' : ''; }
function actionFor(code) {
  var found = null;
  Object.keys(bindings).forEach(function (a) { if (!found && bindings[a].indexOf(code) !== -1) found = a; });
  return found;
}

// ---------- toast ----------
var toastTimer = null;
function toast(msg) {
  var el = document.getElementById('hs-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hs-toast';
    el.className = 'hs-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
}
function inviteFriend() {
  if (!P) return;
  P.copyInvite().then(function (ok) {
    toast(ok ? t('copied') : t('copyFailed', { link: P.inviteLink() || '' }));
  });
}

function wireSettings() {
  var b = document.getElementById('btn-settings');
  if (b) b.addEventListener('click', function () { window.HSSettings.open(); });
}

function bestScore() {
  try {
    var v = Number(window.localStorage.getItem(BEST_KEY));
    return isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch (e) { return 0; }
}

function recordBest(score) {
  if (!(score > bestScore())) return;
  try { window.localStorage.setItem(BEST_KEY, String(Math.floor(score))); } catch (e) { /* storage unavailable */ }
  persistSave();
}

// ---------- save document: best + stats + local achievements ----------
// localStorage is the offline cache; HSPlatform mirrors this doc to the
// cloud-saves slot when a launch token is present (spec.md §12).
var saveDoc = loadSaveDoc();

function loadSaveDoc() {
  try {
    var d = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
    if (d && d.v === 1 && d.stats) return d;
  } catch (e) { /* storage unavailable */ }
  return { v: 1, best: 0, achievements: {},
    stats: { merges: 0, delivers: 0, bestStreak: 0, tier3: 0, repairs: 0, stagesDone: 0, dailiesDone: 0 } };
}

function persistSave() {
  saveDoc.best = bestScore();
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveDoc)); } catch (e) { /* storage unavailable */ }
  if (window.HSPlatform) window.HSPlatform.pushSave(saveDoc);
}

// Remote wins conflicts (cloud is the mirror of record); counters merge by max
// so two devices never double-count, achievements union by earliest unlock.
function mergeRemoteSave(remote) {
  if (!remote || typeof remote !== 'object') return false;
  var changed = false;
  if (Number(remote.best) > bestScore()) {
    try { window.localStorage.setItem(BEST_KEY, String(Math.floor(Number(remote.best)))); } catch (e) { /* ignore */ }
    changed = true;
  }
  var remoteAch = remote.achievements || {};
  Object.keys(remoteAch).forEach(function (key) {
    if (!saveDoc.achievements[key]) { saveDoc.achievements[key] = remoteAch[key]; changed = true; }
  });
  var rs = remote.stats || {};
  Object.keys(saveDoc.stats).forEach(function (k) {
    if (Number(rs[k]) > Number(saveDoc.stats[k] || 0)) { saveDoc.stats[k] = Number(rs[k]); changed = true; }
  });
  return changed;
}

// Achievements are local by design (no server-authoritative unlock path for a
// pure browser game); they live in the save doc and travel with the cloud
// mirror. Conditions cover the keys reachable from today's UI (spec.md §16).
function evaluateAchievements() {
  var s = saveDoc.stats;
  var fresh = [];
  Content.ACHIEVEMENTS.forEach(function (a) {
    if (saveDoc.achievements[a.key]) return;
    var ok = false;
    switch (a.key) {
      case 'first-merge': ok = s.merges >= 1; break;
      case 'first-deliver': ok = s.delivers >= 1; break;
      case 'first-repair': ok = s.repairs >= 1; break;
      case 'tier3': ok = s.tier3 >= 1; break;
      case 'streak-6': ok = s.bestStreak >= 6; break;
      case 'merges-250': ok = s.merges >= 250; break;
      case 'journey-half': ok = s.stagesDone >= 20; break;
      case 'journey-done': ok = s.stagesDone >= 40; break;
      case 'daily-7': ok = s.dailiesDone >= 7; break;
      case 'delivers-300': ok = s.delivers >= 300; break;
    }
    if (ok) { saveDoc.achievements[a.key] = Date.now(); fresh.push(a); }
  });
  return fresh;
}

function trackEvent(event) {
  var s = saveDoc.stats;
  var changed = false;
  if (event.type === 'merge') {
    s.merges++;
    if (event.streak > s.bestStreak) s.bestStreak = event.streak;
    if (event.tier >= 3) s.tier3++;
    changed = true;
  } else if (event.type === 'deliver') {
    s.delivers++;
    changed = true;
  } else if (event.type === 'win') {
    s.repairs++;
    s.stagesDone++;
    changed = true;
  }
  var fresh = evaluateAchievements();
  if (fresh.length) changed = true;
  if (changed) persistSave();
  return fresh;
}

// ---------- player chip + leaderboard (hosted mode only) ----------
function playerChipHtml() {
  if (!window.HSPlatform || !window.HSPlatform.isOnline()) return '';
  var labels = { loading: 'Loading…', saving: 'Saving…', synced: 'Synced', error: 'Sync error', offline: 'Offline' };
  var sync = window.HSPlatform.syncStatus();
  return '<div class="hs-player" role="status">' +
    (window.HSPlatform.avatarUrl() ? '<img class="hs-avatar" src="' + escapeHtml(window.HSPlatform.avatarUrl()) + '" alt="">' : '') +
    '<span class="hs-sync-dot hs-sync-' + sync + '" aria-hidden="true"></span>' +
    '<span class="hs-player-name">' + escapeHtml(window.HSPlatform.displayName() || 'Player') + '</span>' +
    '<span class="hs-sync-label">' + (labels[sync] || sync) + '</span></div>';
}

function leaderboardHtml() {
  if (!window.HSPlatform || !window.HSPlatform.isOnline()) return '';
  var entries = window.HSPlatform.getLeaderboard();
  if (!entries || !entries.length) return '';
  return '<section class="hs-lb"><h2>Harbor leaderboard</h2><ol>' + entries.map(function (e, i) {
    return '<li' + (e.mine ? ' class="mine"' : '') + '><span>' + (i + 1) + '. ' + escapeHtml(e.name) + '</span>' +
      '<span class="hs-lb-score">' + Math.floor(Number(e.score) || 0) + '</span></li>';
  }).join('') + '</ol></section>';
}

function showTitle() {
  var best = bestScore();
  app().innerHTML = '<main class="hs-app"><section class="hs-title-screen">' +
    '<img class="hs-key-art" src="assets/key-art.webp" alt="" aria-hidden="true" decoding="async" ' +
    'onerror="this.hidden=true">' +
    '<h1 class="hs-title-name">Harbor Stories</h1>' +
    '<p class="hs-tagline">Merge tool chains, repair the coast, and reveal stories around Brinemist Quay.</p>' +
    (best ? '<p class="hs-best">Best score <b>' + best + '</b></p>' : '') +
    playerChipHtml() +
    '<div class="hs-title-actions"><button id="btn-start" class="hs-btn" type="button">Play</button>' +
    settingsButton() +
    (P && P.isOnline() ? '<button id="btn-invite" class="hs-btn secondary" type="button">' + escapeHtml(t('invite')) + '</button>' : '') +
    (P && P.canSignIn() ? '<button id="btn-signin" class="hs-btn secondary" type="button">' + escapeHtml(t('signIn')) + '</button>' : '') +
    '</div>' +
    leaderboardHtml() + '</section></main>';
  document.getElementById('btn-start').addEventListener('click', startGame);
  var inv = document.getElementById('btn-invite');
  if (inv) inv.addEventListener('click', inviteFriend);
  var sin = document.getElementById('btn-signin');
  if (sin) sin.addEventListener('click', function () { P.signIn(); });
  wireSettings();
}

// Signed in only: post the finished run's score and show the board rank on
// the end card (re-rendered when the answer arrives).
var lbText = null;
function postToLeaderboard(run) {
  var P = window.HSPlatform;
  if (!P || !P.isOnline()) { lbText = null; return; }
  lbText = t('lbPosting');
  P.submitScore(run.score.total).then(function (r) {
    if (state !== run) return;
    lbText = !r.posted ? t('lbNotPosted') : r.rank ? t('lbRank', { rank: r.rank }) : t('lbPosted');
    renderGame();
  });
}

function startGame() {
  lbText = null;
  if (window.HSSfx) { window.HSSfx.unlock(); window.HSSfx.uiStart(); }
  state = Rules.createGame(Content.JOURNEY[0]);
  selected = null;
  startedAt = performance.now();
  statusText = Content.JOURNEY[0].intro || 'Select a tool, then an open or matching adjacent cell.';
  renderGame();
}

var INVALID_TEXT = {
  'empty-source': 'That cell is empty — pick a tool first.',
  'empty-target': 'There is nothing there to merge with.',
  'occupied-target': 'That cell is already taken.',
  'same-cell': 'Pick a different destination.',
  'not-adjacent': 'Tools only merge on touching cells.',
  'merge-mismatch': 'Only two identical tools merge.',
  'max-tier': 'That tool is already a masterwork.',
  'not-needed': 'No task wants that tool right now.',
  'game-ended': 'This round is over — play again to continue.'
};

function eventText(event) {
  switch (event.type) {
    case 'move': return 'Tool moved.';
    case 'merge': return 'Merged into ' + Content.itemLabel(event.chain, event.tier) + '. +' + event.points +
      (event.streak > 1 ? ' (streak ' + event.streak + ')' : '');
    case 'deliver': return 'Delivered ' + Content.itemLabel(event.chain, event.tier) + ' to ' + event.label + '. +' + event.points;
    case 'task-complete': return event.label + ' complete!';
    case 'round': return 'Round ' + event.round + ' begins.';
    case 'win': return 'Every task is done — the harbor is restored!';
    case 'lose': return String(event.reason || 'round over').replace(/-/g, ' ');
    default: return '';
  }
}

function statusFromEvents(events) {
  var parts = [];
  var spawned = 0;
  events.forEach(function (event) {
    if (event.type === 'spawn') { spawned++; return; }
    var text = eventText(event);
    if (text) parts.push(text);
  });
  if (spawned) parts.push('The tide brought ' + spawned + (spawned === 1 ? ' new supply.' : ' new supplies.'));
  return parts.join(' ') || 'Move complete.';
}

function apply(command) {
  command.atMs = performance.now() - startedAt;
  var result = Rules.applyCommand(state, command);
  if (!result.ok) {
    statusText = INVALID_TEXT[result.reason] || String(result.reason || 'That action is not available.').replace(/-/g, ' ');
    if (window.HSSfx) window.HSSfx.invalid();
    return false;
  }
  state = result.state;
  pendingFx = result.events;
  var unlocked = [];
  result.events.forEach(function (event) {
    if (window.HSSfx) window.HSSfx.play(event.type);
    unlocked = unlocked.concat(trackEvent(event));
  });
  statusText = statusFromEvents(result.events);
  if (unlocked.length) {
    statusText += (statusText ? ' ' : '') + 'Achievement unlocked: ' +
      unlocked.map(function (a) { return a.name; }).join(', ') + '.';
  }
  selected = null;
  if (state.terminal) { recordBest(state.score.total); postToLeaderboard(state); }
  return true;
}

function chooseCell(r, c) {
  if (state.terminal) return;
  var target = loc(r, c);
  var item = itemAt(target);
  if (!selected) {
    if (!item) { statusText = 'Choose a tool first.'; renderGame(); return; }
    selected = target;
    if (window.HSSfx) window.HSSfx.select();
    statusText = itemName(item) + ' selected. Choose its destination or Deliver.';
    renderGame();
    return;
  }
  if (same(selected, target)) {
    selected = null;
    statusText = 'Selection cleared.';
    renderGame();
    return;
  }
  apply({ type: item ? 'merge' : 'move', from: selected, to: target });
  renderGame();
}

function deliver() {
  if (state.terminal) return;
  if (!selected) { statusText = 'Select a requested tool before delivering.'; renderGame(); return; }
  apply({ type: 'deliver', at: selected });
  renderGame();
}

function showHint() {
  if (state.terminal) return;
  var h = Rules.hint(state);
  if (window.HSSfx) window.HSSfx.hint();
  if (!h) statusText = 'No legal action is available.';
  else if (h.type === 'deliver') statusText = 'Hint: deliver ' + itemName(h.item) + '.';
  else statusText = 'Hint: ' + h.type + ' from row ' + (h.from.r + 1) + ', column ' + (h.from.c + 1) +
    ' to row ' + (h.to.r + 1) + ', column ' + (h.to.c + 1) + '.';
  renderGame();
}

function toggleSound() {
  if (!window.HSSfx) return;
  window.HSSfx.unlock();
  var muted = window.HSSfx.toggleMute();
  statusText = muted ? 'Sound off.' : 'Sound on.';
  pushSoundSettings();
  renderGame();
}

function renderTasks() {
  return state.tasks.map(function (task) {
    var reqs = task.reqs.map(function (req, i) {
      return Content.itemLabel(req.chain, req.tier) + ' ' + task.got[i] + '/' + req.count;
    }).join(' · ');
    return '<li class="' + (task.done ? 'done' : '') + '"><strong>' + task.label + '</strong><span>' + reqs + '</span></li>';
  }).join('');
}

// Full re-render replaces every node, so remember what had keyboard focus and
// hand it back afterwards; otherwise focus falls to <body> on every action.
function focusKey() {
  var el = document.activeElement;
  if (!el || el === document.body) return null;
  if (el.classList && el.classList.contains('hs-cell')) return '.hs-cell[data-r="' + el.dataset.r + '"][data-c="' + el.dataset.c + '"]';
  return el.id ? '#' + el.id : null;
}

function restoreFocus(key) {
  if (!key) return;
  var el = app().querySelector(key);
  if (el) el.focus();
}

function renderGame() {
  var cfg = state.cfg;
  var key = focusKey();
  var cells = '';
  for (var r = 0; r < cfg.board.rows; r++) for (var c = 0; c < cfg.board.cols; c++) {
    var item = state.board[r][c];
    var isSelected = same(selected, loc(r, c));
    cells += '<button class="hs-cell' + (item ? ' occupied' : '') + (isSelected ? ' selected' : '') +
      '" data-r="' + r + '" data-c="' + c + '"' +
      (item ? ' data-chain="' + item.c + '" data-tier="' + item.t + '" style="--chain:' + chainHex(item) + '"' : '') +
      ' type="button" aria-pressed="' + isSelected +
      '" aria-label="Row ' + (r + 1) + ', column ' + (c + 1) + ': ' + itemName(item) + '">' +
      '<span class="hs-icon" aria-hidden="true">' + icon(item) + (item ? '<b class="hs-tier" aria-hidden="true">' + (item.t + 1) + '</b>' : '') + '</span><span>' + itemName(item) + '</span></button>';
  }
  var best = bestScore();
  var terminal = state.terminal ? '<div class="hs-terminal" role="dialog" aria-modal="true" aria-labelledby="hs-terminal-title">' +
    '<div class="hs-terminal-card">' +
    '<img class="hs-result-art" src="assets/' + (state.terminal.won ? 'harbor-restored' : 'harbor-jammed') +
    '.webp" alt="" aria-hidden="true" decoding="async" onerror="this.hidden=true">' +
    '<h2 id="hs-terminal-title">' + (state.terminal.won ? 'Harbor restored!' : 'Round over') + '</h2>' +
    '<p>Score ' + state.score.total + '</p>' +
    (best ? '<div class="hs-best">Best ' + best + '</div>' : '') +
    (lbText ? '<p id="hs-lb" class="hs-lb-line" aria-live="polite">' + escapeHtml(lbText) + '</p>' : '') +
    '<button id="btn-again" class="hs-btn" type="button">Play again</button></div></div>' : '';
  var muted = window.HSSfx ? window.HSSfx.isMuted() : true;
  app().innerHTML = '<main class="hs-game"><header><div><h1>Harbor Stories</h1><p>' + (cfg.name || '') + '</p></div>' +
    '<div class="hs-header-tools"><div class="hs-score">Moves <b>' + state.moves + '</b> · Score <b>' + state.score.total + '</b></div>' +
    settingsButton(' hs-settings-btn') + '</div>' +
    playerChipHtml() + '</header>' +
    '<section class="hs-layout"><aside><h2>Restoration tasks</h2><ul class="hs-tasks">' + renderTasks() + '</ul>' +
    '<div class="hs-actions"><button id="btn-deliver" class="hs-btn" type="button">Deliver selected' + keyHint('deliver') + '</button>' +
    '<button id="btn-hint" class="hs-btn secondary" type="button">Hint' + keyHint('hint') + '</button>' +
    '<button id="btn-restart" class="hs-btn secondary" type="button">Restart' + keyHint('restart') + '</button>' +
    '<button id="btn-sound" class="hs-btn secondary" type="button" aria-pressed="' + (!muted) + '">Sound: ' +
    (muted ? 'off' : 'on') + '</button></div></aside>' +
    '<section class="hs-board-wrap"><p id="hs-status" class="hs-status" role="status">' + statusText + '</p>' +
    '<div class="hs-board" style="--cols:' + cfg.board.cols + ';--rows:' + cfg.board.rows + '">' + cells + '</div></section></section>' + terminal + '</main>';
  app().querySelectorAll('.hs-cell').forEach(function (button) {
    button.addEventListener('click', function () { chooseCell(Number(button.dataset.r), Number(button.dataset.c)); });
  });
  document.getElementById('btn-deliver').addEventListener('click', deliver);
  document.getElementById('btn-hint').addEventListener('click', showHint);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-sound').addEventListener('click', toggleSound);
  wireSettings();
  var again = document.getElementById('btn-again');
  if (again) { again.addEventListener('click', startGame); again.focus(); }
  else restoreFocus(key);
  if (pendingFx && window.HSGfx) window.HSGfx.events(pendingFx);
  pendingFx = null;
}

document.addEventListener('keydown', function (event) {
  if (!state || event.altKey || event.ctrlKey || event.metaKey) return;
  if (window.HSSettings && window.HSSettings.isOpen()) return;
  var k = actionFor(event.code);
  if (k === 'restart') { event.preventDefault(); startGame(); return; }
  if (state.terminal) return;
  if (k === 'deliver') { event.preventDefault(); deliver(); }
  else if (k === 'hint') { event.preventDefault(); showHint(); }
  else if (k === 'clear' && selected) {
    event.preventDefault();
    selected = null;
    statusText = 'Selection cleared.';
    renderGame();
  }
});

// ---------- player preferences mirrored to the StarHermit settings KV ----------
var lastGfx = window.HSGfx ? JSON.stringify(window.HSGfx.settings()) : null;
function pushSoundSettings() {
  if (P && window.HSSfx) P.patchSettings({ sfx: { volume: window.HSSfx.getVolume(), muted: window.HSSfx.isMuted() } });
}
if (window.HSGfx) {
  window.HSGfx.onChange(function () {
    var now = JSON.stringify(window.HSGfx.settings());
    if (now === lastGfx) return;
    lastGfx = now;
    if (P) P.patchSettings({ gfx: window.HSGfx.settings() });
  });
}
function applyRemoteSettings(s) {
  if (!s) return;
  if (s.sfx && window.HSSfx) {
    if (typeof s.sfx.volume === 'number') window.HSSfx.setVolume(s.sfx.volume);
    if (typeof s.sfx.muted === 'boolean') window.HSSfx.setMuted(s.sfx.muted);
  }
  if (s.gfx && typeof s.gfx === 'object' && window.HSGfx) {
    lastGfx = JSON.stringify(s.gfx);
    window.HSGfx.set(s.gfx);
  }
}

function rerender() { if (state) renderGame(); else showTitle(); }

if (P) {
  var wasOnline = P.isOnline();
  P.onUpdate(function () {
    if (wasOnline && !P.isOnline()) toast(t('signedOut'));
    wasOnline = P.isOnline();
    rerender();
  });
  P.loadBindings(DEFAULT_BINDINGS).then(function (b) { bindings = b; rerender(); });
  if (P.isOnline()) {
    P.getSettings().then(function (s) { applyRemoteSettings(s); rerender(); });
    P.loadCloudSave().then(function (remote) {
      if (mergeRemoteSave(remote)) persistSave();
      rerender();
    });
    P.refreshLeaderboard();
  }
}

showTitle();
})();
