// Sesja Supabase na tym urządzeniu (localStorage) i token dostępu dla wywołań serwera.
import { freshSession, readSession, type KV } from '../lib/sbauth';
import { t } from '../lib/i18n';

export const KV_LS: KV = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* pełna pamięć / tryb prywatny */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* jw. */ } },
};

export function sbSession(){ return readSession(KV_LS); }

/** Ważny token dostępu; bez sesji (wylogowano, np. „ze wszystkich urządzeń”) — błąd z prośbą o logowanie. */
export async function sbAccess(): Promise<string> {
  const s = await freshSession(KV_LS);
  if (!s) throw new Error(t('Sesja wygasła — zaloguj się ponownie (Więcej → Konto).'));
  return s.access_token;
}
