// The scene around the board, ported from the browser build's 2D canvases
// (js/graphics.js there): a painted dusk harbor behind the UI — sky with
// stars, a low sun, a headland town with lit windows, a lighthouse whose beam
// sweeps and narrows as it turns, a sea with perspective wave lines and a
// sun-glitter path, two bobbing moored boats, drifting fog and rising embers —
// plus merge / deliver sparks over the board.
//
// The static parts (sky, stars, sun glow, sea, headlands, town, lighthouse,
// colour grade and vignette) are painted once per window size into a
// starhermit:canvas OffscreenCanvas and drawn as one image. The moving parts
// are drawn every frame with starhermit:draw primitives and small pre-painted
// sprites (fog, beam, halo): the engine rasterizes canvases on the CPU, and a
// full-window repaint costs tens of milliseconds a frame, where the GPU
// overlay draws these for nothing. The browser build's `lighter` blending
// is plain alpha blending here (the overlay has no additive mode).
//
// The effects follow the runtime's graphics tier (js/gfx.js) and the player's
// reduced motion (the backdrop drawn still, no particles).
import { frame, levels, levelSettings, preferences, type GraphicsLevel } from "starhermit:engine";
import { OffscreenCanvas } from "starhermit:canvas";
import * as draw from "starhermit:draw";
import { loadClassic } from "starhermit:script";

loadClassic("js/gfx.js");

interface Budget { panelBlur: boolean; waves: number; glitter: number; embers: number; sparks: number; sparkCap: number; sparkGlow: boolean }
export interface Quality {
  preset: "low" | "balanced" | "high" | "ultra";
  cap: number;
  background: "off" | "static" | "animated";
  detail: "plain" | "detailed";
  shadows: "off" | "low" | "high";
  bloom: "off" | "on";
  grade: "off" | "on";
  particles: "off" | "low" | "high";
  budget: Budget;
}
const Model = (globalThis as unknown as { HSGfxModel: { resolve(quality: string, k: number): Quality } }).HSGfxModel;

/** The level's speed over the slowest level of its tier (budgets scale ≤ 4× within a tier). */
function tierScale(level: GraphicsLevel): number {
  const mine = levelSettings(level);
  const floor = levels.map((l) => levelSettings(l)).find((s) => s.quality === mine.quality) ?? mine;
  return floor.teraflops > 0 ? mine.teraflops / floor.teraflops : 1;
}
let qKey = "";
let q: Quality = Model.resolve("balanced", 1);
/** The effects for this frame's graphics level. */
export function quality(): Quality {
  const f = frame();
  const key = `${f.quality}/${f.level}`;
  if (key !== qKey) { qKey = key; q = Model.resolve(f.quality, tierScale(f.level)); }
  return q;
}
export function reduced(): boolean { return preferences().reducedMotion; }
function animating(): boolean { return q.background === "animated" && !reduced(); }
function particlesOn(): boolean { return q.particles !== "off" && !reduced(); }

// -- Geometry (logical pixels: window pixels / frame().scale) ----------------
interface Geo { W: number; H: number; hz: number; sunX: number; lhX: number; lhY: number }
function geometry(W: number, H: number): Geo {
  const horizon = Math.round(H * (W < 700 ? 0.46 : 0.54));
  return { W, H, hz: horizon, sunX: W * 0.8, lhX: W * 0.9, lhY: horizon - Math.min(90, H * 0.12) };
}

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -- The static layer ----------------------------------------------------------
let layer: OffscreenCanvas | null = null;
let layerKey = "";
let wantKey = "";
let wantSince = 0;
let stars: { x: number; y: number; r: number; p: number }[] = [];

