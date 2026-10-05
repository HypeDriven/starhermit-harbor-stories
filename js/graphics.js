/* Harbor Stories — graphics renderer: window.HSGfx.
 * The game board is DOM; this module adds the optional "scene" around it:
 *  - #hs-gfx-bg  : a painted dusk-harbor backdrop canvas (sky, headlands with a
 *                  lighthouse, lit town, sea with wave lines and sun glitter,
 *                  boats, drifting fog, embers), with a colour-grade + vignette pass
 *                  and glow (bloom) on light sources;
 *  - #hs-gfx-fx  : a transparent particle canvas for merge / deliver sparks;
 *  - body[data-gfx-*] attributes that switch the CSS tile / shadow / glow styling.
 * Settings come from js/gfx.js (pure model) and persist in localStorage['hs-gfx'].
 * Nothing here ever logs to the console; if a canvas cannot be used the game is
 * drawn without the scene and the Settings panel says so. */
(function () {
'use strict';

var Model = window.HSGfxModel;
var KEY = 'hs-gfx';
var listeners = [];
var saved = loadSaved();
var gpu = detectGpu();
var mobile = isMobile();
var detected = Model.detectPreset(gpu, mobile);
var q = Model.resolve(saved, detected);
var reducedMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
var failed = false;
var bg = null, bgCtx = null, fx = null, fxCtx = null, fpsEl = null;
var layer = null;          // cached static layer (sky, land, town, vignette base)
var ratio = 1, adaptiveScale = 1, cssW = 0, cssH = 0;
var frames = [], fps = 0, lastT = 0, raf = 0, time = 0;
var particles = [];
var lastDraw = 0;
var embers = [];
var seedStars = null;

function loadSaved() {
  try {
    var v = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    return v && typeof v === 'object' ? v : {};
  } catch (e) { return {}; }
}
function persist() {
  try { window.localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* storage unavailable */ }
}

// Unmasked WebGL renderer string. failIfMajorPerformanceCaveat keeps software
// fallbacks from being created at all (they resolve to Low without logging).
function detectGpu() {
  try {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return '';
    var name = '';
    // Firefox already reports the unmasked name in RENDERER and warns about the extension.
    if (!/firefox/i.test(navigator.userAgent)) {
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) name = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    }
    if (!name) name = gl.getParameter(gl.RENDERER);
    var lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return String(name || '');
  } catch (e) { return ''; }
}

function isMobile() {
  var ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return true;
  try {
    return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
  } catch (e) { return false; }
}

function reduced() { return !!(reducedMq && reducedMq.matches); }
function animating() { return !failed && q.background === 'animated' && !reduced(); }
function particlesOn() { return !failed && q.particles !== 'off' && !reduced(); }

// ---------- setup ----------
function ensureCanvases() {
  if (failed) return;
  try {
    if (!bg) {
      bg = document.createElement('canvas');
      bg.id = 'hs-gfx-bg';
      bg.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(bg, document.body.firstChild);
      bgCtx = bg.getContext('2d', { alpha: false });
      if (!bgCtx) throw new Error('no 2d');
    }
    if (!fx) {
      fx = document.createElement('canvas');
      fx.id = 'hs-gfx-fx';
      fx.setAttribute('aria-hidden', 'true');
      document.body.appendChild(fx);
      fxCtx = fx.getContext('2d');
      if (!fxCtx) throw new Error('no 2d');
    }
  } catch (e) { fail(); }
}

function fail() {
  failed = true;
  if (bg && bg.parentNode) bg.parentNode.removeChild(bg);
  if (fx && fx.parentNode) fx.parentNode.removeChild(fx);
  bg = fx = bgCtx = fxCtx = layer = null;
  particles.length = 0;
  document.body.setAttribute('data-gfx-background', 'off');
}

function pixelRatio() {
  var dpr = window.devicePixelRatio || 1;
  var r = Math.min(dpr, q.cap) * q.scale * adaptiveScale;
  return Math.max(0.25, Math.min(3, r));
}

function resize(force) {
  if (failed || !bg) return;
  var w = window.innerWidth, h = window.innerHeight, r = pixelRatio();
  // Keep the backing store within common canvas limits.
  r = Math.min(r, 4096 / Math.max(w, 1), 4096 / Math.max(h, 1));
  if (!force && w === cssW && h === cssH && r === ratio) return;
  cssW = w; cssH = h; ratio = r;
  var pw = Math.max(1, Math.round(w * r)), ph = Math.max(1, Math.round(h * r));
  if (q.background !== 'off') { bg.width = pw; bg.height = ph; } else { bg.width = 1; bg.height = 1; }
  fx.width = q.particles !== 'off' ? pw : 1;
  fx.height = q.particles !== 'off' ? ph : 1;
  layer = null;
  drawBackdrop();
}

// ---------- backdrop ----------
function rand(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function geometry() {
  var W = cssW, H = cssH;
  var horizon = Math.round(H * (W < 700 ? 0.46 : 0.54));
  return { W: W, H: H, hz: horizon, sunX: W * 0.8, lhX: W * 0.9, lhY: horizon - Math.min(90, H * 0.12) };
}

// Static layer: sky, stars, sun glow, headlands, lighthouse tower, town, sea base.
function buildLayer() {
  var g = geometry(), W = g.W, H = g.H;
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * ratio));
  c.height = Math.max(1, Math.round(H * ratio));
  var x = c.getContext('2d');
  x.setTransform(ratio, 0, 0, ratio, 0, 0);
  var rnd = rand(2204);

  var sky = x.createLinearGradient(0, 0, 0, g.hz);
  sky.addColorStop(0, '#0b0f1b');
  sky.addColorStop(0.5, '#161b33');
  sky.addColorStop(0.82, '#3a2a44');
  sky.addColorStop(1, '#8a4f3e');
  x.fillStyle = sky;
  x.fillRect(0, 0, W, g.hz + 1);

  // stars in the upper sky
  seedStars = [];
  for (var i = 0; i < Math.round(W * g.hz / 9000); i++) {
    seedStars.push({ x: rnd() * W, y: rnd() * g.hz * 0.6, r: 0.4 + rnd() * 0.9, p: rnd() * 6.28 });
  }
  seedStars.forEach(function (s) {
    x.fillStyle = 'rgba(245,239,230,' + (0.25 + 0.4 * (s.r - 0.4)) + ')';
    x.fillRect(s.x, s.y, s.r, s.r);
  });

  // low sun glow sitting on the horizon (right of centre, away from titles)
  var sun = x.createRadialGradient(g.sunX, g.hz, 0, g.sunX, g.hz, Math.max(W, H) * 0.45);
  sun.addColorStop(0, 'rgba(255,184,77,0.55)');
  sun.addColorStop(0.18, 'rgba(230,120,70,0.22)');
  sun.addColorStop(1, 'rgba(230,120,70,0)');
  x.fillStyle = sun;
  x.fillRect(0, 0, W, g.hz + 1);

  // sea base
  var sea = x.createLinearGradient(0, g.hz, 0, H);
  sea.addColorStop(0, '#2a2a3c');
  sea.addColorStop(0.15, '#172033');
  sea.addColorStop(1, '#0a0e17');
  x.fillStyle = sea;
  x.fillRect(0, g.hz, W, H - g.hz);

  // far headland (left), town on it
  x.fillStyle = '#1b2033';
  x.beginPath();
  x.moveTo(0, g.hz);
  x.lineTo(0, g.hz - H * 0.07);
  x.bezierCurveTo(W * 0.12, g.hz - H * 0.11, W * 0.24, g.hz - H * 0.06, W * 0.38, g.hz - H * 0.015);
  x.lineTo(W * 0.42, g.hz);
  x.closePath();
  x.fill();
  var hx = 4;
  while (hx < W * 0.34) {
    var hw = 10 + rnd() * 16, hh = 10 + rnd() * 18;
    var base = g.hz - H * 0.05 * (1 - hx / (W * 0.4)) - 2;
    x.fillStyle = '#141828';
    x.fillRect(hx, base - hh, hw, hh + 4);
    x.beginPath();
    x.moveTo(hx - 2, base - hh);
    x.lineTo(hx + hw / 2, base - hh - 6 - rnd() * 5);
    x.lineTo(hx + hw + 2, base - hh);
    x.fill();
    if (rnd() < 0.7) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(255,184,77,0.85)' : 'rgba(255,214,140,0.7)';
      x.fillRect(hx + hw * 0.3, base - hh * 0.6, 2.2, 2.6);
    }
    hx += hw + 2 + rnd() * 6;
  }

  // near headland (right) with the lighthouse
  x.fillStyle = '#121626';
  x.beginPath();
  x.moveTo(W, g.hz + 4);
  x.lineTo(W * 0.72, g.hz + 4);
  x.bezierCurveTo(W * 0.78, g.hz - H * 0.03, W * 0.84, g.hz - H * 0.05, g.lhX - 20, g.lhY + 40);
  x.lineTo(W, g.lhY + 30);
  x.closePath();
  x.fill();
  var tw = 9, th = g.hz - g.lhY - 20;
  var tower = x.createLinearGradient(g.lhX - tw, 0, g.lhX + tw, 0);
  tower.addColorStop(0, '#8d8a93');
  tower.addColorStop(1, '#3d3e4c');
  x.fillStyle = tower;
  x.beginPath();
  x.moveTo(g.lhX - tw, g.lhY + th);
  x.lineTo(g.lhX - tw * 0.65, g.lhY + 6);
  x.lineTo(g.lhX + tw * 0.65, g.lhY + 6);
  x.lineTo(g.lhX + tw, g.lhY + th);
  x.fill();
  x.fillStyle = 'rgba(170,70,60,0.8)';
  x.fillRect(g.lhX - tw * 0.8, g.lhY + th * 0.45, tw * 1.6, 6);
  x.fillStyle = '#23263a';
  x.fillRect(g.lhX - 8, g.lhY - 2, 16, 8);
  x.beginPath();
  x.moveTo(g.lhX - 9, g.lhY - 8);
  x.lineTo(g.lhX, g.lhY - 16);
  x.lineTo(g.lhX + 9, g.lhY - 8);
  x.fill();

  if (q.grade === 'on') grade(x, W, H);
  layer = c;
}

