// The two screens and the results card, built each frame with starhermit:ui
// in the browser build's layout: the title (key art, name, tagline, best
// score, player chip, Play / Settings / Invite / Sign in, the leaderboard)
// and the game (header with the stage and the Moves · Score pill, the task
// rail with its actions, the status line and the board), plus the results
// card over the board and a toast. Layout by window size replaces the CSS
// media queries: narrow (≤ 700 logical px) stacks the header and puts the
// board above the tasks with the tile names hidden; short landscape
// (≤ 500 px tall) compacts everything so the board, tasks and actions stay
// co-visible.
import { frame, openMenu } from "starhermit:engine";
import * as draw from "starhermit:draw";
import * as ui from "starhermit:ui";
import { bindingLabel } from "starhermit:input";
import { player, requestSignIn } from "starhermit:platform";
import { cellRects, drawSparks, quality } from "./backdrop.js";
import * as game from "./game.js";
import { T } from "./i18n.js";
import { EMOJI, icon } from "./icons.js";
import { avatarCanvas, copyInvite, leaderboardRows } from "./online.js";
import { syncStatus } from "./save.js";
import { isMuted, toggleMute } from "./sfx.js";
import { applyVariants, tileClass } from "./style.js";

// -- Toast --------------------------------------------------------------------------
let toastText: string | null = null;
let toastUntil = 0;
export function toast(text: string): void {
  toastText = text;
  toastUntil = frame().time + 3.5;
  ui.announce(text);
}

// -- Helpers ------------------------------------------------------------------------
interface View { w: number; h: number; narrow: boolean; short: boolean; s: number }
function view(): View {
  const { width, height, safeArea } = frame();
  const s = ui.preferences().scale;
  const w = (width - safeArea.left - safeArea.right) / s;
  const h = (height - safeArea.top - safeArea.bottom) / s;
  return { w, h, s, narrow: w <= 700, short: h <= 500 && w > h };
}
function clamp(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)); }

/** A translated template (T without vars) with its {placeholders} in bold, as the browser
 * build's <b> markup: "Moves **8** · Score **550**". */
function rich(label: string, template: string, vars: Record<string, string | number>, style: string[]): void {
  const parts = template.split(/(\{\w+\})/).filter((p) => p !== "");
  ui.row(label, () => {
    parts.forEach((p, i) => {
      const m = /^\{(\w+)\}$/.exec(p);
      if (m && m[1]! in vars) ui.id(`${label}-${i}`).label(String(vars[m[1]!]), { weight: "700" });
      else if (p.trim()) ui.id(`${label}-${i}`).label(p.trim()); // labels drop edge spaces: the row's spacing stands for them
    });
  }, { style, spacing: 4, align: "center" });
}

interface Btn { id: string; text: string; secondary?: boolean; small?: boolean; kbd?: string; selected?: boolean; act: () => void }
/** Buttons in rows that wrap at `width` (CSS flex-wrap), each activating `act`. */
function buttons(label: string, list: Btn[], width: number, spacing: number, justify: ui.Align): void {
  const s = ui.preferences().scale;
  const widthOf = (b: Btn): number => {
    const style = ["hs-btn", b.secondary && "hs-btn.secondary", b.small && "hs-btn-small"].filter(Boolean) as string[];
    let w = ui.measureText(b.text, { kind: "button", style }).width / s;
    if (b.kbd) w += ui.measureText(b.kbd, { style: "hs-kbd" }).width / s + 6 + 12;
    return w + 2;
  };
  const rows: Btn[][] = [[]];
  let used = 0;
  for (const b of list) {
    const bw = widthOf(b);
    if (rows.at(-1)!.length && used + spacing + bw > width) { rows.push([]); used = 0; }
    used += (rows.at(-1)!.length ? spacing : 0) + bw;
    rows.at(-1)!.push(b);
  }
  ui.column(label, () => {
    rows.forEach((row, ri) => ui.row(`${label}-r${ri}`, () => {
      for (const b of row) {
        const style = ["hs-btn", b.secondary ? "hs-btn.secondary" : null, b.small ? "hs-btn-small" : null, b.secondary ? "v-btn-secondary" : "v-btn"];
        const kbd = b.kbd;
        const opts: ui.ButtonOptions = { ...(b.selected !== undefined ? { selected: b.selected } : {}) };
        if (kbd) {
          opts.content = () => ui.row(`${b.id}-face`, () => {
            ui.label(b.text);
            ui.style("hs-kbd").label(kbd);
          }, { spacing: 6, align: "center" });
        }
        if (ui.style(...style).id(b.id).button(b.text, opts)) b.act();
      }
    }, { spacing, justify, align: "center" }));
  }, { spacing, align: justify === "center" ? "center" : "start" });
}