function buildLayer(g: Geo, ratio: number): OffscreenCanvas {
  const { W, H } = g;
  const c = new OffscreenCanvas(Math.max(1, Math.round(W * ratio)), Math.max(1, Math.round(H * ratio)));
  const x = c.getContext("2d", { alpha: false });
  x.setTransform(ratio, 0, 0, ratio, 0, 0);
  const rnd = rand(2204);

  const sky = x.createLinearGradient(0, 0, 0, g.hz);
  sky.addColorStop(0, "#0b0f1b");
  sky.addColorStop(0.5, "#161b33");
  sky.addColorStop(0.82, "#3a2a44");
  sky.addColorStop(1, "#8a4f3e");
  x.fillStyle = sky;
  x.fillRect(0, 0, W, g.hz + 1);

  // stars in the upper sky
  stars = [];
  for (let i = 0; i < Math.round(W * g.hz / 9000); i++) {
    stars.push({ x: rnd() * W, y: rnd() * g.hz * 0.6, r: 0.4 + rnd() * 0.9, p: rnd() * 6.28 });
  }
  for (const s of stars) {
    x.fillStyle = `rgba(245,239,230,${0.25 + 0.4 * (s.r - 0.4)})`;
    x.fillRect(s.x, s.y, s.r, s.r);
  }

  // low sun glow sitting on the horizon (right of centre, away from titles)
  const sun = x.createRadialGradient(g.sunX, g.hz, 0, g.sunX, g.hz, Math.max(W, H) * 0.45);
  sun.addColorStop(0, "rgba(255,184,77,0.55)");
  sun.addColorStop(0.18, "rgba(230,120,70,0.22)");
  sun.addColorStop(1, "rgba(230,120,70,0)");
  x.fillStyle = sun;
  x.fillRect(0, 0, W, g.hz + 1);

  // sea base
  const sea = x.createLinearGradient(0, g.hz, 0, H);
  sea.addColorStop(0, "#2a2a3c");
  sea.addColorStop(0.15, "#172033");
  sea.addColorStop(1, "#0a0e17");
  x.fillStyle = sea;
  x.fillRect(0, g.hz, W, H - g.hz);

  // far headland (left), town on it
  x.fillStyle = "#1b2033";
  x.beginPath();
  x.moveTo(0, g.hz);
  x.lineTo(0, g.hz - H * 0.07);
  x.bezierCurveTo(W * 0.12, g.hz - H * 0.11, W * 0.24, g.hz - H * 0.06, W * 0.38, g.hz - H * 0.015);
  x.lineTo(W * 0.42, g.hz);
  x.closePath();
  x.fill();
  let hx = 4;
  while (hx < W * 0.34) {
    const hw = 10 + rnd() * 16, hh = 10 + rnd() * 18;
    const base = g.hz - H * 0.05 * (1 - hx / (W * 0.4)) - 2;
    x.fillStyle = "#141828";
    x.fillRect(hx, base - hh, hw, hh + 4);
    x.beginPath();
    x.moveTo(hx - 2, base - hh);
    x.lineTo(hx + hw / 2, base - hh - 6 - rnd() * 5);
    x.lineTo(hx + hw + 2, base - hh);
    x.fill();
    if (rnd() < 0.7) {
      x.fillStyle = rnd() < 0.5 ? "rgba(255,184,77,0.85)" : "rgba(255,214,140,0.7)";
      x.fillRect(hx + hw * 0.3, base - hh * 0.6, 2.2, 2.6);
    }
    hx += hw + 2 + rnd() * 6;
  }

  // near headland (right) with the lighthouse
  x.fillStyle = "#121626";
  x.beginPath();
  x.moveTo(W, g.hz + 4);
  x.lineTo(W * 0.72, g.hz + 4);
  x.bezierCurveTo(W * 0.78, g.hz - H * 0.03, W * 0.84, g.hz - H * 0.05, g.lhX - 20, g.lhY + 40);
  x.lineTo(W, g.lhY + 30);
  x.closePath();
  x.fill();
  const tw = 9, th = g.hz - g.lhY - 20;
  const tower = x.createLinearGradient(g.lhX - tw, 0, g.lhX + tw, 0);
  tower.addColorStop(0, "#8d8a93");
  tower.addColorStop(1, "#3d3e4c");
  x.fillStyle = tower;
  x.beginPath();
  x.moveTo(g.lhX - tw, g.lhY + th);
  x.lineTo(g.lhX - tw * 0.65, g.lhY + 6);
  x.lineTo(g.lhX + tw * 0.65, g.lhY + 6);
  x.lineTo(g.lhX + tw, g.lhY + th);
  x.fill();
  x.fillStyle = "rgba(170,70,60,0.8)";
  x.fillRect(g.lhX - tw * 0.8, g.lhY + th * 0.45, tw * 1.6, 6);
  x.fillStyle = "#23263a";
  x.fillRect(g.lhX - 8, g.lhY - 2, 16, 8);
  x.beginPath();
  x.moveTo(g.lhX - 9, g.lhY - 8);
  x.lineTo(g.lhX, g.lhY - 16);
  x.lineTo(g.lhX + 9, g.lhY - 8);
  x.fill();

  if (q.grade === "on") {
    // Colour grade: warm the mids and deepen the shadows slightly; then the
    // vignette (the browser build's body::after overlay) behind the UI.
    x.save();
    x.globalCompositeOperation = "soft-light";
    x.fillStyle = "rgba(255,170,90,0.22)";
    x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "multiply";
    x.fillStyle = "rgb(236,232,240)";
    x.fillRect(0, 0, W, H);
    x.restore();
    x.save();
    x.translate(W / 2, H * 0.45);
    x.scale(W / 2, H * 0.55);
    const v = x.createRadialGradient(0, 0, 0, 0, 0, Math.SQRT2);
    v.addColorStop(0.38, "rgba(4,6,12,0)");
    v.addColorStop(1, "rgba(4,6,12,0.62)");
    x.fillStyle = v;
    x.fillRect(-1, -1 / 0.55 * 0.45 - 0.1, 2, 2 / 0.55 + 0.2);
    x.restore();
  }
  return c;
}