function drawBackdrop() {
  if (failed || !bgCtx || q.background === 'off') return;
  try {
    if (!layer) buildLayer();
    var g = geometry(), W = g.W, H = g.H, x = bgCtx;
    var t = animating() ? time : 12.5; // a fixed, pleasant moment when still
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(layer, 0, 0);
    x.setTransform(ratio, 0, 0, ratio, 0, 0);

    // twinkling stars
    if (animating() && seedStars) {
      for (var s = 0; s < seedStars.length; s += 3) {
        var st = seedStars[s];
        var a = 0.25 + 0.35 * Math.max(0, Math.sin(t * 1.3 + st.p));
        x.fillStyle = 'rgba(245,239,230,' + a.toFixed(3) + ')';
        x.fillRect(st.x, st.y, st.r + 0.3, st.r + 0.3);
      }
    }

    // wave lines with perspective spacing; they drift slowly
    x.lineWidth = 1;
    for (var row = 0; row < 26; row++) {
      var f = row / 26;
      var y = g.hz + 3 + Math.pow(f, 1.8) * (H - g.hz);
      var len = 14 + f * 70, gap = 26 + f * 120;
      var off = ((t * (6 + f * 14) + row * 37) % gap);
      x.strokeStyle = 'rgba(154,167,189,' + (0.07 + f * 0.1).toFixed(3) + ')';
      x.beginPath();
      for (var wx = -gap + off; wx < W; wx += gap) {
        var wy = y + Math.sin(t * 0.9 + wx * 0.02 + row) * (1 + f * 2);
        x.moveTo(wx, wy);
        x.quadraticCurveTo(wx + len / 2, wy - 1.5 - f * 2, wx + len, wy);
      }
      x.stroke();
    }

    // sun glitter path on the water
    for (var k = 0; k < 44; k++) {
      var fk = k / 44;
      var gy = g.hz + 2 + Math.pow(fk, 1.6) * (H - g.hz) * 0.8;
      var spread = 8 + fk * W * 0.12;
      var gx = g.sunX + Math.sin(k * 12.9898 + t * 0.7) * spread;
      var ga = (0.35 - fk * 0.3) * (0.55 + 0.45 * Math.sin(t * 3 + k * 1.7));
      if (ga <= 0.01) continue;
      x.fillStyle = 'rgba(255,196,110,' + ga.toFixed(3) + ')';
      x.fillRect(gx, gy, 6 + fk * 18, 1 + fk * 1.5);
    }

    // two moored boats bobbing
    drawBoat(x, W * 0.52, g.hz + (H - g.hz) * 0.12, 1, t, 0);
    drawBoat(x, W * 0.16, g.hz + (H - g.hz) * 0.3, 1.5, t, 2);

    // drifting fog bands
    var sprite = fogSprite();
    for (var b = 0; b < 3; b++) {
      var fy = g.hz + (b - 1) * H * 0.05;
      var fxp = ((t * (4 + b * 3) + b * W * 0.4) % (W * 1.6)) - W * 0.3;
      x.drawImage(sprite, fxp - W * 0.45, fy - W * 0.054, W * 0.9, W * 0.108);
    }

    // lighthouse beam: a slow sweep that narrows as it turns away
    var ang = t * 0.35;
    var face = Math.cos(ang);
    var dir = Math.sin(ang) >= 0 ? -1 : 1;
    var beamLen = W * 0.55;
    var beamW = 10 + Math.abs(face) * 34;
    x.save();
    x.globalCompositeOperation = 'lighter';
    var beam = x.createLinearGradient(g.lhX, g.lhY, g.lhX + dir * beamLen, g.lhY);
    beam.addColorStop(0, 'rgba(255,220,150,' + (0.1 + 0.18 * Math.abs(face)).toFixed(3) + ')');
    beam.addColorStop(1, 'rgba(255,220,150,0)');
    x.fillStyle = beam;
    x.beginPath();
    x.moveTo(g.lhX, g.lhY - 2);
    x.lineTo(g.lhX + dir * beamLen, g.lhY - beamW);
    x.lineTo(g.lhX + dir * beamLen, g.lhY + beamW * 0.7);
    x.closePath();
    x.fill();
    // lamp + bloom halo
    var lampA = 0.6 + 0.4 * Math.abs(face);
    if (q.bloom === 'on') {
      var halo = x.createRadialGradient(g.lhX, g.lhY + 1, 0, g.lhX, g.lhY + 1, 46);
      halo.addColorStop(0, 'rgba(255,214,140,' + (0.55 * lampA).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(255,184,77,0)');
      x.fillStyle = halo;
      x.fillRect(g.lhX - 46, g.lhY - 45, 92, 92);
      var sunHalo = x.createRadialGradient(g.sunX, g.hz, 0, g.sunX, g.hz, 90);
      sunHalo.addColorStop(0, 'rgba(255,190,110,0.35)');
      sunHalo.addColorStop(1, 'rgba(255,190,110,0)');
      x.fillStyle = sunHalo;
      x.fillRect(g.sunX - 90, g.hz - 90, 180, 180);
    }
    x.restore();
    x.fillStyle = 'rgba(255,226,160,' + lampA.toFixed(3) + ')';
    x.fillRect(g.lhX - 5, g.lhY - 1, 10, 5);

    // drifting embers / fireflies over the water
    if (animating() && particlesOn()) drawEmbers(x, g, t);

  } catch (e) { fail(); notify(); }
}

function drawBoat(x, bx, by, s, t, phase) {
  var bob = animating() ? Math.sin(t * 1.1 + phase) * 1.5 * s : 0;
  var tilt = animating() ? Math.sin(t * 0.8 + phase) * 0.03 : 0;
  x.save();
  x.translate(bx, by + bob);
  x.rotate(tilt);
  x.scale(s, s);
  x.fillStyle = '#0d111c';
  x.beginPath();
  x.moveTo(-22, 0); x.lineTo(22, 0); x.lineTo(15, 7); x.lineTo(-16, 7); x.closePath();
  x.fill();
  x.fillRect(-1, -30, 2, 30);
  x.beginPath();
  x.moveTo(1, -28); x.lineTo(16, -3); x.lineTo(1, -3); x.closePath();
  x.fillStyle = '#1f2436';
  x.fill();
  x.fillStyle = 'rgba(255,184,77,0.9)';
  x.fillRect(-12, -4, 2.5, 2.5);
  x.restore();
  // reflection
  x.fillStyle = 'rgba(255,184,77,0.12)';
  x.fillRect(bx - 12 * s, by + 9 * s + bob, 3 * s, 8 * s);
}

function drawEmbers(x, g, t) {
  var want = q.particles === 'high' ? 36 : 16;
  var rnd = Math.random;
  while (embers.length < want) {
    embers.push({ x: rnd() * g.W, y: g.hz + rnd() * (g.H - g.hz), v: 4 + rnd() * 8, p: rnd() * 6.28, r: 0.8 + rnd() * 1.4 });
  }
  if (embers.length > want) embers.length = want;
  x.save();
  x.globalCompositeOperation = 'lighter';
  embers.forEach(function (e) {
    e.y -= e.v * lastDt / 1000;
    e.x += Math.sin(t * 0.6 + e.p) * 0.15;
    if (e.y < g.hz - g.H * 0.2) { e.y = g.H + 4; e.x = Math.random() * g.W; }
    var a = 0.25 + 0.35 * Math.max(0, Math.sin(t * 2 + e.p));
    x.fillStyle = 'rgba(255,190,100,' + a.toFixed(3) + ')';
    x.beginPath();
    x.arc(e.x, e.y, e.r, 0, 6.2832);
    x.fill();
  });
  x.restore();
}

// Colour grade, baked into the static layer once: warm the mids and deepen the
// shadows slightly. The vignette is a CSS overlay (body::after) so it costs
// nothing per frame.
function grade(x, W, H) {
  x.save();
  x.globalCompositeOperation = 'soft-light';
  x.fillStyle = 'rgba(255,170,90,0.22)';
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = 'rgb(236,232,240)';
  x.fillRect(0, 0, W, H);
  x.restore();
}

var fogCanvas = null;
function fogSprite() {
  if (fogCanvas) return fogCanvas;
  fogCanvas = document.createElement('canvas');
  fogCanvas.width = 256; fogCanvas.height = 32;
  var f = fogCanvas.getContext('2d');
  f.setTransform(1, 0, 0, 32 / 256, 0, 0);
  var gr = f.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(180,190,210,0.09)');
  gr.addColorStop(1, 'rgba(180,190,210,0)');
  f.fillStyle = gr;
  f.fillRect(0, 0, 256, 256);
  return fogCanvas;
}

// ---------- particles ----------
var lastDt = 16;
var CHAIN_HEX = {};

function burst(kind, at, chain) {
  if (!particlesOn() || !fxCtx || !at) return;
  var el = document.querySelector('.hs-cell[data-r="' + at.r + '"][data-c="' + at.c + '"]');
  if (!el) return;
  var rect = el.getBoundingClientRect();
  var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  var n = (q.particles === 'high' ? 26 : 12) * (kind === 'task' ? 2 : 1);
  var k = (window.UIScale && window.UIScale.value) || 1; // sparks grow with the zoomed UI on large screens
  var col = kind === 'merge' ? [255, 200, 110] : hexRgb(chain);
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2;
    var sp = ((kind === 'deliver' ? 40 : 90) + Math.random() * (kind === 'task' ? 220 : 120)) * k;
    particles.push({
      x: cx + Math.cos(a) * rect.width * 0.2, y: cy + Math.sin(a) * rect.height * 0.2,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'merge' ? 40 : 110) * k,
      life: 0, max: 0.5 + Math.random() * 0.45, r: (1.2 + Math.random() * 2.2) * k, k: k,
      c: Math.random() < 0.3 ? [255, 236, 190] : col
    });
  }
  if (kind !== 'merge') particles.push({ ring: true, x: cx, y: cy, life: 0, max: 0.55, r: rect.width * 0.35, c: col, k: k });
  kick();
}

