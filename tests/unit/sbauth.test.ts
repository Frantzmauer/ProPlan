import { describe, expect, it } from 'vitest';
import {
  SB_URL, SESSION_KEY, SbError, challengeOf, exchangeCode, freshSession, googleUrl, isValidEmail, readSession, saveSession,
  sendEmailCode, signOut, toSession, verifyEmailCode, type KV, type SbSession,
} from '../../app/lib/sbauth';

function memKV(): KV & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, get: k => m.get(k) ?? null, set: (k, v) => { m.set(k, v); }, del: k => { m.delete(k); } };
}

type Call = { url: string; body: any; headers: Record<string, string> };
function fakeFetch(reply: (url: string, body: any) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  const f = async (url: string, init: { body?: string; headers: Record<string, string> }) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body, headers: init.headers });
    const r = reply(url, body);
    const status = r.status ?? 200;
    return { ok: status < 300, status, text: async () => JSON.stringify(r.json) };
  };
  return { f: f as unknown as typeof fetch, calls };
}

const apiSession = (over: Record<string, unknown> = {}) => ({
  access_token: 'a.b.c', refresh_token: 'r1', expires_in: 3600,
  user: { id: 'u-1', email: 'ola@example.com', app_metadata: { provider: 'google' } }, ...over,
});
const session = (exp: number): SbSession => ({ access_token: 'old', refresh_token: 'r0', expires_at: exp, user: { id: 'u-1', email: 'ola@example.com', provider: 'email' } });

describe('logowanie Supabase', () => {
  it('odpowiedź z tokenami → sesja z czasem wygaśnięcia i dostawcą', () => {
    const s = toSession(apiSession(), 1000);
    expect(s).toEqual({ access_token: 'a.b.c', refresh_token: 'r1', expires_at: 1000 + 3600e3, user: { id: 'u-1', email: 'ola@example.com', provider: 'google' } });
    expect(toSession(apiSession({ expires_at: 2000 })).expires_at).toBe(2000e3);
    expect(() => toSession({ user: {} })).toThrow(SbError);
  });

  it('adres e-mail', () => {
    expect(isValidEmail('ola@example.com')).toBe(true);
    expect(isValidEmail(' ola@ex.pl ')).toBe(true);
    expect(isValidEmail('ola@ex')).toBe(false);
    expect(isValidEmail('ola example.com')).toBe(false);
  });

  it('kod e-mail: wysłanie i weryfikacja (adres małymi literami, klucz publiczny w nagłówku)', async () => {
    const { f, calls } = fakeFetch(url => ({ json: url.endsWith('/verify') ? apiSession() : {} }));
    await sendEmailCode(' Ola@Example.com', f);
    const s = await verifyEmailCode('Ola@Example.com', ' 123456 ', f);
    expect(calls[0].url).toBe(SB_URL + '/auth/v1/otp');
    expect(calls[0].body).toEqual({ email: 'ola@example.com', create_user: true });
    expect(calls[0].headers.apikey).toMatch(/^sb_publishable_/);
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[1].body).toEqual({ type: 'email', email: 'ola@example.com', token: '123456' });
    expect(s.user.id).toBe('u-1');
  });

  it('zły kod → błąd z kodem i statusem', async () => {
    const { f } = fakeFetch(() => ({ status: 403, json: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } }));
    const e = await verifyEmailCode('a@b.pl', '000000', f).catch(x => x);
    expect(e).toBeInstanceOf(SbError);
    expect(e.code).toBe('otp_expired');
    expect(e.status).toBe(403);
  });

  it('Google: PKCE — wyzwanie z weryfikatora, wymiana kodu, weryfikator jednorazowy', async () => {
    const kv = memKV();
    const url = new URL(await googleUrl('https://app.test/users/', kv));
    expect(url.origin + url.pathname).toBe(SB_URL + '/auth/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_to')).toBe('https://app.test/users/');
    const verifier = [...kv.m.values()][0];
    expect(url.searchParams.get('code_challenge')).toBe(await challengeOf(verifier));
    const { f, calls } = fakeFetch(() => ({ json: apiSession() }));
    await exchangeCode('kod', kv, f);
    expect(calls[0].url).toBe(SB_URL + '/auth/v1/token?grant_type=pkce');
    expect(calls[0].body).toEqual({ auth_code: 'kod', code_verifier: verifier });
    await expect(exchangeCode('kod', kv, f)).rejects.toThrow(SbError);   // drugi raz — brak weryfikatora
  });

  it('wyzwanie PKCE: SHA-256 w base64url (wektor z RFC 7636)', async () => {
    expect(await challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('sesja: ważna — bez odświeżania; blisko końca — jedno odświeżenie naraz', async () => {
    const kv = memKV(), now = () => 1_000_000;
    saveSession(kv, session(now() + 600e3));
    const { f, calls } = fakeFetch(() => ({ json: apiSession({ refresh_token: 'r2' }) }));
    expect((await freshSession(kv, f, now))!.access_token).toBe('old');
    expect(calls).toHaveLength(0);
    saveSession(kv, session(now() + 60e3));
    const [a, b] = await Promise.all([freshSession(kv, f, now), freshSession(kv, f, now)]);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ refresh_token: 'r0' });
    expect(a!.refresh_token).toBe('r2'); expect(b!.refresh_token).toBe('r2');
    expect(readSession(kv)!.refresh_token).toBe('r2');
  });

  it('odrzucony token odświeżania kończy sesję; brak sieci — sesja zostaje', async () => {
    const kv = memKV(), now = () => 1_000_000;
    saveSession(kv, session(now()));
    await expect(freshSession(kv, (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch, now)).rejects.toThrow('Failed to fetch');
    expect(readSession(kv)).not.toBeNull();
    const { f } = fakeFetch(() => ({ status: 400, json: { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' } }));
    expect(await freshSession(kv, f, now)).toBeNull();
    expect(kv.get(SESSION_KEY)).toBeNull();
  });

  it('wylogowanie: to urządzenie zawsze (także bez sieci); pozostałe — sesja zostaje', async () => {
    const kv = memKV();
    saveSession(kv, session(Date.now() + 3600e3));
    const { f, calls } = fakeFetch(() => ({ status: 204, json: {} }));
    await signOut(kv, 'others', f);
    expect(calls[0].url).toBe(SB_URL + '/auth/v1/logout?scope=others');
    expect(calls[0].headers.Authorization).toBe('Bearer old');
    expect(readSession(kv)).not.toBeNull();
    await signOut(kv, 'local', (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch);
    expect(readSession(kv)).toBeNull();
  });

  it('uszkodzona sesja w pamięci = brak sesji', () => {
    const kv = memKV();
    kv.set(SESSION_KEY, '{nie json');
    expect(readSession(kv)).toBeNull();
    kv.set(SESSION_KEY, JSON.stringify({ access_token: 'x' }));
    expect(readSession(kv)).toBeNull();
  });
});
