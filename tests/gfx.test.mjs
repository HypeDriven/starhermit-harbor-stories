/**
 * Harbor Stories — graphics quality model tests (js/gfx.js, pure).
 * Runs with `npm test` alongside the rules tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gameRoot = {};
new Function('self', readFileSync(path.join(ROOT, 'js', 'gfx.js'), 'utf8')).call(gameRoot, gameRoot);
const G = gameRoot.HSGfxModel;

test('detectPreset maps GPU strings to presets', () => {
  assert.equal(G.detectPreset('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'), 'low');
  assert.equal(G.detectPreset('llvmpipe (LLVM 15.0.7, 256 bits)'), 'low');
  assert.equal(G.detectPreset(''), 'low');
  assert.equal(G.detectPreset('ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)'), 'high');
  assert.equal(G.detectPreset('Apple M2'), 'high');
  assert.equal(G.detectPreset('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)'), 'balanced');
  assert.equal(G.detectPreset('Adreno (TM) 730'), 'balanced');
  assert.equal(G.detectPreset('AMD Radeon Graphics'), 'balanced');
});

test('Auto is capped at Balanced on mobile devices', () => {
  assert.equal(G.detectPreset('Apple M2', true), 'balanced');
  assert.equal(G.detectPreset('SwiftShader', true), 'low');
});

test('resolve: auto uses the detected preset, explicit preset wins, overrides apply', () => {
  const auto = G.resolve({}, 'high');
  assert.equal(auto.preset, 'high');
  assert.equal(auto.auto, true);
  assert.equal(auto.background, 'animated');
  assert.equal(auto.adaptive, true);
  assert.equal(auto.showFps, false);
  const low = G.resolve({ preset: 'low' }, 'high');
  assert.equal(low.auto, false);
  for (const cat of Object.keys(G.CATEGORIES)) assert.equal(low[cat], G.presetTier('low', cat));
  const o = G.resolve({ preset: 'low', bloom: 'on', particles: 'bogus' }, 'high');
  assert.equal(o.bloom, 'on');
  assert.equal(o.particles, 'off', 'invalid override falls back to the preset');
  assert.equal(G.resolve({}, undefined).preset, 'balanced');
});

test('resolve clamps render scale to 50–200% and multiplies the preset scale', () => {
  assert.equal(G.resolve({ preset: 'high', render_scale: 10 }).renderScale, 50);
  assert.equal(G.resolve({ preset: 'high', render_scale: 900 }).renderScale, 200);
  assert.equal(G.resolve({ preset: 'high', render_scale: 'x' }).renderScale, 100);
  assert.equal(G.resolve({ preset: 'high', render_scale: 150 }).scale, 1.5);
  assert.equal(G.resolve({ preset: 'ultra', render_scale: 200 }).scale, 2.5);
  assert.equal(G.resolve({ preset: 'low' }).cap, 1);
  assert.equal(G.resolve({ preset: 'high' }).cap, 2);
});

test('choosing a preset clears overrides but keeps scale and toggles', () => {
  const s = G.setOverride({ preset: 'high', render_scale: 80, show_fps: true, adaptive: false }, 'shadows', 'off');
  assert.equal(s.shadows, 'off');
  const next = G.choosePreset(s, 'ultra');
  assert.deepEqual(next, { preset: 'ultra', render_scale: 80, adaptive: false, show_fps: true });
  assert.equal(G.resolve(next).shadows, 'high');
  assert.equal(G.setOverride({ shadows: 'off' }, 'shadows', 'preset').shadows, undefined);
  assert.equal(G.choosePreset({}, 'nonsense').preset, 'auto');
});

test('describe summarises the cost with pixel size', () => {
  const text = G.describe(G.resolve({ preset: 'high' }), [2560, 1600]);
  assert.match(text, /animated harbor/);
  assert.match(text, /soft shadows/);
  assert.match(text, /2560×1600 px$/);
  assert.equal(G.describe(G.resolve({ preset: 'low' })), 'no backdrop · flat tiles');
});