function hexRgb(chain) {
  if (CHAIN_HEX[chain]) return CHAIN_HEX[chain];
  var ch = window.HSContent && window.HSContent.CHAINS[chain];
  var n = ch ? ch.color : 0xffb84d;
  CHAIN_HEX[chain] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return CHAIN_HEX[chain];
}

function drawParticles(dt) {
  if (!fxCtx) return;
  var x = fxCtx;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, fx.width, fx.height);
  if (!particles.length) return;
  x.setTransform(ratio, 0, 0, ratio, 0, 0);
  x.globalCompositeOperation = 'lighter';
  var s = dt / 1000;
  var glow = q.bloom === 'on';
  particles = particles.filter(function (p) {
    p.life += s;
    if (p.life >= p.max) return false;
    var k = 1 - p.life / p.max;
    var col = 'rgba(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ',';
    if (p.ring) {
      x.strokeStyle = col + (0.6 * k).toFixed(3) + ')';
      x.lineWidth = (2 + 3 * k) * (p.k || 1);
      x.beginPath();
      x.arc(p.x, p.y, p.r * (1 + (1 - k) * 1.2), 0, 6.2832);
      x.stroke();
      return true;
    }
    p.vy += 160 * (p.k || 1) * s;
    p.vx *= 1 - 1.8 * s;
    p.x += p.vx * s;
    p.y += p.vy * s;
    if (glow) {
      x.fillStyle = col + (0.18 * k).toFixed(3) + ')';
      x.beginPath();
      x.arc(p.x, p.y, p.r * 3, 0, 6.2832);
      x.fill();
    }
    x.fillStyle = col + (0.9 * k).toFixed(3) + ')';
    x.beginPath();
    x.arc(p.x, p.y, p.r * (0.6 + 0.4 * k), 0, 6.2832);
    x.fill();
    return true;
  });
  x.globalCompositeOperation = 'source-over';
}