// -- Sprites ---------------------------------------------------------------------
let fogSprite: OffscreenCanvas | null = null;
let beamSprites: [OffscreenCanvas, OffscreenCanvas] | null = null;
let haloSprite: OffscreenCanvas | null = null;
const BEAM_APEX = 1 / 1.7;
function sprites(): void {
  if (fogSprite) return;
  fogSprite = new OffscreenCanvas(256, 32);
  const f = fogSprite.getContext("2d");
  f.setTransform(1, 0, 0, 32 / 256, 0, 0);
  const gr = f.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(180,190,210,0.09)");
  gr.addColorStop(1, "rgba(180,190,210,0)");
  f.fillStyle = gr;
  f.fillRect(0, 0, 256, 256);
  // The beam: a white triangle fading along its length; tinted when drawn.
  const beam = (dir: 1 | -1): OffscreenCanvas => {
    const c = new OffscreenCanvas(512, 128);
    const x = c.getContext("2d");
    const ax = dir > 0 ? 0 : 512, fx = dir > 0 ? 512 : 0;
    const g = x.createLinearGradient(ax, 0, fx, 0);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(ax, 128 * BEAM_APEX);
    x.lineTo(fx, 0);
    x.lineTo(fx, 128);
    x.closePath();
    x.fill();
    return c;
  };
  beamSprites = [beam(1), beam(-1)];
  haloSprite = new OffscreenCanvas(128, 128);
  const h = haloSprite.getContext("2d");
  const hg = h.createRadialGradient(64, 64, 0, 64, 64, 64);
  hg.addColorStop(0, "rgba(255,255,255,1)");
  hg.addColorStop(1, "rgba(255,255,255,0)");
  h.fillStyle = hg;
  h.fillRect(0, 0, 128, 128);
}

// -- Per frame ---------------------------------------------------------------------
let time = 0;
const embers: { x: number; y: number; v: number; p: number; r: number }[] = [];

