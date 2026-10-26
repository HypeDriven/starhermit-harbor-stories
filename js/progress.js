/* Harbor Stories — the player's progress document (pure: no storage, no DOM).
 * { v: 1, best, achievements: { key: unlockedAtMs }, stats: { … } }: the best
 * score, the lifetime counters and the local achievements. It is the game's
 * save (src/save.ts keeps it in starhermit:storage `saves`, on the device and
 * in the account's cloud slot) and the exact format the browser build wrote
 * into the cloud slot game:<slug> (the JS SDK's zipped save.json), so an old
 * cloud save migrates by `merge(empty(), parse(text))`.
 * UMD: globalThis.HSProgress (loadClassic) and Node (require). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HSProgress = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STAT_KEYS = ['merges', 'delivers', 'bestStreak', 'tier3', 'repairs', 'stagesDone', 'dailiesDone'];

  function empty() {
    var stats = {};
    STAT_KEYS.forEach(function (k) { stats[k] = 0; });
    return { v: 1, best: 0, achievements: {}, stats: stats };
  }

  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? Math.floor(n) : 0; }

  /** A v1 document from anything (a cloud save, a device save); null if it is not one. */
  function normalize(d) {
    if (!d || typeof d !== 'object' || d.v !== 1 || !d.stats || typeof d.stats !== 'object') return null;
    var out = empty();
    out.best = num(d.best);
    var a = d.achievements && typeof d.achievements === 'object' ? d.achievements : {};
    Object.keys(a).forEach(function (k) { if (a[k]) out.achievements[k] = Number(a[k]) || 1; });
    STAT_KEYS.forEach(function (k) { out.stats[k] = num(d.stats[k]); });
    return out;
  }

  /** The old build's save.json text → a document, or null. */
  function parse(text) {
    try { return normalize(JSON.parse(String(text))); } catch (e) { return null; }
  }

  /** Two devices' documents as one: best and counters by max (never
   * double-counted), achievements by union at the earliest unlock. */
  function merge(a, b) {
    var x = normalize(a) || empty(), y = normalize(b) || empty();
    var out = empty();
    out.best = Math.max(x.best, y.best);
    STAT_KEYS.forEach(function (k) { out.stats[k] = Math.max(x.stats[k], y.stats[k]); });
    [x.achievements, y.achievements].forEach(function (src) {
      Object.keys(src).forEach(function (k) {
        out.achievements[k] = out.achievements[k] ? Math.min(out.achievements[k], src[k]) : src[k];
      });
    });
    return out;
  }

  /** Achievements newly earned by the counters (spec.md §16); marks them unlocked at `now`. */
  function evaluate(doc, achievements, now) {
    var s = doc.stats, fresh = [];
    (achievements || []).forEach(function (a) {
      if (doc.achievements[a.key]) return;
      var ok = false;
      switch (a.key) {
        case 'first-merge': ok = s.merges >= 1; break;
        case 'first-deliver': ok = s.delivers >= 1; break;
        case 'first-repair': ok = s.repairs >= 1; break;
        case 'tier3': ok = s.tier3 >= 1; break;
        case 'streak-6': ok = s.bestStreak >= 6; break;
        case 'merges-250': ok = s.merges >= 250; break;
        case 'journey-half': ok = s.stagesDone >= 20; break;
        case 'journey-done': ok = s.stagesDone >= 40; break;
        case 'daily-7': ok = s.dailiesDone >= 7; break;
        case 'delivers-300': ok = s.delivers >= 300; break;
      }
      if (ok) { doc.achievements[a.key] = now; fresh.push(a); }
    });
    return fresh;
  }

  /** Counts one rules event; returns { changed, fresh } (fresh: newly unlocked achievements). */
  function track(doc, event, achievements, now) {
    var s = doc.stats, changed = false;
    if (event.type === 'merge') {
      s.merges++;
      if (event.streak > s.bestStreak) s.bestStreak = event.streak;
      if (event.tier >= 3) s.tier3++;
      changed = true;
    } else if (event.type === 'deliver') {
      s.delivers++;
      changed = true;
    } else if (event.type === 'win') {
      s.repairs++;
      s.stagesDone++;
      changed = true;
    }
    var fresh = evaluate(doc, achievements, now);
    return { changed: changed || fresh.length > 0, fresh: fresh };
  }

  /** Records a finished run's score; whether it is a new best. */
  function recordBest(doc, score) {
    var n = num(score);
    if (n <= doc.best) return false;
    doc.best = n;
    return true;
  }

  return { STAT_KEYS: STAT_KEYS, empty: empty, normalize: normalize, parse: parse, merge: merge,
    evaluate: evaluate, track: track, recordBest: recordBest };
});
