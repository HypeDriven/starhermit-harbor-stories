/* Harbor Stories — graphics quality model (pure: no canvas, no engine).
 * The runtime's Options › Graphics picks the level (Auto from the GPU, or one
 * of ten); its quality tier (`frame().quality`: low, balanced, high, ultra)
 * selects one row of effects here, and the level's speed within the tier
 * scales the particle counts (src/backdrop.ts). Gameplay is identical on every
 * tier — only visuals change. UMD: globalThis.HSGfxModel and Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HSGfxModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRESETS = ['low', 'balanced', 'high', 'ultra'];

  // Effects per tier. Low is the original flat look (no backdrop, no particles).
  //   background  off | static (painted once) | animated (waves, beam, fog, boats move)
  //   detail      plain | detailed (water cells, chain-tinted bevelled tiles, glass panels)
  //   shadows     off | low | high   (tile / panel / glyph drop shadows)
  //   bloom       off | on           (glow on lights, selection, masterworks)
  //   grade       off | on           (backdrop colour grade + vignette)
  //   particles   off | low | high   (merge / deliver sparks, drifting embers)
  //   cap         device-pixel-ratio cap of the painted backdrop
  var TABLE = {
    low:      { cap: 1,   background: 'off',      detail: 'plain',    shadows: 'off',  bloom: 'off', grade: 'off', particles: 'off' },
    balanced: { cap: 1.5, background: 'static',   detail: 'detailed', shadows: 'low',  bloom: 'on',  grade: 'on',  particles: 'low' },
    high:     { cap: 2,   background: 'animated', detail: 'detailed', shadows: 'high', bloom: 'on',  grade: 'on',  particles: 'high' },
    ultra:    { cap: 2,   background: 'animated', detail: 'detailed', shadows: 'high', bloom: 'on',  grade: 'on',  particles: 'high' }
  };

  /*
   * Per-tier budget of the backdrop and the particles.
   *   panelBlur  frosted (backdrop blur) side panel and board frame over the backdrop
   *   waves      wave-line rows on the sea; glitter = sun-glitter flecks
   *   embers     drifting embers over the water (Particles low: half)
   *   sparks     sparks per merge burst (Particles low: half; task bursts ×2)
   *   sparkCap   live-spark cap; sparkGlow = soft glow disc behind each spark (with Glow on)
   */
  var BUDGETS = {
    low:      { panelBlur: false, waves: 12, glitter: 20, embers: 8,  sparks: 10, sparkCap: 80,  sparkGlow: false },
    balanced: { panelBlur: false, waves: 18, glitter: 30, embers: 16, sparks: 16, sparkCap: 140, sparkGlow: true },
    high:     { panelBlur: true,  waves: 26, glitter: 44, embers: 36, sparks: 26, sparkCap: 260, sparkGlow: true },
    ultra:    { panelBlur: true,  waves: 34, glitter: 60, embers: 60, sparks: 34, sparkCap: 400, sparkGlow: true }
  };
  var EMBER_MAX = 160, SPARK_MAX = 60;

  /** A tier's budget, its counts scaled by `k` (the level's speed over the
   * tier's slowest level, at most 4×). */
  function budgetFor(preset, k) {
    var b = Object.assign({}, BUDGETS[preset] || BUDGETS.balanced);
    var s = Math.max(1, Math.min(4, isFinite(k) ? Number(k) : 1));
    b.embers = Math.min(EMBER_MAX, Math.round(b.embers * s));
    b.sparks = Math.min(SPARK_MAX, Math.round(b.sparks * s));
    b.sparkCap = Math.round(b.sparkCap * s);
    return b;
  }

  /** The effects of a quality tier (an unknown one is balanced), with its budget. */
  function resolve(quality, k) {
    var preset = PRESETS.indexOf(quality) >= 0 ? quality : 'balanced';
    var out = Object.assign({ preset: preset }, TABLE[preset]);
    out.budget = budgetFor(preset, k);
    return out;
  }

  return { PRESETS: PRESETS, TABLE: TABLE, BUDGETS: BUDGETS, budgetFor: budgetFor, resolve: resolve };
});