/** Draws the backdrop (call first each frame, before the UI). */
export function drawBackdrop(dt: number): void {
  quality();
  time += dt;
  const { width, height, scale } = frame();
  if (width <= 0 || height <= 0) return;
  // The page's own background (body { background: #10141c }) under everything.
  draw.rect(0, 0, width, height, "#10141c");
  if (q.background === "off") return;
  const s = scale;
  const g = geometry(width / s, height / s);
  let ratio = Math.min(s, q.cap);
  ratio = Math.min(ratio, 4096 / Math.max(g.W, 1), 4096 / Math.max(g.H, 1), Math.sqrt(8_000_000 / Math.max(1, g.W * g.H)));
  const key = `${Math.round(g.W)}x${Math.round(g.H)}@${ratio.toFixed(3)}/${q.grade}`;
  // While the window is being resized, the old layer stretches until the size
  // holds for a quarter second (each repaint costs tens of milliseconds).
  if (key !== layerKey) {
    if (key !== wantKey) { wantKey = key; wantSince = time; }
    if (!layer || time - wantSince > 0.25) {
      try { layer = buildLayer(g, ratio); layerKey = key; } catch (e) { console.warn(`backdrop: ${String(e)}`); }
    }
  }
  sprites();
  if (layer) draw.image(layer, 0, 0, width, height);
  const t = animating() ? time : 12.5; // a fixed, pleasant moment when still
  const X = (v: number): number => v * s;

  // twinkling stars
  if (animating()) {
    for (let i = 0; i < stars.length; i += 3) {
      const st = stars[i]!;
      const a = 0.25 + 0.35 * Math.max(0, Math.sin(t * 1.3 + st.p));
      draw.rect(X(st.x), X(st.y), X(st.r + 0.3), X(st.r + 0.3), [245 / 255, 239 / 255, 230 / 255, a]);
    }
  }

  // wave lines with perspective spacing; they drift slowly
  const B = q.budget, rows = B.waves;
  const lw = Math.max(1, s);
  for (let row = 0; row < rows; row++) {
    const f = row / rows;
    const y = g.hz + 3 + Math.pow(f, 1.8) * (g.H - g.hz);
    const len = 14 + f * 70, gap = 26 + f * 120;
    const off = (t * (6 + f * 14) + row * 37) % gap;
    const col: [number, number, number, number] = [154 / 255, 167 / 255, 189 / 255, 0.07 + f * 0.1];
    for (let wx = -gap + off; wx < g.W; wx += gap) {
      const wy = y + Math.sin(t * 0.9 + wx * 0.02 + row) * (1 + f * 2);
      // the quadratic curve through its midpoint, as two segments
      const my = wy - (1.5 + f * 2) / 2;
      draw.line(X(wx), X(wy), X(wx + len / 2), X(my), col, lw);
      draw.line(X(wx + len / 2), X(my), X(wx + len), X(wy), col, lw);
    }
  }

  // sun glitter path on the water
  for (let k = 0, nk = B.glitter; k < nk; k++) {
    const fk = k / nk;
    const gy = g.hz + 2 + Math.pow(fk, 1.6) * (g.H - g.hz) * 0.8;
    const spread = 8 + fk * g.W * 0.12;
    const gx = g.sunX + Math.sin(k * 12.9898 + t * 0.7) * spread;
    const ga = (0.35 - fk * 0.3) * (0.55 + 0.45 * Math.sin(t * 3 + k * 1.7));
    if (ga <= 0.01) continue;
    draw.rect(X(gx), X(gy), X(6 + fk * 18), X(1 + fk * 1.5), [1, 196 / 255, 110 / 255, ga]);
  }

  // two moored boats bobbing
  drawBoat(X, g.W * 0.52, g.hz + (g.H - g.hz) * 0.12, 1, t, 0);
  drawBoat(X, g.W * 0.16, g.hz + (g.H - g.hz) * 0.3, 1.5, t, 2);

  // drifting fog bands
  for (let b = 0; b < 3; b++) {
    const fy = g.hz + (b - 1) * g.H * 0.05;
    const fxp = ((t * (4 + b * 3) + b * g.W * 0.4) % (g.W * 1.6)) - g.W * 0.3;
    draw.image(fogSprite!, X(fxp - g.W * 0.45), X(fy - g.W * 0.054), X(g.W * 0.9), X(g.W * 0.108));
  }

  // lighthouse beam: a slow sweep that narrows as it turns away
  const ang = t * 0.35;
  const face = Math.cos(ang);
  const dir = Math.sin(ang) >= 0 ? -1 : 1;
  const beamLen = g.W * 0.55;
  const beamW = 10 + Math.abs(face) * 34;
  const beamH = beamW * 1.7;
  const beamTop = g.lhY - 2 - beamH * BEAM_APEX;
  draw.image(beamSprites![dir > 0 ? 0 : 1], X(dir > 0 ? g.lhX : g.lhX - beamLen), X(beamTop), X(beamLen), X(beamH),
    { tint: [1, 220 / 255, 150 / 255, 0.1 + 0.18 * Math.abs(face)] });
  // lamp + bloom halo
  const lampA = 0.6 + 0.4 * Math.abs(face);
  if (q.bloom === "on") {
    draw.image(haloSprite!, X(g.lhX - 46), X(g.lhY + 1 - 46), X(92), X(92), { tint: [1, 214 / 255, 140 / 255, 0.55 * lampA] });
    draw.image(haloSprite!, X(g.sunX - 90), X(g.hz - 90), X(180), X(180), { tint: [1, 190 / 255, 110 / 255, 0.35] });
  }
  draw.rect(X(g.lhX - 5), X(g.lhY - 1), X(10), X(5), [1, 226 / 255, 160 / 255, lampA]);

  // drifting embers / fireflies over the water
  if (animating() && particlesOn()) drawEmbers(X, g, t, dt);
  else embers.length = 0;
}