function playerChip(): void {
  const me = player();
  if (!me) return;
  const labels: Record<string, string> = { loading: T("Loading…"), saving: T("Saving…"), synced: T("Synced"), error: T("Sync error"), offline: T("Offline") };
  const sync = syncStatus();
  ui.row("player", () => {
    const pic = avatarCanvas();
    if (pic) {
      ui.widget("", {
        role: "image", size: { width: 22, height: 22 },
        draw: (r) => { draw.image(pic, r.x, r.y, r.width, r.height); },
      });
    }
    ui.widget("", { role: "none", size: { width: 9, height: 9 }, style: ["hs-sync-dot", `hs-sync-${sync}`] });
    ui.id("player-name").label(me.displayName || T("Player"), { weight: "600", color: "#f5efe6" });
    ui.id("player-sync").label(labels[sync] ?? sync);
  }, { style: ["hs-player", "v-chip"], spacing: 8, align: "center" });
}

let signingIn = false;
function signIn(): void {
  if (signingIn) return;
  signingIn = true;
  requestSignIn().then(() => { signingIn = false; }, () => { signingIn = false; });
}

// -- The title screen -----------------------------------------------------------------
let titleHeight = 0;
let lastArtH = 0;
function titleScreen(v: View): void {
  const best = game.bestScore();
  const compact = v.narrow || v.short;
  const padV = v.short ? 10 : v.narrow ? 24 : 48, padH = v.narrow || v.short ? 16 : 24;
  const width = Math.min(900, v.w);
  const inner = width - padH * 2;
  const artW = Math.min(inner, 760);
  // The key art gives way first, so Play stays above the fold on short
  // windows (the browser build did this below 500 px; here at any height).
  const natural = artW * 672 / 1200;
  const artH = clamp(v.h - (titleHeight - lastArtH), Math.min(natural, v.h * 0.3), natural);
  lastArtH = artH;
  const top = Math.max(0, (v.h - titleHeight) / 2);
  ui.column("title-page", () => {
    if (top > 1) ui.widget("", { role: "none", size: { width: 1, height: top } });
    const r = ui.style("hs-title-screen", "v-title-screen").column("title", () => {
      ui.widget("", { role: "image", size: { width: Math.min(artW, artH * 1200 / 672 * 1.25), height: artH }, style: ["hs-key-art", "v-key-art", "hs-fade-in"] });
      // 56 px, clamp(38px, 12vw, 56px) on phones, and never wider than the page
      // (system fonts differ in width: measured, as labels do not wrap)
      let titleSize = v.short ? 32 : compact ? clamp(v.w * 0.12, 38, 56) : 56;
      const titleW = ui.measureText("Harbor Stories", { style: ["hs-title-name", { text: { size: titleSize } }] }).width / v.s;
      if (titleW > inner) titleSize = Math.max(20, titleSize * inner / titleW * 0.98);
      ui.style("hs-title-name", "v-title", { text: { size: titleSize } }).label("Harbor Stories");
      ui.style("hs-tagline").paragraph(T("Merge tool chains, repair the coast, and reveal stories around Brinemist Quay."), Math.min(inner, 42 * 18));
      if (best) rich("best", T("Best score {score}"), { score: best }, ["hs-best"]);
      playerChip();
      const list: Btn[] = [{ id: "btn-start", text: T("Play"), act: game.startGame }];
      list.push({ id: "btn-settings", text: T("Settings"), secondary: true, act: openMenu });
      if (player()) list.push({ id: "btn-invite", text: T("Invite a friend"), secondary: true, act: () => toast(copyInvite()) });
      else list.push({ id: "btn-signin", text: T("Sign in with StarHermit"), secondary: true, act: signIn });
      buttons("title-actions", list, inner, 10, "center");
      leaderboard(Math.min(400, inner));
    }, { width, padding: { top: padV, bottom: padV, start: padH, end: padH }, spacing: v.short ? 6 : 14, align: "center" });
    titleHeight = r.height / v.s;
  }, { width: v.w, align: "center" });
}

