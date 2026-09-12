/* Harbor Stories — StarHermit platform adapter.
 * Reads the launch token from the URL fragment (#game_token=<jwt>), keeps it
 * refreshed, fetches the account nickname, mirrors the save document to the
 * cloud-saves slot (zip+base64) and reads the daily leaderboard. Everything is
 * inert without a token: offline/local play makes zero /api calls. Browser
 * global: window.HSPlatform. See spec.md §12.
 */
(function () {
'use strict';

var REFRESH_MS = 45 * 60 * 1000;      // token lives 60 min; re-mint at 45
var REFRESH_RETRY_MS = 60 * 1000;
var SAVE_DEBOUNCE_MS = 2000;

var token = null;          // current launch token (swapped on refresh)
var userId = null;         // JWT sub
var gameSlug = null;       // JWT game_scope
var displayName = null;    // account nickname, or "Player " + id8 fallback
var syncStatus = 'offline';// offline | loading | saving | synced | error
var listeners = [];
var saveTimer = null;
var lastSaveDoc = null;
var saveDirty = false;
var refreshing = false;
var leaderboardCache = null;
var profileCache = {};     // userId -> nickname (leaderboard resolution)

// ---------- launch token: read once, then strip ----------
function queryParam(name) {
  var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search || '');
  return m ? decodeURIComponent(m[1]) : null;
}

function readLaunchToken() {
  var hash = window.location.hash || '';
  var m = /[#&]game_token=([^&]+)/.exec(hash);
  if (m) {
    var tok = decodeURIComponent(m[1]);
    try {
      if (window.history && window.history.replaceState) {
        var stripped = hash.replace(/[#&]game_token=[^&]*/, '');
        if (stripped.charAt(0) === '&') stripped = '#' + stripped.slice(1);
        window.history.replaceState(null, '', window.location.pathname + window.location.search +
          (stripped && stripped !== '#' ? stripped : ''));
      }
    } catch (e) { /* strip is best-effort */ }
    return tok;
  }
  // Query-param fallbacks are for local dev only — never on the hosted domain.
  if (/\.starhermit\.com$/i.test(window.location.hostname)) return null;
  return queryParam('game_token') || queryParam('launch_token') || queryParam('token') || queryParam('launch');
}

function decodeJwtPayload(jwt) {
  var parts = String(jwt).split('.');
  if (parts.length !== 3) return null;
  var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  try {
    return JSON.parse(new TextDecoder('utf-8').decode(base64ToBytes(b64)));
  } catch (e) { return null; }
}

// ---------- minimal REST helper: Bearer on every call ----------
function api(path, options) {
  options = options || {};
  var headers = options.headers ? Object.assign({}, options.headers) : {};
  headers['Authorization'] = 'Bearer ' + token;
  if (options.body) headers['Content-Type'] = 'application/json';
  return window.fetch(path, {
    method: options.method || 'GET',
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin'
  }).then(function (res) {
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('http ' + res.status);
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('application/zip') !== -1 || ct.indexOf('application/octet-stream') !== -1) {
      return res.arrayBuffer();
    }
    if (ct.indexOf('application/json') !== -1) return res.json().catch(function () { return null; });
    return res.text();
  });
}

// ---------- token refresh ----------
function scheduleRefresh() {
  window.setTimeout(refreshToken, REFRESH_MS);
}

function refreshToken() {
  if (!token) return;
  if (refreshing) { scheduleRefresh(); return; }
  refreshing = true;
  api('/api/v1/games/' + encodeURIComponent(gameSlug) + '/launch-token', { method: 'POST' })
    .then(function (data) {
      refreshing = false;
      if (data && data.token) token = data.token;
      scheduleRefresh();
    })
    .catch(function () {
      refreshing = false;
      window.setTimeout(refreshToken, REFRESH_RETRY_MS);
    });
}

// ---------- account profile (NEVER /api/v1/me, never usernames) ----------
function fallbackName(id) { return 'Player ' + String(id).slice(0, 8); }

function loadProfile() {
  return api('/api/v1/users/' + encodeURIComponent(userId) + '/profile')
    .then(function (p) {
      displayName = (p && p.nickname) ? p.nickname : fallbackName(userId);
      notify();
    })
    .catch(function () {
      displayName = fallbackName(userId);
      notify();
    });
}

function profileNameFor(id) {
  var key = String(id);
  if (!profileCache[key]) {
    profileCache[key] = fallbackName(key);
    api('/api/v1/users/' + encodeURIComponent(key) + '/profile')
      .then(function (p) {
        if (p && p.nickname && p.nickname !== profileCache[key]) {
          profileCache[key] = p.nickname;
          notify();
        }
      })
      .catch(function () { /* fallback name sticks */ });
  }
  return profileCache[key];
}

// ---------- cloud save: one slot, zip+base64, remote-preferred load ----------
function loadCloudSave() {
  if (!token) return Promise.resolve(null);
  setSync('loading');
  return api('/api/v1/me/cloud-saves/' + encodeURIComponent(gameSlug))
    .then(function (buf) {
      if (!buf) { setSync('synced'); return null; }
      var json = new TextDecoder('utf-8').decode(unzipFirstEntry(new Uint8Array(buf)));
      var doc = JSON.parse(json);
      setSync('synced');
      return doc;
    })
    .catch(function () { setSync('error'); return null; });
}

function pushSave(doc) {
  lastSaveDoc = doc;
  saveDirty = true;
  if (!token) return;
  setSync('saving');
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

function flushSave() {
  if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = null; }
  if (!token || !saveDirty || !lastSaveDoc) return;
  saveDirty = false;
  setSync('saving');
  var payload = bytesToBase64(zipStore('save.json', new TextEncoder().encode(JSON.stringify(lastSaveDoc))));
  api('/api/v1/me/cloud-saves/' + encodeURIComponent(gameSlug), { method: 'PUT', body: { dataBase64: payload } })
    .then(function () { setSync(saveDirty ? 'saving' : 'synced'); })
    .catch(function () {
      saveDirty = true;
      setSync('error');
      window.setTimeout(flushSave, REFRESH_RETRY_MS);
    });
}

window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') flushSave();
});

// ---------- leaderboard: read-only per the platform contract ----------
function loadLeaderboard() {
  if (!token) return Promise.resolve(null);
  return api('/api/v1/games/' + encodeURIComponent(gameSlug))
    .then(function (g) {
      if (!g || !g.leaderboardId) return null;
      return api('/api/v1/leaderboards/' + encodeURIComponent(g.leaderboardId) + '/entries?page=1&pageSize=10');
    })
    .then(function (data) {
      if (!data) return null;
      var entries = data.entries || data.items || [];
      leaderboardCache = entries.map(function (e) {
        var id = e.userId || e.user_id || e.id;
        return { name: profileNameFor(id), score: Number(e.score) || 0, mine: String(id) === userId };
      });
      notify();
      return leaderboardCache;
    })
    .catch(function () { return null; });
}

// ---------- sync status + update notifications ----------
function setSync(status) {
  if (syncStatus === status) return;
  syncStatus = status;
  notify();
}

function notify() {
  listeners.forEach(function (cb) { cb(); });
}

// ---------- stored-zip helper (stored entries only, no compression) ----------
var CRC_TABLE = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  var c = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(name, dataBytes) {
  var enc = new TextEncoder();
  var nameB = enc.encode(name);
  var crc = crc32(dataBytes);
  var out = [];
  var u16 = function (v) { out.push(v & 0xff, (v >> 8) & 0xff); };
  var u32 = function (v) { out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff); };
  u32(0x04034b50); u16(20); u16(0); u16(0); u16(0); u16(0);
  u32(crc); u32(dataBytes.length); u32(dataBytes.length);
  u16(nameB.length); u16(0);
  var head = new Uint8Array(out);
  var cd = [];
  var c16 = function (v) { cd.push(v & 0xff, (v >> 8) & 0xff); };
  var c32 = function (v) { cd.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff); };
  c32(0x02014b50); c16(20); c16(20); c16(0); c16(0); c16(0); c16(0);
  c32(crc); c32(dataBytes.length); c32(dataBytes.length);
  c16(nameB.length); c16(0); c16(0); c16(0); c16(0); c32(0); c32(0);
  var cdHead = new Uint8Array(cd);
  var cdOff = head.length + nameB.length + dataBytes.length;
  var parts = [head, nameB, dataBytes, cdHead, nameB];
  var eocd = [];
  var e32 = function (v) { eocd.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff); };
  var e16 = function (v) { eocd.push(v & 0xff, (v >> 8) & 0xff); };
  e32(0x06054b50); e16(0); e16(0); e16(1); e16(1);
  e32(cdHead.length + nameB.length); e32(cdOff); e16(0);
  parts.push(new Uint8Array(eocd));
  var total = parts.reduce(function (n, p) { return n + p.length; }, 0);
  var buf = new Uint8Array(total);
  var o = 0;
  for (var pi = 0; pi < parts.length; pi++) { buf.set(parts[pi], o); o += parts[pi].length; }
  return buf;
}