/** Particles for a batch of rules events (called by main.js after a render). */
function events(list) {
  if (!particlesOn() || !list) return;
  list.forEach(function (e) {
    if (e.type === 'merge') burst('merge', e.to, e.chain);
    else if (e.type === 'deliver') burst('deliver', e.at, e.chain);
  });
  var done = list.filter(function (e) { return e.type === 'task-complete'; }).length;
  var d = list.filter(function (e) { return e.type === 'deliver'; })[0];
  if (done && d) burst('task', d.at, d.chain);
}

// ---------- frame loop ----------
function needsLoop() {
  return !failed && (animating() || particles.length > 0 || q.showFps);
}

function kick() {
  if (!raf && needsLoop()) { lastT = 0; raf = window.requestAnimationFrame(frame); }
}

function frame(now) {
  raf = 0;
  var dt = lastT ? Math.min(250, now - lastT) : 16;
  lastT = now;
  lastDt = dt;
  time += dt / 1000;
  if (adapt(dt)) resize(true);
  else resize(false);
  // The backdrop moves slowly: ~30 redraws a second is plenty and halves its cost.
  if (animating() && now - lastDraw >= 30) { lastDraw = now; drawBackdrop(); }
  drawParticles(dt);
  if (needsLoop()) raf = window.requestAnimationFrame(frame);
  else if (fxCtx) { fxCtx.setTransform(1, 0, 0, 1, 0, 0); fxCtx.clearRect(0, 0, fx.width, fx.height); }
}

