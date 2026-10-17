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
// js/gpu-level.js is a classic script in the page that defines window.StarHermitGpu.
new Function('window', readFileSync(path.join(ROOT, 'js', 'gpu-level.js'), 'utf8'))(gameRoot);
new Function('self', readFileSync(path.join(ROOT, 'js', 'gfx.js'), 'utf8')).call(gameRoot, gameRoot);
const G = gameRoot.HSGfxModel;

const DESK = { cores: 8, memoryGb: 8 };
const PHONE = { mobile: true, cores: 8, memoryGb: 8 };

test('hardware level picks the Auto preset (Low 0, Balanced 4, High 10, Ultra 17)', () => {
  assert.equal(G.detectPreset('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', DESK), 'low');
  assert.equal(G.detectLevel('llvmpipe (LLVM 15.0.7, 256 bits)', DESK), 0);
  assert.equal(G.detectPreset('', DESK), 'low', 'no hardware WebGL');
  assert.equal(G.detectPreset('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', DESK), 'low');
  assert.equal(G.detectPreset('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', DESK), 'low');
  assert.equal(G.detectPreset('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)', DESK), 'balanced');
  assert.equal(G.detectPreset('ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0)', DESK), 'high');
  assert.equal(G.detectPreset('ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0)', DESK), 'ultra');
  assert.equal(G.detectLevel('ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 Direct3D11 vs_5_0 ps_5_0)', DESK), 20);
  assert.equal(G.detectPreset('ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 Direct3D11 vs_5_0 ps_5_0)', DESK), 'ultra');
  for (const [p, lv] of Object.entries(G.LEVELS)) assert.equal(G.presetForLevel(lv), p);
  assert.equal(G.presetForLevel(3), 'low');
  assert.equal(G.presetForLevel(16), 'high');
});

test('phones and tablets are Balanced at most; software GPUs stay Low', () => {
  assert.equal(G.detectPreset('Adreno (TM) 740', PHONE), 'balanced');
  assert.ok(G.detectLevel('Adreno (TM) 740', PHONE) <= 9);
  assert.equal(G.detectPreset('NVIDIA GeForce RTX 5090', PHONE), 'balanced');
  assert.equal(G.detectPreset('SwiftShader', PHONE), 'low');
});

test('per-preset budgets are explicit, grow from Low to Ultra and scale with the level', () => {
  const P = G.PRESETS, B = G.BUDGETS;
  const keys = ['panelBlur', 'bgHz', 'waves', 'glitter', 'embers', 'sparks', 'sparkCap', 'sparkGlow'];
  for (const p of P) for (const k of keys) assert.ok(B[p][k] != null, `${p}.${k}`);
  for (let i = 1; i < P.length; i++) for (const k of keys) if (typeof B.low[k] === 'number') assert.ok(B[P[i]][k] >= B[P[i - 1]][k], `${P[i]}.${k}`);
  assert.deepEqual(P.map((p) => B[p].panelBlur), [false, false, true, true], 'backdrop blur only on High/Ultra');
  assert.deepEqual(G.resolve({ preset: 'high' }, 'low', 10).budget, B.high, 'floor level = the tuned budget');
  assert.deepEqual(G.resolve({ preset: 'ultra' }, 'low', 0).budget, G.resolve({ preset: 'ultra' }, 'ultra', 17).budget, 'manual Ultra on a weak GPU keeps the Ultra floor budget');
  const b4 = G.budgetFor('balanced', 4), b9 = G.budgetFor('balanced', 9);
  assert.ok(b9.embers > b4.embers && b9.sparks > b4.sparks, 'counts scale up within the preset');
  assert.ok(G.budgetFor('ultra', 20).sparkCap <= B.ultra.sparkCap * 4);
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
