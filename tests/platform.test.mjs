// HSPlatform over the shared StarHermit SDK: token, profile, cloud save,
// settings KV, bindings, invite link and the standalone no-network guarantee.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScripts, makeBackend, makeToken, plain, settle } from './starhermit-harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILES = [path.join(ROOT, 'starhermit-sdk.js'), path.join(ROOT, 'js/platform.js')];

test('launch token: profile, cloud save game:<slug>, settings, bindings, invite', async () => {
  const be = makeBackend();
  const w = loadScripts(FILES, { hash: '#game_token=' + makeToken() + '&session_id=s1', fetch: be.fetch });
  const P = w.HSPlatform;
  assert.equal(P.isOnline(), true);
  assert.equal(w.StarHermit.slug, 'gid-1');
  assert.equal(w.__replaced, '/');                       // token stripped from the URL
  await settle();
  assert.equal(P.displayName(), 'Al');
  assert.ok(be.calls.every((c) => c.auth === 'Bearer ' + w.StarHermit.token));

  P.pushSave({ v: 1, best: 42 });
  await P.flushSave();
  await settle();
  const put = be.calls.find((c) => c.method === 'PUT');
  assert.equal(put.url, '/api/v1/me/cloud-saves/' + encodeURIComponent('game:gid-1'));
  assert.ok(be.saves['game:gid-1']);
  assert.deepEqual(plain(await P.loadCloudSave()), { v: 1, best: 42 });

  P.patchSettings({ sfx: { volume: 0.5, muted: true } });
  await settle();
  const patch = be.calls.find((c) => c.method === 'PATCH');
  assert.equal(patch.url, '/api/v1/games/gid-1/settings');
  assert.deepEqual(patch.body, { settings: { sfx: { volume: 0.5, muted: true } } });
  assert.deepEqual(plain((await P.getSettings()).sfx), { volume: 0.5, muted: true });

  assert.deepEqual(plain(await P.loadBindings({ hint: ['KeyH'] })), { hint: ['KeyH'] });
  assert.ok(P.inviteLink().endsWith('/game-invite/user-123456789/gid-1'));
  assert.equal(await P.copyInvite(), true);
  assert.equal(w.__clipboard, P.inviteLink());
});

test('standalone: no token, no network, local defaults', async () => {
  let fetched = 0;
  const w = loadScripts(FILES, { fetch: async () => { fetched++; throw new Error('no network'); } });
  const P = w.HSPlatform;
  assert.equal(P.isOnline(), false);
  assert.equal(P.canSignIn(), false);
  assert.equal(await P.loadCloudSave(), null);
  P.pushSave({ v: 1 });
  P.flushSave();
  P.patchSettings({ a: 1 });
  assert.deepEqual(plain(await P.getSettings()), {});
  assert.deepEqual(plain(await P.loadBindings({ hint: ['KeyH'] })), { hint: ['KeyH'] });
  assert.equal(P.inviteLink(), null);
  assert.deepEqual(plain(await P.submitScore(325)), { posted: false, rank: null });
  await settle();
  assert.equal(fetched, 0);
});

test('hosted without token offers sign-in', () => {
  const w = loadScripts(FILES, { hostname: 'gid-1.starhermit.com' });
  assert.equal(w.HSPlatform.isOnline(), false);
  assert.equal(w.HSPlatform.canSignIn(), true);
});
