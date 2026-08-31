/* Harbor Stories — SFX module.
 * Authored one-shots (sfx/<name>.opus, see sfx/manifest.json) played through
 * a single WebAudio effects bus, with synthesized fallbacks while a sample is
 * still loading or unavailable. The context is created/resumed only from a
 * user gesture (unlock()). Browser global: window.HSSfx.
 */
(function () {
'use strict';

var SAMPLE_BASE = 'sfx/';
var STORAGE_KEY = 'hs-sfx';

// ---------- event map: event name -> authored sample + synth fallback ----------
// Events mirror the rules-engine result events (js/rules.js applyCommand) and
// the UI handlers in js/main.js. Every manifest basename appears here.
var EVENTS = {
  'ui-start':      { sample: 'ui-start',      synth: synthUiStart },
  'move':          { sample: 'tool-move',     synth: synthMove },
  'merge':         { sample: 'tool-merge',    synth: synthMerge },
  'deliver':       { sample: 'deliver',       synth: synthDeliver },
  'task-complete': { sample: 'task-complete', synth: synthTaskComplete },
  'spawn':         { sample: 'tide-spawn',    synth: synthSpawn },
  'round':         { sample: 'round-advance', synth: synthRound },
  'tasks-new':     { sample: 'tasks-new',     synth: synthTasksNew },
  'win':           { sample: 'win',           synth: synthWin },
  'lose':          { sample: 'lose',          synth: synthLose },
  'invalid':       { sample: 'invalid-move',  synth: synthInvalid },
  'resign':        { sample: 'resign',        synth: synthResign }
};

// ---------- module state ----------
var ctx = null;        // AudioContext, created on unlock()
var bus = null;        // effects bus: GainNode -> destination
var volume = 0.8;
var muted = false;
var buffers = {};      // sample name -> AudioBuffer | null (failed)
var pending = {};      // sample name -> in-flight decode Promise
var lastPlayed = {};   // event name -> ctx.currentTime of last start

try {
  var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved) {
    if (typeof saved.volume === 'number') volume = Math.min(1, Math.max(0, saved.volume));
    if (typeof saved.muted === 'boolean') muted = saved.muted;
  }
} catch (e) { /* storage unavailable */ }

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: volume, muted: muted }));
  } catch (e) { /* storage unavailable */ }
}

function applyBusGain() {
  if (bus) bus.gain.value = muted ? 0 : volume;
}

// ---------- unlock (call from a user gesture) ----------
function unlock() {
  if (!ctx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    bus = ctx.createGain();
    bus.connect(ctx.destination);
    applyBusGain();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// ---------- sample loading: lazy fetch/decode/cache ----------
function loadSample(name) {
  if (Object.prototype.hasOwnProperty.call(buffers, name)) return;
  if (pending[name]) return;
  pending[name] = window.fetch(SAMPLE_BASE + name + '.opus')
    .then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.arrayBuffer();
    })
    .then(function (data) { return ctx.decodeAudioData(data); })
    .then(function (buf) { buffers[name] = buf; })
    .catch(function () { buffers[name] = null; })
    .then(function () { delete pending[name]; });
}

// ---------- playback ----------
function playBuffer(buf) {
  var src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(bus);
  src.start();
}

function play(event) {
  var def = EVENTS[event];
  if (!def || !ctx || ctx.state !== 'running') return;
  // no duplicate playback of the same event inside one tick
  var now = ctx.currentTime;
  if (lastPlayed[event] !== undefined && now - lastPlayed[event] < 0.05) return;
  lastPlayed[event] = now;

  var buf = buffers[def.sample];
  if (buf) { playBuffer(buf); return; }        // prefer the authored sample
  if (buf === undefined) loadSample(def.sample); // kick off lazy load
  def.synth();                                   // fallback while loading/failed
}

// Convenience named methods, one per event.
var api = {
  unlock: unlock,
  play: play,
  setVolume: function (v) { volume = Math.min(1, Math.max(0, v)); applyBusGain(); persist(); },
  setMuted: function (m) { muted = !!m; applyBusGain(); persist(); },
  toggleMute: function () { api.setMuted(!muted); return muted; },
  isMuted: function () { return muted; },
  getVolume: function () { return volume; }
};
Object.keys(EVENTS).forEach(function (event) {
  var method = event.replace(/-([a-z])/g, function (_, ch) { return ch.toUpperCase(); });
  api[method] = function () { play(event); };
});
window.HSSfx = api;

// ---------- synthesized fallbacks ----------
function tone(opts) {
  var t0 = ctx.currentTime + (opts.at || 0);
  var osc = ctx.createOscillator();
  var g = ctx.createGain();
  osc.type = opts.type || 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t0 + opts.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain || 0.2, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(g).connect(bus);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

function knock(at, gain, cutoff) {
  var t0 = ctx.currentTime + (at || 0);
  var len = Math.floor(ctx.sampleRate * 0.09);
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.12));
  var src = ctx.createBufferSource();
  src.buffer = buf;
  var f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff || 900;
  var g = ctx.createGain();
  g.gain.value = gain || 0.25;
  src.connect(f).connect(g).connect(bus);
  src.start(t0);
}

function synthUiStart() {
  knock(0, 0.2, 1200);
  tone({ freq: 880, dur: 0.18, type: 'triangle', gain: 0.12, at: 0.06 });
}
function synthMove() {
  knock(0, 0.18, 700);
  knock(0.07, 0.1, 500);
}
function synthMerge() {
  knock(0, 0.25, 1000);
  tone({ freq: 660, slide: 1320, dur: 0.16, type: 'triangle', gain: 0.14, at: 0.05 });
}
function synthDeliver() {
  knock(0, 0.28, 600);
  tone({ freq: 1175, dur: 0.22, type: 'sine', gain: 0.12, at: 0.08 });
}
function synthTaskComplete() {
  tone({ freq: 784, dur: 0.25, type: 'sine', gain: 0.14 });
  tone({ freq: 1047, dur: 0.4, type: 'sine', gain: 0.14, at: 0.18 });
}
function synthSpawn() {
  knock(0, 0.15, 2400);
  tone({ freq: 300, slide: 180, dur: 0.14, type: 'sine', gain: 0.12, at: 0.05 });
}
function synthRound() {
  tone({ freq: 196, dur: 0.5, type: 'triangle', gain: 0.12 });
  tone({ freq: 294, dur: 0.4, type: 'triangle', gain: 0.1, at: 0.2 });
}
function synthTasksNew() {
  knock(0, 0.12, 3000);
  knock(0.08, 0.12, 3000);
  tone({ freq: 988, dur: 0.12, type: 'sine', gain: 0.08, at: 0.14 });
}
function synthWin() {
  var seq = [523, 659, 784, 1047];
  for (var i = 0; i < seq.length; i++) {
    tone({ freq: seq[i], dur: 0.3, type: 'triangle', gain: 0.13, at: i * 0.14 });
  }
}
function synthLose() {
  tone({ freq: 220, slide: 110, dur: 0.9, type: 'sine', gain: 0.14 });
  knock(0.3, 0.1, 400);
}
function synthInvalid() {
  tone({ freq: 160, dur: 0.12, type: 'square', gain: 0.07 });
  knock(0, 0.12, 500);
}
function synthResign() {
  tone({ freq: 700, slide: 350, dur: 0.5, type: 'sine', gain: 0.1 });
  knock(0.5, 0.12, 800);
}

})();
