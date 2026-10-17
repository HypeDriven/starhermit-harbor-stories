/* Harbor Stories — graphics quality model (pure: no DOM, no canvas).
 * Presets, per-category overrides, hardware-level detection, per-preset budgets and a cost summary, shared by
 * the renderer (js/graphics.js), the Settings panel (js/settings.js) and the
 * unit tests. Modelled on root-and-ruin's web/gfx.js. UMD: window.HSGfxModel. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HSGfxModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRESETS = ['low', 'balanced', 'high', 'ultra'];

  // Category -> allowed tiers, cheapest first. Only effects this DOM game has.
  var CATEGORIES = {
    background: ['off', 'static', 'animated'], // painted harbor backdrop canvas
    detail: ['plain', 'detailed'],             // bevelled, chain-tinted tiles, water cells, glass panels
    shadows: ['off', 'low', 'high'],           // tile / panel / glyph drop shadows
    bloom: ['off', 'on'],                      // glow on lights, selection, masterworks
    grade: ['off', 'on'],                      // backdrop colour grade + vignette
    particles: ['off', 'low', 'high']          // merge / deliver sparks, drifting embers
  };

  // Each preset: a row of tiers, a render scale and a device-pixel-ratio cap.
  // Low is the original flat look, so it costs no more than the game did before.
  var TABLE = {
    low:      { scale: 1,    cap: 1,   background: 'off',      detail: 'plain',    shadows: 'off',  bloom: 'off', grade: 'off', particles: 'off' },
    balanced: { scale: 1,    cap: 1.5, background: 'static',   detail: 'detailed', shadows: 'low',  bloom: 'on',  grade: 'on',  particles: 'low' },
    high:     { scale: 1,    cap: 2,   background: 'animated', detail: 'detailed', shadows: 'high', bloom: 'on',  grade: 'on',  particles: 'high' },
    ultra:    { scale: 1.25, cap: 2,   background: 'animated', detail: 'detailed', shadows: 'high', bloom: 'on',  grade: 'on',  particles: 'high' }
  };

  // Auto picks the preset from the StarHermit hardware level (0 = Galaxy S20 / Intel UHD or weaker, 20 =
  // RTX 5090; js/gpu-level.js → window.StarHermitGpu): Low from 0, Balanced from 4, High from 10, Ultra
  // from 17. Phones, tablets and ≤ 4 GB machines are capped at level 9 (Balanced); no hardware WebGL or a
  // software renderer is level 0.
  var LEVELS = { low: 0, balanced: 4, high: 10, ultra: 17 };
  function gpuApi() { return (typeof self !== 'undefined' ? self : globalThis).StarHermitGpu; }

  /** Hardware level (0–20) for an unmasked renderer string plus StarHermitGpu.detectSystem() facts. */
  function detectLevel(gpu, system) {
    var G = gpuApi();
    var sys = Object.assign({ webgl: !!gpu, webgl2: true }, system || {}, { gpu: String(gpu || '') });
    if (!gpu) sys.webgl = false; // no hardware WebGL at all
    return G ? G.detectLevel(sys) : (gpu ? LEVELS.balanced : 0);
  }

  /** The preset Auto starts from for a hardware level. */
  function presetForLevel(level) {
    var G = gpuApi();
    if (G) return G.presetForLevel(level, LEVELS);
    return level >= 17 ? 'ultra' : level >= 10 ? 'high' : level >= 4 ? 'balanced' : 'low';
  }

  /** Best preset for this GPU (the hardware level already caps phones/tablets at Balanced). */
  function detectPreset(gpu, system) {
    return presetForLevel(detectLevel(gpu, system));
  }

  /*
   * Per-preset budget for the painted backdrop and the particle canvas. Each preset holds 60 FPS on the
   * weakest GPU Auto gives it (Low → level 0, Balanced → 4, High → 10, Ultra → 17; tests/gfx-bench.mjs).
   * Gameplay is identical on every preset — only visuals change.
   *   panelBlur  frosted (backdrop-filter) side panel and board frame over the backdrop — re-composited
   *              every time the animated backdrop redraws, so only High/Ultra get it
   *   bgHz       animated-backdrop redraw rate (the rest of the frames reuse the last paint)
   *   waves      wave-line rows on the sea; glitter = sun-glitter flecks
   *   embers     drifting embers over the water at the floor level (Particles low: half)
   *   sparks     sparks per merge burst at the floor level (Particles low: half; deliveries ×2)
   *   sparkCap   live-spark cap; sparkGlow = soft glow disc behind each spark (with Glow on)
   */
  var BUDGETS = {
    low:      { panelBlur: false, bgHz: 20, waves: 12, glitter: 20, embers: 8,  sparks: 10, sparkCap: 80,  sparkGlow: false },
    balanced: { panelBlur: false, bgHz: 24, waves: 18, glitter: 30, embers: 16, sparks: 16, sparkCap: 140, sparkGlow: true },
    high:     { panelBlur: true,  bgHz: 30, waves: 26, glitter: 44, embers: 36, sparks: 26, sparkCap: 260, sparkGlow: true },
    ultra:    { panelBlur: true,  bgHz: 60, waves: 34, glitter: 60, embers: 60, sparks: 34, sparkCap: 400, sparkGlow: true }
  };
  var EMBER_MAX = 160, SPARK_MAX = 60;

  /** A preset's concrete budget for a hardware level (counts scale ≤ 4× within the preset). */
  function budgetFor(preset, level) {
    var b = Object.assign({}, BUDGETS[preset] || BUDGETS.balanced);
    var G = gpuApi(), floor = LEVELS[preset] || 0;
    var lv = Math.max(isFinite(level) ? Number(level) : floor, floor);
    var k = G ? G.scaleBudget(1, lv, floor) : 1;
    b.embers = Math.min(EMBER_MAX, Math.round(b.embers * k));
    b.sparks = Math.min(SPARK_MAX, Math.round(b.sparks * k));
    b.sparkCap = Math.round(b.sparkCap * k);
    return b;
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /** Clamp a render-scale percentage (50–200, default 100). */
  function clampScale(pct) {
    var n = Number(pct);
    return isFinite(n) && n > 0 ? clamp(Math.round(n), 50, 200) : 100;
  }

  /**
   * Resolve saved settings into concrete tiers.
   * saved: { preset: 'auto'|preset, render_scale (%), adaptive, show_fps, <category>: 'preset'|tier }
   */
  function resolve(saved, detected, level) {
    var s = saved || {};
    var auto = PRESETS.indexOf(s.preset) < 0;
    var preset = auto ? (PRESETS.indexOf(detected) >= 0 ? detected : 'balanced') : s.preset;
    var row = TABLE[preset];
    var out = { preset: preset, auto: auto, renderScale: clampScale(s.render_scale), cap: row.cap };
    out.scale = row.scale * out.renderScale / 100;
    Object.keys(CATEGORIES).forEach(function (cat) {
      out[cat] = CATEGORIES[cat].indexOf(s[cat]) >= 0 ? s[cat] : row[cat];
    });
    out.level = isFinite(level) && level !== null ? Number(level) : LEVELS[preset];
    out.budget = budgetFor(preset, out.level);
    out.adaptive = s.adaptive !== false;
    out.showFps = !!s.show_fps;
    return out;
  }

  /** The preset's own tier for a category (for "From preset (…)" labels). */
  function presetTier(preset, cat) {
    return TABLE[preset] ? TABLE[preset][cat] : undefined;
  }

  /** Choosing a preset clears every per-category override; scale and toggles stay. */
  function choosePreset(saved, preset) {
    var s = saved || {};
    var out = { preset: PRESETS.indexOf(preset) >= 0 ? preset : 'auto' };
    if (s.render_scale != null) out.render_scale = clampScale(s.render_scale);
    if (s.adaptive === false) out.adaptive = false;
    if (s.show_fps) out.show_fps = true;
    return out;
  }

  /** Set one category override ('preset' removes it). */
  function setOverride(saved, cat, tier) {
    var out = Object.assign({}, saved || {});
    if (!CATEGORIES[cat]) return out;
    if (CATEGORIES[cat].indexOf(tier) >= 0) out[cat] = tier; else delete out[cat];
    return out;
  }

  var EN = {
    background: { off: 'no backdrop', 'static': 'still harbor', animated: 'animated harbor' },
    detail: { plain: 'flat tiles', detailed: 'detailed tiles' },
    shadows: { off: null, low: 'shadows', high: 'soft shadows' },
    bloom: { off: null, on: 'glow' },
    grade: { off: null, on: 'grade' },
    particles: { off: null, low: 'few particles', high: 'particles' }
  };

  /** Cost summary, e.g. "animated harbor · detailed tiles · soft shadows · glow · 2560×1600 px". */
  function describe(r, pixels, labels) {
    var L = labels || EN;
    var parts = Object.keys(CATEGORIES).map(function (cat) {
      return L[cat] ? L[cat][r[cat]] : null;
    });
    if (pixels) parts.push(pixels[0] + '×' + pixels[1] + ' px');
    return parts.filter(Boolean).join(' · ');
  }

  return {
    PRESETS: PRESETS, CATEGORIES: CATEGORIES, TABLE: TABLE, LEVELS: LEVELS, BUDGETS: BUDGETS,
    detectLevel: detectLevel, presetForLevel: presetForLevel, budgetFor: budgetFor,
    detectPreset: detectPreset, resolve: resolve, presetTier: presetTier,
    choosePreset: choosePreset, setOverride: setOverride, clampScale: clampScale, describe: describe
  };
});
