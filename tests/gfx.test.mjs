// Graphics quality model (js/gfx.js): the runtime's tier picks the effects,
// Low is the flat look, budgets grow with the tier and scale ≤ 4× within it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './load.mjs';

const Model = loadClassic('gfx.js').HSGfxModel;

test('each runtime tier maps to its row; unknown tiers are balanced', () => {
  assert.equal(Model.resolve('low').background, 'off');
  assert.equal(Model.resolve('low').particles, 'off');
  assert.equal(Model.resolve('low').detail, 'plain');
  assert.equal(Model.resolve('balanced').background, 'static');
  assert.equal(Model.resolve('high').background, 'animated');
  assert.equal(Model.resolve('ultra').bloom, 'on');
  assert.equal(Model.resolve('nonsense').preset, 'balanced');
});

test('budgets grow with the tier', () => {
  const keys = ['waves', 'glitter', 'embers', 'sparks', 'sparkCap'];
  for (let i = 1; i < Model.PRESETS.length; i++) {
    const a = Model.resolve(Model.PRESETS[i - 1]).budget, b = Model.resolve(Model.PRESETS[i]).budget;
    for (const k of keys) assert.ok(b[k] >= a[k], `${Model.PRESETS[i]} ${k}`);
  }
  assert.equal(Model.resolve('high').budget.panelBlur, true);
  assert.equal(Model.resolve('balanced').budget.panelBlur, false);
});

test('a faster level scales the particle counts, at most 4× and within the caps', () => {
  const base = Model.budgetFor('high', 1), fast = Model.budgetFor('high', 2), huge = Model.budgetFor('ultra', 100);
  assert.equal(fast.embers, base.embers * 2);
  assert.equal(fast.sparkCap, base.sparkCap * 2);
  assert.ok(huge.embers <= 160 && huge.sparks <= 60);
  assert.equal(huge.sparkCap, Model.BUDGETS.ultra.sparkCap * 4);
  assert.deepEqual(Model.budgetFor('low', 0.5), Model.budgetFor('low', 1)); // never below the tuned budget
});