function leaderboard(width: number): void {
  const rows = leaderboardRows();
  if (!rows || !rows.length) return;
  ui.column("lb", () => {
    ui.style("hs-lb-title").heading(T("Harbor leaderboard"));
    rows.forEach((e, i) => {
      ui.style("hs-lb-row", e.mine && "hs-lb-row.mine").row(`lb-${i}`, () => {
        ui.id(`lb-${i}-name`).label(`${i + 1}. ${e.name}`);
        ui.spacer();
        ui.style("hs-lb-score").id(`lb-${i}-score`).label(String(e.score));
      }, { width, spacing: 12, align: "center" });
    });
  }, { spacing: 6, align: "center" });
}

// -- The game screen --------------------------------------------------------------------
function header(v: View, width: number): void {
  const st = game.state!;
  const tools = (): void => { ui.row("header-tools", () => {
    rich("score", T("Moves {moves} · Score {score}"), { moves: st.moves, score: st.score.total }, ["hs-score", "v-chip"]);
    if (ui.style("hs-btn", "hs-btn.secondary", "hs-btn-small", "v-btn-secondary").id("btn-settings").button(T("Settings"))) openMenu();
  }, { spacing: 8, align: "center" }); };
  const titles = (): void => { ui.column("header-titles", () => {
    ui.style("hs-header-title", "v-title", "v-on-scene", v.short && { text: { size: 16 } }).label("Harbor Stories");
    if (st.cfg.name) ui.style("hs-header-sub", "v-on-scene").label(T(st.cfg.name));
  }, { spacing: 2 }); };
  if (v.narrow) {
    ui.column("header", () => {
      titles();
      tools();
      playerChip();
    }, { width, spacing: 8 });
  } else {
    ui.row("header", () => {
      titles();
      ui.spacer();
      tools();
      playerChip();
    }, { width, spacing: v.short ? 8 : 16, align: "center" });
  }
}

function tasks(width: number, v: View): void {
  const st = game.state!;
  ui.column("tasks", () => {
    st.tasks.forEach((task, i) => {
      const reqs = task.reqs.map((req, k) => `${game.itemLabel(req.chain, req.tier)} ${task.got[k]}/${req.count}`).join(" · ");
      ui.style("hs-task", "v-task", task.done && "hs-task.done", task.done && "v-task-done").column(`task-${i}`, () => {
        ui.style("hs-task-name", v.short && { text: { size: 13 } }).id(`task-${i}-name`).paragraph(T(task.label), width - 26);
        ui.style("hs-task-reqs", v.short && { text: { size: 12 } }).id(`task-${i}-reqs`).paragraph(reqs, width - 26);
      }, { width, padding: v.short ? { top: 5, bottom: 5, start: 8, end: 8 } : 10, spacing: v.short ? 2 : 4 });
    });
  }, { spacing: v.short ? 4 : 10 });
}