function drawBoat(X: (v: number) => number, bx: number, by: number, sc: number, t: number, phase: number): void {
  const bob = animating() ? Math.sin(t * 1.1 + phase) * 1.5 * sc : 0;
  const tilt = animating() ? Math.sin(t * 0.8 + phase) * 0.03 : 0;
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  const P = (px: number, py: number): [number, number] => {
    const x = px * sc, y = py * sc;
    return [X(bx + x * cos - y * sin), X(by + bob + x * sin + y * cos)];
  };
  draw.polygon([P(-22, 0), P(22, 0), P(15, 7), P(-16, 7)], "#0d111c");
  draw.polygon([P(-1, -30), P(1, -30), P(1, 0), P(-1, 0)], "#0d111c");
  draw.polygon([P(1, -28), P(16, -3), P(1, -3)], "#1f2436");
  draw.polygon([P(-12, -4), P(-9.5, -4), P(-9.5, -1.5), P(-12, -1.5)], "rgba(255,184,77,0.9)");
  // reflection
  draw.rect(X(bx - 12 * sc), X(by + 9 * sc + bob), X(3 * sc), X(8 * sc), "rgba(255,184,77,0.12)");
}

function circle(x: number, y: number, r: number, color: readonly [number, number, number, number]): void {
  draw.roundRect(x - r, y - r, r * 2, r * 2, r, color);
}

function drawEmbers(X: (v: number) => number, g: Geo, t: number, dt: number): void {
  const want = q.particles === "high" ? q.budget.embers : Math.ceil(q.budget.embers / 2);
  while (embers.length < want) {
    embers.push({ x: Math.random() * g.W, y: g.hz + Math.random() * (g.H - g.hz), v: 4 + Math.random() * 8, p: Math.random() * 6.28, r: 0.8 + Math.random() * 1.4 });
  }
  if (embers.length > want) embers.length = want;
  for (const e of embers) {
    e.y -= e.v * dt;
    e.x += Math.sin(t * 0.6 + e.p) * 0.15;
    if (e.y < g.hz - g.H * 0.2) { e.y = g.H + 4; e.x = Math.random() * g.W; }
    const a = 0.25 + 0.35 * Math.max(0, Math.sin(t * 2 + e.p));
    circle(X(e.x), X(e.y), X(e.r), [1, 190 / 255, 100 / 255, a]);
  }
}

