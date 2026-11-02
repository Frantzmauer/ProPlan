// Pamięć telefonu (localStorage): klucze i bezpieczny odczyt/zapis JSON.
// W prywatnym oknie albo przy pełnej pamięci zapis może się nie udać — wtedy zwracamy false zamiast przerywać aplikację.

export const KEYS = {
  STATE: 'zelazo_v1',        // dane użytkownika (dziennik, waga, profil, ustawienia)
  CLOUD: 'zelazo_cloud',     // połączenie z serwerem na tym urządzeniu (adres, konto, token)
  CYCLE: 'zelazo_cycle',     // cykl — domyślnie tylko na telefonie
  QUOTA: 'zelazo_quota',     // ostatni znany stan limitów planu
  plan: (channel: string) => 'zelazo_plan_' + channel,   // plan i funkcje — osobno dla każdej wersji
} as const;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