function actions(width: number, v: View): void {
  const muted = isMuted();
  const kbd = (a: string): string | undefined => (v.narrow ? undefined : keyLabel(bindingLabel(a, "keyboard")) || undefined);
  const list: Btn[] = [
    { id: "btn-deliver", text: T("Deliver selected"), small: true, act: game.deliver },
    { id: "btn-hint", text: T("Hint"), secondary: true, small: true, act: game.showHint },
    { id: "btn-restart", text: T("Restart"), secondary: true, small: true, act: game.startGame },
    { id: "btn-sound", text: muted ? T("Sound: off") : T("Sound: on"), secondary: true, small: true, selected: !muted, act: () => game.soundStatus(toggleMute()) },
  ];
  for (const b of list) {
    const k = b.id === "btn-deliver" ? kbd("deliver") : b.id === "btn-hint" ? kbd("hint") : b.id === "btn-restart" ? kbd("restart") : undefined;
    if (k) b.kbd = k;
  }
  buttons("actions", list, width, v.short ? 4 : 8, "start");
}

/** A key's label for the <kbd> hint: the runtime's, with a code (KeyD) shortened as the browser build did. */
function keyLabel(label: string): string {
  // (natively without a keyboard layout the runtime answers the code, KeyD;
  // browsers answer the layout's character, d)
  if (/^Key[A-Z]$/.test(label)) return label.slice(3);
  if ([...label].length === 1) return label.toUpperCase();
  if (/^Digit\d$/.test(label)) return label.slice(5);
  if (label === "Escape") return "Esc";
  return label.replace(/^Arrow/, "");
}

function aside(width: number, v: View): void {
  const pad = v.short ? 8 : 16;
  ui.style("hs-panel", "v-panel").column("aside", () => {
    ui.style("hs-panel-title", v.short && { text: { size: 16 } }).heading(T("Restoration tasks"));
    tasks(width - pad * 2, v);
    actions(width - pad * 2, v);
  }, { width, padding: pad, spacing: v.short ? 6 : 16 });
}

function boardPanel(width: number, v: View, boardMax: number): void {
  const st = game.state!;
  const { rows, cols } = st.cfg.board;
  const pad = v.short ? 8 : 16;
  const inner = width - pad * 2;
  const vw = frame().width / v.s;
  const gap = v.short ? 4 : clamp(vw * 0.01, 5, 10);
  const bpad = v.short ? 5 : v.narrow ? 6 : clamp(vw * 0.01, 6, 12);
  const boardW = Math.max(120, Math.min(inner, boardMax));
  const cell = Math.max(24, (boardW - bpad * 2 - gap * (cols - 1)) / cols);
  const names = !(v.narrow || v.short);
  ui.style("hs-panel", "v-panel").column("board-wrap", () => {
    ui.style("hs-status", v.short && { text: { size: 13 } }).id("status").paragraph(game.status(), inner);
    ui.column("board-center", () => {
      ui.style("hs-board", "v-board").grid("board", () => {
        cellRects.clear();
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) boardCell(r, c, cell, names, vw);
      }, { columns: Array.from({ length: cols }, () => cell), gap, padding: bpad });
    }, { width: inner, align: "center" });
  }, { width, padding: pad, spacing: v.short ? 4 : 12 });
}

