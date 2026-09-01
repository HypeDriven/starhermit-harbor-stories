/* Harbor Stories — responsive browser entry point. */
(function () {
'use strict';

var Rules = window.HSRules;
var Content = window.HSContent;
var state = null;
var selected = null;
var startedAt = 0;
var statusText = '';

function app() { return document.getElementById('app'); }
function loc(r, c) { return { r: r, c: c }; }
function same(a, b) { return a && b && a.r === b.r && a.c === b.c; }
function itemAt(p) { return state && state.board[p.r][p.c]; }
function itemName(item) { return item ? Content.itemLabel(item.c, item.t) : 'Open water'; }
function icon(item) { return item ? Content.CHAINS[item.c].icon : '·'; }

function showTitle() {
  app().innerHTML = '<main class="hs-app"><section class="hs-title-screen">' +
    '<h1 class="hs-title-name">Harbor Stories</h1>' +
    '<p class="hs-tagline">Merge tool chains, repair the coast, and reveal stories around Brinemist Quay.</p>' +
    '<button id="btn-start" class="hs-btn" type="button">Play</button></section></main>';
  document.getElementById('btn-start').addEventListener('click', startGame);
}

function startGame() {
  if (window.HSSfx) { window.HSSfx.unlock(); window.HSSfx.uiStart(); }
  state = Rules.createGame(Content.JOURNEY[0]);
  selected = null;
  startedAt = performance.now();
  statusText = Content.JOURNEY[0].intro || 'Select a tool, then an open or matching adjacent cell.';
  renderGame();
}

function apply(command) {
  command.atMs = performance.now() - startedAt;
  var result = Rules.applyCommand(state, command);
  if (!result.ok) {
    statusText = String(result.reason || 'That action is not available.').replace(/-/g, ' ');
    if (window.HSSfx) window.HSSfx.invalid();
    return false;
  }
  state = result.state;
  result.events.forEach(function (event) {
    if (window.HSSfx && typeof window.HSSfx[event.type] === 'function') window.HSSfx[event.type]();
  });
  var latest = result.events[result.events.length - 1];
  statusText = latest ? latest.type.replace(/-/g, ' ') : 'Move complete';
  selected = null;
  return true;
}

function chooseCell(r, c) {
  if (state.terminal) return;
  var target = loc(r, c);
  var item = itemAt(target);
  if (!selected) {
    if (!item) { statusText = 'Choose a tool first.'; renderGame(); return; }
    selected = target;
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
  if (!selected) { statusText = 'Select a requested tool before delivering.'; renderGame(); return; }
  apply({ type: 'deliver', at: selected });
  renderGame();
}

function showHint() {
  var h = Rules.hint(state);
  if (!h) statusText = 'No legal action is available.';
  else if (h.type === 'deliver') statusText = 'Hint: deliver ' + itemName(h.item) + '.';
  else statusText = 'Hint: ' + h.type + ' from row ' + (h.from.r + 1) + ', column ' + (h.from.c + 1) +
    ' to row ' + (h.to.r + 1) + ', column ' + (h.to.c + 1) + '.';
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

function renderGame() {
  var cfg = state.cfg;
  var cells = '';
  for (var r = 0; r < cfg.board.rows; r++) for (var c = 0; c < cfg.board.cols; c++) {
    var item = state.board[r][c];
    var isSelected = same(selected, loc(r, c));
    cells += '<button class="hs-cell' + (item ? ' occupied' : '') + (isSelected ? ' selected' : '') +
      '" data-r="' + r + '" data-c="' + c + '" type="button" aria-pressed="' + isSelected +
      '" aria-label="Row ' + (r + 1) + ', column ' + (c + 1) + ': ' + itemName(item) + '">' +
      '<span class="hs-icon" aria-hidden="true">' + icon(item) + '</span><span>' + itemName(item) + '</span></button>';
  }
  var terminal = state.terminal ? '<div class="hs-terminal" role="dialog"><h2>' +
    (state.terminal.won ? 'Harbor restored!' : 'Round over') + '</h2><p>Score ' + state.score.total + '</p>' +
    '<button id="btn-again" class="hs-btn" type="button">Play again</button></div>' : '';
  app().innerHTML = '<main class="hs-game"><header><div><h1>Harbor Stories</h1><p>First Light Repairs</p></div>' +
    '<div class="hs-score">Moves <b>' + state.moves + '</b> · Score <b>' + state.score.total + '</b></div></header>' +
    '<section class="hs-layout"><aside><h2>Restoration tasks</h2><ul class="hs-tasks">' + renderTasks() + '</ul>' +
    '<div class="hs-actions"><button id="btn-deliver" class="hs-btn" type="button">Deliver selected</button>' +
    '<button id="btn-hint" class="hs-btn secondary" type="button">Hint</button></div></aside>' +
    '<section class="hs-board-wrap"><p id="hs-status" class="hs-status" role="status">' + statusText + '</p>' +
    '<div class="hs-board" style="--cols:' + cfg.board.cols + '">' + cells + '</div></section></section>' + terminal + '</main>';
  app().querySelectorAll('.hs-cell').forEach(function (button) {
    button.addEventListener('click', function () { chooseCell(Number(button.dataset.r), Number(button.dataset.c)); });
  });
  document.getElementById('btn-deliver').addEventListener('click', deliver);
  document.getElementById('btn-hint').addEventListener('click', showHint);
  var again = document.getElementById('btn-again'); if (again) again.addEventListener('click', startGame);
}

showTitle();
})();
