// Logowanie przez Supabase Auth (bez haseł): „Kontynuuj z Google” albo 6-cyfrowy kod z e-maila.
// Zwykłe zapytania do REST API Supabase — bez biblioteki supabase-js. Adres projektu i klucz publiczny są jawne
// z założenia; tajny klucz (service_role) nigdy nie trafia do aplikacji.
// Sesja: krótki token dostępu (ok. 1 h) + token odświeżania; odświeżamy ją sami przed wygaśnięciem.

export const SB_URL = 'https://jrospbidwuxqaaknepfh.supabase.co';
export const SB_KEY = 'sb_publishable_y7gt9FZSaSP8PKLitLFOdw_-c8ZIz9B';

export interface SbUser { id: string; email: string; provider: string }
export interface SbSession { access_token: string; refresh_token: string; expires_at: number; user: SbUser }

/** Pamięć sesji i weryfikatora PKCE — w aplikacji localStorage, w testach obiekt. */
export interface KV { get(k: string): string | null; set(k: string, v: string): void; del(k: string): void }

export const SESSION_KEY = 'sixmo_sb';
const VERIFIER_KEY = 'sixmo_sb_pkce';

export class SbError extends Error {
  code: string; status: number;
  constructor(message: string, code: string, status: number) { super(message); this.code = code; this.status = status; }
}

type Fetch = typeof fetch;

async function call(f: Fetch, path: string, body?: unknown, access?: string, method = 'POST'): Promise<any> {
  const headers: Record<string, string> = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  if (access) headers.Authorization = 'Bearer ' + access;
  const res = await f(SB_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await res.text();
  let j: any = null;
  try { j = txt ? JSON.parse(txt) : {}; } catch { j = {}; }
  if (!res.ok) throw new SbError(j.msg || j.error_description || j.message || j.error || 'HTTP ' + res.status, j.error_code || j.error || '', res.status);
  return j;
}

/** Odpowiedź z sesją (verify / token) → nasza sesja. */
export function toSession(j: any, now: number = Date.now()): SbSession {
  if (!j || !j.access_token || !j.refresh_token || !j.user) throw new SbError('Brak sesji w odpowiedzi', 'no_session', 0);
  const exp = j.expires_at ? j.expires_at * 1000 : now + (+j.expires_in || 3600) * 1000;
  const prov = (j.user.app_metadata && j.user.app_metadata.provider) || 'email';
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: exp, user: { id: j.user.id, email: j.user.email || '', provider: prov } };
}

export function isValidEmail(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()); }

/** Kod na e-mail (konto zakłada się przy pierwszym kodzie). redirectTo: dokąd prowadzi link z e-maila
 *  (domyślne szablony Supabase zawierają link zamiast kodu — wtedy powrót obsługuje sessionFromHash). */
export function sendEmailCode(email: string, redirectTo = '', f: Fetch = fetch): Promise<unknown> {
  return call(f, '/auth/v1/otp' + (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''), { email: email.trim().toLowerCase(), create_user: true });
}

/** Powrót z linku w e-mailu: #access_token=…&refresh_token=… → sesja (użytkownik z /auth/v1/user). null = to nie ten adres. */
export async function sessionFromHash(hash: string, f: Fetch = fetch, now: number = Date.now()): Promise<SbSession | null> {
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const access = h.get('access_token'), refreshTok = h.get('refresh_token');
  if (!access || !refreshTok) return null;
  const user = await call(f, '/auth/v1/user', undefined, access, 'GET');
  return toSession({ access_token: access, refresh_token: refreshTok, expires_at: +(h.get('expires_at') || 0) || undefined, expires_in: +(h.get('expires_in') || 0) || undefined, user }, now);
}

export async function verifyEmailCode(email: string, code: string, f: Fetch = fetch): Promise<SbSession> {
  return toSession(await call(f, '/auth/v1/verify', { type: 'email', email: email.trim().toLowerCase(), token: code.trim() }));
}

// ---- Google: przekierowanie z PKCE (kod jednorazowy wymieniany na sesję po powrocie do aplikacji) ----
function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function newVerifier(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return b64url(a);
}

export async function challengeOf(verifier: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(d));
}

/** Adres logowania Google; weryfikator zostaje w pamięci do powrotu. */
export async function googleUrl(redirectTo: string, kv: KV): Promise<string> {
  const v = newVerifier();
  kv.set(VERIFIER_KEY, v);
  const q = new URLSearchParams({ provider: 'google', redirect_to: redirectTo, code_challenge: await challengeOf(v), code_challenge_method: 's256' });
  return SB_URL + '/auth/v1/authorize?' + q.toString();
}

/** Po powrocie z Google: ?code=… → sesja. */
export async function exchangeCode(authCode: string, kv: KV, f: Fetch = fetch): Promise<SbSession> {
  const v = kv.get(VERIFIER_KEY);
  if (!v) throw new SbError('Logowanie zaczęło się w innej karcie albo przeglądarce', 'no_verifier', 0);
  kv.del(VERIFIER_KEY);
  return toSession(await call(f, '/auth/v1/token?grant_type=pkce', { auth_code: authCode, code_verifier: v }));
}

// ---- sesja ----
export function readSession(kv: KV): SbSession | null {
  try { const s = JSON.parse(kv.get(SESSION_KEY) || 'null'); return s && s.access_token && s.refresh_token && s.user ? s as SbSession : null; } catch { return null; }
}
export function saveSession(kv: KV, s: SbSession | null): void { if (s) kv.set(SESSION_KEY, JSON.stringify(s)); else kv.del(SESSION_KEY); }

export async function refresh(s: SbSession, f: Fetch = fetch): Promise<SbSession> {
  return toSession(await call(f, '/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token }));
}

// jedno odświeżanie naraz (token odświeżania jest jednorazowy — dwa równoległe unieważniłyby sesję)
let inflight: Promise<SbSession | null> | null = null;

/** Ważny token dostępu (odświeżony, gdy zostało < 2 min). null = brak sesji albo wylogowano gdzie indziej. */
export function freshSession(kv: KV, f: Fetch = fetch, now: () => number = Date.now): Promise<SbSession | null> {
  const s = readSession(kv);
  if (!s) return Promise.resolve(null);
  if (s.expires_at - now() > 120000) return Promise.resolve(s);
  if (!inflight) {
    inflight = refresh(s, f).then(n => { saveSession(kv, n); return n; }, (e: SbError) => {
      // odrzucony token odświeżania (np. „Wyloguj ze wszystkich urządzeń”) — sesja skończona; błąd sieci — spróbujemy później
      if (e instanceof SbError && e.status >= 400 && e.status < 500) { saveSession(kv, null); return null; }
      throw e;
    }).finally(() => { inflight = null; });
  }
  return inflight;
}

/** Wylogowanie: 'local' — to urządzenie, 'others' — pozostałe urządzenia (to zostaje zalogowane). */
export async function signOut(kv: KV, scope: 'local' | 'others', f: Fetch = fetch): Promise<void> {
  if (scope === 'others') {
    const s = await freshSession(kv, f);
    if (!s) throw new SbError('Sesja wygasła', 'no_session', 401);
    await call(f, '/auth/v1/logout?scope=others', undefined, s.access_token);
    return;
  }
  // to urządzenie: sesję usuwamy zawsze, nawet bez internetu (serwer i tak ją kiedyś unieważni)
  const s = readSession(kv);
  saveSession(kv, null);
  if (s) { try { await call(f, '/auth/v1/logout?scope=local', undefined, s.access_token); } catch { /* bez sieci / token już nieważny */ } }
}