// -- Sparks over the board ---------------------------------------------------------
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; k: number; c: [number, number, number]; ring: boolean }
let sparks: Spark[] = [];
/** Window rectangles of the board's cells this frame (screens.ts fills it). */
export const cellRects = new Map<string, { x: number; y: number; width: number; height: number }>();
/** Chain colours (js/content.js), set by game.ts's caller. */
let chainColor: (chain: string) => number = () => 0xffb84d;
export function setChainColors(fn: (chain: string) => number): void { chainColor = fn; }
/** Bursts waiting for the cells' rectangles of the next frame. */
let pending: { kind: string; at: { r: number; c: number }; chain: string }[] = [];

function rgb(n: number): [number, number, number] { return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

function burst(kind: string, at: { r: number; c: number }, chain: string, k: number): void {
  const rect = cellRects.get(`${at.r},${at.c}`);
  if (!rect) return;
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  const B = q.budget;
  let n = (q.particles === "high" ? B.sparks : Math.ceil(B.sparks / 2)) * (kind === "task" ? 2 : 1);
  n = Math.max(0, Math.min(n, B.sparkCap - sparks.length));
  const col: [number, number, number] = kind === "merge" ? [1, 200 / 255, 110 / 255] : rgb(chainColor(chain));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = ((kind === "deliver" ? 40 : 90) + Math.random() * (kind === "task" ? 220 : 120)) * k;
    sparks.push({
      x: cx + Math.cos(a) * rect.width * 0.2, y: cy + Math.sin(a) * rect.height * 0.2,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === "merge" ? 40 : 110) * k,
      life: 0, max: 0.5 + Math.random() * 0.45, r: (1.2 + Math.random() * 2.2) * k, k,
      c: Math.random() < 0.3 ? [1, 236 / 255, 190 / 255] : col, ring: false,
    });
  }
  if (kind !== "merge") sparks.push({ ring: true, x: cx, y: cy, vx: 0, vy: 0, life: 0, max: 0.55, r: rect.width * 0.35, c: col, k });
}

/** Sparks for a batch of rules events (the cells' places are known next frame). */
export function events(list: readonly { type: string; [key: string]: unknown }[]): void {
  quality();
  if (!particlesOn()) return;
  for (const e of list) {
    if (e.type === "merge") pending.push({ kind: "merge", at: e.to as { r: number; c: number }, chain: String(e.chain) });
    else if (e.type === "deliver") pending.push({ kind: "deliver", at: e.at as { r: number; c: number }, chain: String(e.chain) });
  }
  const done = list.filter((e) => e.type === "task-complete").length;
  const d = list.find((e) => e.type === "deliver");
  if (done && d) pending.push({ kind: "task", at: d.at as { r: number; c: number }, chain: String(d.chain) });
}

/** Draws the sparks (from a widget built over the board, so they draw above it). */
export function drawSparks(dt: number, uiScale: number): void {
  if (!particlesOn()) { sparks = []; pending = []; return; }
  // Window pixels per CSS pixel of the browser build: sparks grow with the
  // interface size, as they grew with its zoomed UI.
  const k = uiScale;
  for (const p of pending) burst(p.kind, p.at, p.chain, k);
  pending = [];
  if (!sparks.length) return;
  const glow = q.bloom === "on" && q.budget.sparkGlow;
  sparks = sparks.filter((p) => {
    p.life += dt;
    if (p.life >= p.max) return false;
    const kk = 1 - p.life / p.max;
    if (p.ring) {
      const r = p.r * (1 + (1 - kk) * 1.2);
      draw.strokeRoundRect(p.x - r, p.y - r, r * 2, r * 2, r, [p.c[0], p.c[1], p.c[2], 0.6 * kk], (2 + 3 * kk) * p.k);
      return true;
    }
    p.vy += 160 * p.k * dt;
    p.vx *= 1 - 1.8 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (glow) circle(p.x, p.y, p.r * 3, [p.c[0], p.c[1], p.c[2], 0.18 * kk]);
    circle(p.x, p.y, p.r * (0.6 + 0.4 * kk), [p.c[0], p.c[1], p.c[2], 0.9 * kk]);
    return true;
  });
}
