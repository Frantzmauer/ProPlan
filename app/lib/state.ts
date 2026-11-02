// Stan aplikacji: wartości startowe, migracja starszych zapisów, znaczniki czasu pól do scalania.
// Sam stan (S) trzyma main.js; tu są tylko funkcje, które na nim operują.

export type AppState = Record<string, any>;
export type DayLog = Record<string, any>;

export const DEFAULT_PROFILE = { weight: 104, height: 186, age: 45, sex: 'm', activity: 1.465, name: '' };

export function defaultState(startDate: string, kcalGoal: number): AppState {
  return {
    startDate, kcalGoal, profile: { ...DEFAULT_PROFILE }, log: {}, weights: [], custom: {}, shop: {}, shopT: {},
    reminders: { on: false, workout: '17:30', meal: '12:00', water: '15:00', weight: '07:00' }, streak: 0, lastStreakDay: null,
  };
}

/** Dokłada pola, których mogło nie być we wcześniejszych wersjach aplikacji. */
export function migrateState(r: AppState, kcalGoal: number): AppState {
  if (!r.profile) r.profile = { ...DEFAULT_PROFILE };
  if (!r.custom) r.custom = {};
  if (r.kcalGoal === undefined) r.kcalGoal = kcalGoal;
  return r;
}

/** Czy na urządzeniu są czyjeś dane (dziennik, waga, obwody, posiłki, imię) — przed nadpisaniem innym kontem. */
export function hasUserData(S: AppState): boolean {
  return Object.keys(S.log || {}).length > 0 || (S.weights || []).length > 0 || (S.measures || []).length > 0
    || Object.keys(S.custom || {}).length > 0 || !!(S.profile && S.profile.name);
}

/** Znacznik czasu pojedynczego pola dnia (dla scalania „nowsza zmiana wygrywa”). */
export function mark(L: DayLog | null | undefined, field: string, now: number = Date.now()): void {
  if (!L) return;
  if (!L._t) L._t = {};
  L._t[field] = now;
  L._m = now;
}
export function touch(L: DayLog | null | undefined, now: number = Date.now()): void { if (L) L._m = now; }
export function fieldTime(L: DayLog | null | undefined, field: string): number {
  return (L && L._t && L._t[field]) || (L && L._m) || 0;
}

/** Dane z serwera bez znaczników czasu (stary skrypt) dostają bardzo stary znacznik, żeby świeże lokalne zmiany wygrywały. */
export function normalizeIncoming<T>(inc: T): T {
  if (!inc || typeof inc !== 'object') return inc;
  const x = inc as AppState;
  if (x.shop) {
    if (!x.shopT) x.shopT = {};
    Object.keys(x.shop).forEach(k => { if (x.shopT[k] === undefined) x.shopT[k] = 1; });
  }
  return inc;
}
