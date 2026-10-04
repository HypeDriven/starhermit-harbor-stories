/* Harbor Stories — StarHermit platform adapter (window.HSPlatform).
 * A thin layer over the shared SDK (starhermit-sdk.js, window.StarHermit):
 * launch token + renewal, sign-in, account nickname/avatar, the cloud-save
 * slot, the per-player settings KV, keyboard bindings, the invite link and the
 * read-only leaderboard. Everything is inert without a token: standalone play
 * makes zero network calls. See spec.md §12.
 */
(function () {
'use strict';

var SH = window.StarHermit;
var displayName = null;    // account nickname, or "Player " + id prefix
var avatar = null;         // object URL of the account avatar, or null
var syncStatus = 'offline';// offline | loading | saving | synced | error
var listeners = [];
var leaderboardCache = null;

function online() { return !!(SH && SH.signedIn); }

function notify() { listeners.forEach(function (cb) { try { cb(); } catch (e) { /* ignore */ } }); }
function setSync(status) {
  if (syncStatus === status) return;
  syncStatus = status;
  notify();
}

function loadProfile() {
  if (!online()) return;
  SH.profile().then(function (p) { displayName = p ? p.displayName : null; notify(); });
  SH.avatarUrl().then(function (url) { avatar = url; if (url) notify(); });
}

// ---------- cloud save: remote-first load, debounced checkpoint saves ----------
function loadCloudSave() {
  if (!online()) return Promise.resolve(null);
  setSync('loading');
  return SH.loadJSON().then(function (doc) { setSync('synced'); return doc; },
    function () { setSync('error'); return null; });
}

function pushSave(doc) {
  if (!online()) return;
  setSync('saving');
  SH.saveJSON(doc);
}

function flushSave(keepalive) {
  if (!online()) return;
  SH.flushSave(keepalive === true);
}

// ---------- leaderboard: read-only ----------
function loadLeaderboard() {
  if (!online()) return Promise.resolve(null);
  return SH.leaderboard().then(function (data) {
    var entries = (data && data.items) || [];
    if (!entries.length) return null;
    return Promise.all(entries.map(function (e) {
      return SH.profile(e.userId).then(function (p) {
        return { name: p ? p.displayName : (e.username || 'Player'), score: Number(e.score) || 0, mine: String(e.userId) === String(SH.userId) };
      });
    })).then(function (list) { leaderboardCache = list; notify(); return list; });
  }).catch(function () { return null; });
}

// ---------- settings KV ----------
function getSettings() { return online() ? SH.getSettings() : Promise.resolve({}); }
function patchSettings(obj) { if (online()) SH.patchSettings(obj); }

// ---------- invite link ----------
function inviteLink() { return online() ? SH.inviteLink() : null; }
function copyInvite() {
  var link = inviteLink();
  if (!link) return Promise.resolve(false);
  try {
    return navigator.clipboard.writeText(link).then(function () { return true; }, function () { return false; });
  } catch (e) { return Promise.resolve(false); }
}

// ---------- boot ----------
if (SH) {
  SH.init();
  SH.on('saved', function (ok) { setSync(ok ? 'synced' : 'error'); });
  SH.on('auth', function (a) {
    if (!a.signedIn) { displayName = null; avatar = null; leaderboardCache = null; syncStatus = 'offline'; notify(); }
  });
  if (online()) { syncStatus = 'synced'; loadProfile(); }
  window.addEventListener('pagehide', function () { flushSave(true); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushSave(true);
  });
}

window.HSPlatform = {
  isOnline: online,
  canSignIn: function () { return !!(SH && SH.canSignIn()); },
  signIn: function () { return SH && SH.signIn(); },
  displayName: function () { return displayName || (online() ? 'Player ' + String(SH.userId).slice(0, 6) : null); },
  avatarUrl: function () { return avatar; },
  syncStatus: function () { return syncStatus; },
  onUpdate: function (cb) { listeners.push(cb); },
  loadCloudSave: loadCloudSave,
  pushSave: pushSave,
  flushSave: flushSave,
  getSettings: getSettings,
  patchSettings: patchSettings,
  loadBindings: function (defaults) {
    return online() ? SH.loadBindings(defaults) : Promise.resolve(JSON.parse(JSON.stringify(defaults)));
  },
  inviteLink: inviteLink,
  copyInvite: copyInvite,
  getLeaderboard: function () { return leaderboardCache; },
  refreshLeaderboard: loadLeaderboard
};
})();
