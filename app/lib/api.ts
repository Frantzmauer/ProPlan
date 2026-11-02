// Połączenie z serwerem (Google Apps Script) i wersja aplikacji z adresu.
// Zapytania jako text/plain — bez wstępnego zapytania CORS, którego Apps Script nie obsługuje.

export type Channel = 'stable' | 'beta' | 'zeta' | 'early' | 'users';

/** Wersja z adresu: stabilna w katalogu głównym, pozostałe w /beta/, /early/, /users/. */
export function channelFromPath(pathname: string): Channel {
  const m = pathname.match(/\/(beta|zeta|early|users)\/(index\.html)?$/);
  return (m ? m[1] : 'stable') as Channel;
}

export interface CloudConfig { url: string; token: string; account: string; on: boolean; lastSync: number; lastError: string; pending?: boolean }
export const EMPTY_CLOUD: CloudConfig = { url: '', token: '', account: '', on: false, lastSync: 0, lastError: '' };

/** Błąd z serwera; data = cała odpowiedź (np. limit planu i stan licznika). */
export class ApiError extends Error {
  data: Record<string, unknown>;
  constructor(message: string, data: Record<string, unknown>) { super(message); this.data = data; }
}

export async function apiCall(cfg: Pick<CloudConfig, 'url' | 'token' | 'account'>, channel: string, action: string,
  payload: Record<string, unknown> = {}, fetchImpl: typeof fetch = fetch): Promise<any> {
  const body = JSON.stringify(Object.assign({ action, token: cfg.token, account: (cfg.account || '').trim().toLowerCase(), channel }, payload));
  const res = await fetchImpl(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
  const txt = await res.text();
  let j: any;
  try { j = JSON.parse(txt); } catch { throw new Error('Zła odpowiedź serwera (sprawdź URL wdrożenia)'); }
  if (!j || !j.ok) throw new ApiError((j && j.error) || 'Błąd serwera', j || {});
  return j;
}

/** Brak sieci (a nie błąd serwera): telefon offline albo przeglądarka nie połączyła się wcale. */
export function isNetworkError(e: unknown, online: boolean): boolean {
  const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as Error).message) : '';
  return !online || /failed to fetch|load failed|networkerror|network request failed/i.test(msg);
}
