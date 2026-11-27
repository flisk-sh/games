import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { handle, safePath } from '../src/index.js';

const catalog = JSON.parse(readFileSync(new URL('../public/catalog.json', import.meta.url)));

describe('catalog.json', () => {
  test('every entry is complete, https, and has a thumbnail in the repo', () => {
    expect(catalog.length).toBeGreaterThan(0);
    for (const g of catalog) {
      for (const key of ['id', 'title', 'author', 'url', 'thumb', 'category', 'description', 'added']) expect(typeof g[key] === 'string' && g[key].length > 0).toBe(true);
      expect(g.id).toMatch(/^[a-z0-9-]+$/);
      expect(g.added).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof g.embed).toBe('boolean');
      const url = new URL(g.url);
      expect(url.protocol).toBe('https:');
      // A framed page on our own origin would escape the iframe sandbox.
      expect(url.hostname).not.toBe('games.flisk.si');
      expect(g.thumb).toMatch(/^\/thumbs\/[a-z0-9-]+\.(png|jpg|webp)$/);
      expect(existsSync(new URL(`../public${g.thumb}`, import.meta.url))).toBe(true);
    }
    expect(new Set(catalog.map((g) => g.id)).size).toBe(catalog.length);
  });
});

const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
async function token(claims) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64u(JSON.stringify({ login: 'octocat', id: 1, aud: 'https://games.flisk.si', iat: now, exp: now + 60, ...claims }));
  return `${payload}.${b64u(await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(payload)))}`;
}
const kv = new Map();
const env = {
  PUBLIC_ORIGIN: 'https://games.flisk.si',
  LOGIN_ORIGIN: 'https://login.flisk.si',
  LOGIN_PUBLIC_KEY: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)),
  SESSIONS: {
    put: async (k, v) => void kv.set(k, v),
    get: async (k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null),
    delete: async (k) => void kv.delete(k),
  },
};
const call = (path, init) => handle(new Request(`https://games.flisk.si${path}`, init), env);
const cookiePair = (res, name) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`)).split(';')[0];

async function start(next = '/saved') {
  const res = await call(`/auth/start?next=${encodeURIComponent(next)}`);
  const back = new URL(new URL(res.headers.get('location')).searchParams.get('return'));
  return { state: back.searchParams.get('s'), cookie: cookiePair(res, '__Host-games_state') };
}
const done = (state, tok, cookie) => call(`/auth/done?s=${state}&flisk_token=${tok}`, { headers: { cookie } });

describe('sign-in', () => {
  test('signs in, shows the user, and signing out ends the session', async () => {
    const s = await start();
    const res = await done(s.state, await token(), s.cookie);
    expect(res.headers.get('location')).toBe('/saved');
    const cookie = cookiePair(res, '__Host-games_session');
    expect((await (await call('/api/me', { headers: { cookie } })).json()).user).toEqual({ login: 'octocat' });
    await call('/auth/out', { method: 'POST', headers: { cookie, origin: 'https://games.flisk.si' } });
    expect((await (await call('/api/me', { headers: { cookie } })).json()).user).toBeNull();
  });
  test('refuses a token for another site, an expired one, and a wrong state', async () => {
    const s = await start();
    for (const [state, tok] of [[s.state, await token({ aud: 'https://grow.flisk.si' })], [s.state, await token({ exp: 1 })], ['other', await token()]]) {
      expect((await done(state, tok, s.cookie)).headers.get('location')).toBe('/?signin=failed');
    }
  });
  test('refuses a callback with no state cookie', async () => {
    expect((await done('x', await token(), '')).headers.get('location')).toBe('/?signin=failed');
  });
  test('sign-out needs this site as origin', async () => {
    expect((await call('/auth/out', { method: 'POST', headers: { origin: 'https://evil.example' } })).status).toBe(403);
  });
  test('next stays on this site', () => {
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', null]) expect(safePath(bad)).toBe('/');
    expect(safePath('/play/koi-pond')).toBe('/play/koi-pond');
  });
});