// Adaptive resolution: average ~90 frames; slow → step down 0.1 (min 0.6), fast → up 0.05 (max 1).
var fpsAcc = 0, fpsN = 0;
function adapt(dt) {
  // frame-rate readout refreshes about twice a second
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 500) {
    fps = 1000 * fpsN / fpsAcc;
    fpsAcc = 0; fpsN = 0;
    if (fpsEl && !fpsEl.hidden) fpsEl.textContent = Math.round(fps) + ' fps · ' + (Math.round(ratio * 100) / 100) + '×';
  }
  frames.push(dt);
  if (frames.length < 90) return false;
  var avg = frames.reduce(function (a, b) { return a + b; }, 0) / frames.length;
  frames.length = 0;
  notify();
  if (!q.adaptive) return false;
  var before = adaptiveScale;
  if (avg > 26) adaptiveScale = Math.max(0.6, adaptiveScale - 0.1);
  else if (avg < 14 && adaptiveScale < 1) adaptiveScale = Math.min(1, adaptiveScale + 0.05);
  adaptiveScale = Math.round(adaptiveScale * 100) / 100;
  return before !== adaptiveScale;
}

function fpsVisible(on) {
  if (on && !fpsEl) {
    fpsEl = document.createElement('div');
    fpsEl.id = 'hs-fps';
    fpsEl.setAttribute('aria-hidden', 'true');
    fpsEl.textContent = '… fps';
    document.body.appendChild(fpsEl);
  }
  if (fpsEl) fpsEl.hidden = !on;
}