function boardCell(r: number, c: number, size: number, names: boolean, vw: number): void {
  const st = game.state!;
  const item = st.board[r]![c] ?? null;
  const sel = game.isSelected(r, c);
  const name = game.itemName(item);
  const q = quality();
  const res = ui.id(`cell-${r}-${c}`).widget(T("Row {r}, column {c}: {item}", { r: r + 1, c: c + 1, item: name }), {
    role: "toggle", checked: sel, size: { width: size, height: size },
    style: ["hs-cell", item && "hs-cell.occupied", sel && "hs-cell.selected", tileClass(item?.c ?? null, item?.t ?? 0, sel)].filter(Boolean) as string[],
    draw: (rect, state) => {
      cellRects.set(`${r},${c}`, rect);
      const s = state.scale;
      const textScale = ui.preferences().textScale;
      // the glyph at the browser build's clamp(20px, 3.4vw, 38px), within the
      // cell; the name below it gets smaller when two lines would not fit
      // (with the names hidden on small windows the glyph takes their room)
      const iconPx = names ? Math.min(clamp(vw * 0.034, 20, 38) * s, rect.width * 0.58, rect.height * 0.5) : rect.width * 0.5;
      const nameMax = rect.width - 10 * s;
      const room = rect.height - iconPx - 12 * s;
      let nameSize = clamp(vw * 0.012, 9, 13) * s * textScale;
      let nameH = 0;
      if (names) {
        for (let i = 0; i < 6; i++) {
          nameH = draw.measureText(name, { size: nameSize, maxWidth: nameMax }).height;
          if (nameH <= room || nameSize <= 9 * s * textScale) break;
          nameSize = Math.max(9 * s * textScale, nameSize * 0.9);
        }
      }
      const total = (item ? iconPx : nameSize * 1.4) + (names ? 4 * s + nameH : 0);
      let y = rect.y + (rect.height - total) / 2;
      const color = state.colors.text;
      if (item) {
        const g = icon(item.c);
        let dy = 0;
        if (sel && q.detail === "detailed" && !state.reducedMotion) dy = -3 * s * (1 - Math.cos(frame().time * Math.PI * 2 / 1.6)) / 2;
        const ix = rect.x + (rect.width - iconPx) / 2, iy = y + dy;
        const emoji = EMOJI[item.c];
        if (emoji) {
          if (q.bloom === "on" && item.c === "lantern" && !state.highContrast) {
            const glow = icon("glow");
            if (glow) draw.image(glow.image, ix - iconPx * 0.3, iy - iconPx * 0.3, iconPx * 1.6, iconPx * 1.6, { source: glow.source, tint: [1, 0.75, 0.35, 0.8] });
          }
          const es = iconPx;
          draw.text(emoji, ix + iconPx / 2, iy + (iconPx - es * 1.2) / 2, { size: es, align: "center" });
        } else if (g) {
          if (q.bloom === "on" && item.c === "lantern" && !state.highContrast) {
            const glow = icon("glow");
            if (glow) draw.image(glow.image, ix - iconPx * 0.3, iy - iconPx * 0.3, iconPx * 1.6, iconPx * 1.6, { source: glow.source, tint: [1, 0.75, 0.35, 0.8] });
          }
          if (q.shadows === "high") draw.image(g.image, ix, iy + 2 * s, iconPx, iconPx, { source: g.source, tint: [0, 0, 0, 0.45] });
          draw.image(g.image, ix, iy, iconPx, iconPx, { source: g.source });
        }
        // the tier badge: the persistent tier distinction, visible even when names are hidden
        const badge = String(item.t + 1);
        const bs = (names ? 11 : 10) * s * textScale;
        const tw = draw.measureText(badge, { size: bs, weight: "700" }).width;
        const bh = bs + (names ? 4 : 2) * s, bw = Math.max(tw + (names ? 10 : 8) * s, bh);
        const bx = ix + iconPx - bw + iconPx * 0.12, by = iy + iconPx - bh + iconPx * 0.08;
        draw.box(bx, by, bw, bh, ["hs-tier", "v-tier"]);
        draw.text(badge, bx + bw / 2, by + (bh - bs * 1.2) / 2, { size: bs, weight: "700", color: state.highContrast ? state.colors.text : "#111a29", align: "center" });
        y += iconPx;
      } else {
        draw.text("·", rect.x + rect.width / 2, y, { size: nameSize * 1.4, color, align: "center" });
        y += nameSize * 1.4;
      }
      if (names) draw.text(name, rect.x + rect.width / 2, y + 4 * s, { size: nameSize, color, align: "center", maxWidth: nameMax });
    },
  });
  if (res.activated) game.chooseCell(r, c);
}

