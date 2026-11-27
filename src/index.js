// games.flisk.si: static gallery from public/ plus GitHub sign-in through login.flisk.si (flisk-sh/login).
// No GitHub app and no secret here: the login token is checked with a public key, and sessions live in KV
// under a random id, so signing out really ends them.
import { verifyLoginToken } from './login-token.js';

const SESSION = '__Host-games_session';
const STATE = '__Host-games_state';
const SESSION_SECONDS = 30 * 24 * 3600;

const rand = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
const cookieOf = (req, name) => new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.get('cookie') || '')?.[1] || '';
const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function redirect(location, cookies = []) {
  const headers = new Headers({ location, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 302, headers });
}

// Only a path on this site, so sign-in can never send the visitor elsewhere.
export const safePath = (value) => (/^\/(?![/\\])[A-Za-z0-9/_-]*$/.test(value || '') ? value : '/');

export async function handle(req, env, deps = {}) {
  const url = new URL(req.url);
  const origin = env.PUBLIC_ORIGIN;
  const sid = cookieOf(req, SESSION);
  const validSid = /^[a-f0-9]{48}$/.test(sid);

  if (url.pathname === '/auth/start') {
    const state = rand();
    const back = new URL('/auth/done', origin);
    back.searchParams.set('s', state);
    const next = safePath(url.searchParams.get('next'));
    return redirect(`${env.LOGIN_ORIGIN}/start?return=${encodeURIComponent(back.href)}`, [cookie(STATE, `${state}.${next}`, 600)]);
  }

  if (url.pathname === '/auth/done') {
    const [state, next] = cookieOf(req, STATE).split('.');
    const who = state && url.searchParams.get('s') === state
      ? await verifyLoginToken(url.searchParams.get('flisk_token'), env.LOGIN_PUBLIC_KEY, origin, deps.now)
      : null;
    if (!who) return redirect('/?signin=failed', [cookie(STATE, '', 0)]);
    const id = rand();
    await env.SESSIONS.put(id, JSON.stringify(who), { expirationTtl: SESSION_SECONDS });
    return redirect(safePath(next), [cookie(SESSION, id, SESSION_SECONDS), cookie(STATE, '', 0)]);
  }

  if (url.pathname === '/auth/out') {
    if (req.method !== 'POST' || req.headers.get('origin') !== origin) return json({ error: 'not allowed' }, 403);
    if (validSid) await env.SESSIONS.delete(sid);
    const res = json({ ok: true });
    res.headers.append('set-cookie', cookie(SESSION, '', 0));
    return res;
  }

  if (url.pathname === '/api/me') {
    const user = validSid ? await env.SESSIONS.get(sid, 'json') : null;
    return json({ user: user ? { login: user.login } : null });
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return json({ error: 'not found' }, 404);
  return env.ASSETS.fetch(req);
}

export default { fetch: (req, env) => handle(req, env) };