// ---------- apply ----------
function apply() {
  q = Model.resolve(saved, detected);
  var body = document.body;
  body.setAttribute('data-gfx-preset', q.preset);
  body.setAttribute('data-gfx-auto', q.auto ? 'true' : 'false');
  Object.keys(Model.CATEGORIES).forEach(function (cat) { body.setAttribute('data-gfx-' + cat, q[cat]); });
  body.setAttribute('data-gfx-motion', reduced() ? 'reduced' : 'full');
  if (q.background !== 'off' || q.particles !== 'off') ensureCanvases();
  if (failed) body.setAttribute('data-gfx-background', 'off');
  adaptiveScale = 1;
  frames.length = 0;
  if (!particlesOn()) { particles.length = 0; embers.length = 0; }
  fpsVisible(q.showFps);
  resize(true);
  kick();
  notify();
}

function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

function info() {
  var px = bg && q.background !== 'off' && !failed ? [bg.width, bg.height]
    : [Math.round(window.innerWidth * pixelRatio()), Math.round(window.innerHeight * pixelRatio())];
  return {
    gpu: gpu, detected: detected, mobile: mobile, resolved: q, pixels: px,
    fps: Math.round(fps), adaptiveScale: adaptiveScale, failed: failed, reduced: reduced()
  };
}

window.addEventListener('resize', function () { resize(false); });
if (reducedMq) {
  var onMotion = function () { apply(); };
  if (reducedMq.addEventListener) reducedMq.addEventListener('change', onMotion);
  else if (reducedMq.addListener) reducedMq.addListener(onMotion);
}

window.HSGfx = {
  model: Model,
  settings: function () { return Object.assign({}, saved); },
  set: function (next) { saved = next || {}; persist(); apply(); },
  info: info,
  events: events,
  onChange: function (fn) { listeners.push(fn); }
};

apply();
})();
