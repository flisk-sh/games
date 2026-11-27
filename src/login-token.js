// Checks a token from login.flisk.si (see flisk-sh/login src/token.js). Needs only the PUBLIC key, no secret.
// A token is "<payload>.<signature>", Ed25519, made for one site (aud) and good for 60 seconds.
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
// { login, id } when genuine, made for this site's origin and not expired; otherwise null.
export async function verifyLoginToken(token, publicKey, audience, now = Date.now()) {
  try {
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return null;
    const key = await crypto.subtle.importKey('raw', unb64u(publicKey), 'Ed25519', false, ['verify']);
    if (!(await crypto.subtle.verify('Ed25519', key, unb64u(sig), new TextEncoder().encode(payload)))) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(payload)));
    if (p.aud !== audience || !(p.exp * 1000 > now) || typeof p.login !== 'string' || !Number.isSafeInteger(p.id)) return null;
    return { login: p.login, id: p.id };
  } catch { return null; }
}