function gameScreen(v: View): void {
  const pad = clamp(v.w * 0.02, 12, 28) * (v.short ? 0.5 : 1);
  const width = Math.min(1280, v.w) - pad * 2;
  ui.column("game-page", () => {
    ui.column("game", () => {
      header(v, width);
      const st = game.state!;
      const { rows, cols } = st.cfg.board;
      if (v.narrow) {
        boardPanel(width, v, width);
        aside(width, v);
      } else {
        const gap = v.short ? 8 : 16;
        const share = v.short ? 0.6 / 2.6 : 0.7 / 2.7;
        const asideW = Math.max(v.short ? 200 : 230, (width - gap) * share);
        const boardW = width - gap - asideW;
        const fit = (v.h - (v.short ? 120 : 210)) * cols / rows;
        ui.row("layout", () => {
          aside(asideW, v);
          boardPanel(boardW, v, fit);
        }, { spacing: gap, align: "start" });
      }
    }, { width, padding: { top: pad, bottom: pad }, spacing: v.short ? 4 : 16 });
  }, { width: v.w, align: "center" });
}

let wasTerminal = false;
function resultsCard(v: View): void {
  const st = game.state;
  const term = st?.terminal ?? null;
  if (!st || !term) { wasTerminal = false; return; }
  if (!wasTerminal) { ui.setFocus("btn-again"); wasTerminal = true; }
  const width = Math.min(v.w * 0.92, 520);
  const inner = width - 40;
  const best = game.bestScore();
  const lb = game.leaderboardLine();
  // The card's own heading sits under the illustration, as before; the
  // dialog's title stays empty (its name for screen readers is the label).
  ui.dialog(term.won ? T("Harbor restored!") : T("Round over"), "", true, () => {
    ui.column("results-body", () => {
      ui.widget("", { role: "image", size: { width: inner, height: Math.min(inner * 400 / 640, v.h * 0.34) }, style: ["hs-result-art", term.won ? "hs-result-won" : "hs-result-lost", "hs-fade-in"] });
      ui.style("hs-terminal-title", "hs-wide").heading(term.won ? T("Harbor restored!") : T("Round over"));
      ui.style("hs-terminal-score", "hs-wide").label(T("Score {score}", { score: st.score.total }));
      if (best) ui.style("hs-best", "hs-wide").label(T("Best {best}", { best }));
      if (lb) ui.style("hs-lb-line").id("lb-line").paragraph(lb, inner);
      if (ui.style("hs-btn", "v-btn", "hs-wide").id("btn-again").button(T("Play again"))) game.startGame();
    }, { width: inner, spacing: 8, align: "stretch" });
  });
}

// -- The frame ---------------------------------------------------------------------------
/** Builds this frame's UI (from onUpdate, so a press's frame may sign in or copy). */
export function buildUi(dt: number): void {
  applyVariants();
  const v = view();
  const { width, height, safeArea } = frame();
  ui.area({ x: safeArea.left, y: safeArea.top, width: width - safeArea.left - safeArea.right, height: height - safeArea.top - safeArea.bottom }, () => {
    ui.scrollArea(game.state ? "game-scroll" : "title-scroll", { width: v.w, height: v.h }, () => {
      if (game.state) gameScreen(v); else titleScreen(v);
    });
  });
  // The sparks over the board, above the panels (a widget built after them draws over them).
  ui.place("fx", "top-start", () => {
    // No size: a placed widget takes the pointer over its rectangle (1.16), and
    // its draw callback still paints the whole window, so the sparks cover
    // the board without taking the clicks under them.
    ui.widget("", { role: "none", size: { width: 0, height: 0 }, draw: () => drawSparks(dt, v.s) });
  });
  resultsCard(v);
  if (toastText && frame().time > toastUntil) toastText = null;
  if (toastText) {
    const text = toastText;
    ui.place("toast", { anchor: "bottom", y: 16 }, () => {
      ui.style("hs-toast").paragraph(text, Math.min(v.w - 32, 560));
    });
  }
}