function unzipFirstEntry(zipBytes) {
  // Stored single-entry reader: scan local headers for compression 0.
  var dv = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  var off = 0;
  while (off + 30 <= zipBytes.length && dv.getUint32(off, true) === 0x04034b50) {
    var method = dv.getUint16(off + 8, true);
    var size = dv.getUint32(off + 18, true);
    var nameLen = dv.getUint16(off + 26, true);
    var extraLen = dv.getUint16(off + 28, true);
    var dataOff = off + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error('unsupported zip entry');
    return zipBytes.slice(dataOff, dataOff + size);
  }
  throw new Error('bad zip');
}

function bytesToBase64(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return window.btoa(s);
}

function base64ToBytes(b64) {
  var s = window.atob(b64);
  var b = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

// ---------- boot ----------
function init() {
  var raw = readLaunchToken();
  var payload = raw ? decodeJwtPayload(raw) : null;
  if (!payload || !payload.sub || !payload.game_scope) return; // offline: no token, no calls
  token = raw;
  userId = String(payload.sub);
  gameSlug = String(payload.game_scope);
  displayName = fallbackName(userId);
  scheduleRefresh();
  loadProfile();
}

window.HSPlatform = {
  isOnline: function () { return !!token; },
  displayName: function () { return displayName; },
  syncStatus: function () { return syncStatus; },
  onUpdate: function (cb) { listeners.push(cb); },
  loadCloudSave: loadCloudSave,
  pushSave: pushSave,
  flushSave: flushSave,
  getLeaderboard: function () { return leaderboardCache; },
  refreshLeaderboard: loadLeaderboard
};

init();
})();
