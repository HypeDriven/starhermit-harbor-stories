/* Harbor Stories — graphics quality model (pure: no DOM, no canvas).
 * Presets, per-category overrides, GPU detection and a cost summary, shared by
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

  /** Best preset for this GPU, from the WebGL unmasked renderer string (null/'' = unknown). */
  function detectPreset(gpu, mobile) {
    var g = String(gpu || '').toLowerCase();
    var tier;
    if (!g) tier = 'low'; // no hardware WebGL at all
    else if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(g)) tier = 'low';
    else if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|amd radeon(?!.*graphics)|apple m\d/.test(g)) tier = 'high';
    else tier = 'balanced';
    // Phones and tablets: Auto never goes above Balanced (battery, heat).
    if (mobile && PRESETS.indexOf(tier) > PRESETS.indexOf('balanced')) tier = 'balanced';
    return tier;
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
  function resolve(saved, detected) {
    var s = saved || {};
    var auto = PRESETS.indexOf(s.preset) < 0;
    var preset = auto ? (PRESETS.indexOf(detected) >= 0 ? detected : 'balanced') : s.preset;
    var row = TABLE[preset];
    var out = { preset: preset, auto: auto, renderScale: clampScale(s.render_scale), cap: row.cap };
    out.scale = row.scale * out.renderScale / 100;
    Object.keys(CATEGORIES).forEach(function (cat) {
      out[cat] = CATEGORIES[cat].indexOf(s[cat]) >= 0 ? s[cat] : row[cat];
    });
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
    PRESETS: PRESETS, CATEGORIES: CATEGORIES, TABLE: TABLE,
    detectPreset: detectPreset, resolve: resolve, presetTier: presetTier,
    choosePreset: choosePreset, setOverride: setOverride, clampScale: clampScale, describe: describe
  };
});
