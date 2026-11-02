// Kiedy jesz i kiedy zapisujesz: zwykła pora posiłku, opóźnienie zapisu, rodzaj znacznika.
// Czasy w minutach od północy (0–1439); zapis następnego dnia to minuty + 1440.
import { daysBetween, minuteOfDay, todayISO } from './dates';

export const MEAL_LATE = 45;          // zapis później niż tyle minut po zjedzeniu = nie na bieżąco
export const EVENING = 20 * 60 + 30;  // od 20:30 zapis liczy się jako wieczorny
export const DEFAULT_TIMES: Record<string, number> = { 'Śniadanie': 480, 'Przekąska': 660, 'Obiad': 840, 'Po treningu': 1080, 'Kolacja': 1170 };

/** Zwykła pora: mediana z co najmniej 3 zapisów, inaczej pora domyślna danego posiłku (albo 12:00). */
export function usualTime(values: number[], tag: string): number {
  const v = values.slice().sort((a, b) => a - b);
  return v.length >= 3 ? v[Math.floor(v.length / 2)] : (DEFAULT_TIMES[tag] ?? 720);
}

export interface MealEntry { ate: number; logged: number; lag: number }

/**
 * Jeden zapis posiłku dnia iso: kiedy zjedzony, kiedy zapisany.
 * Bez zapisanej pory zjedzenia, przy zapisie ponad 2 h po zwykłej porze, przyjmujemy zwykłą porę
 * (inaczej stare wieczorne wpisy wyglądałyby na „na bieżąco”).
 */
export function mealEntry(iso: string, loggedAt: number, ate: number | null | undefined, usual: number): MealEntry {
  const logDay = todayISO(new Date(loggedAt));
  const logged = minuteOfDay(loggedAt) + (logDay > iso ? 1440 * daysBetween(iso, logDay) : 0);
  const a = ate != null && ate >= 0 ? ate : (logged - usual > 120 ? usual : logged);
  return { ate: a, logged, lag: logged - a };
}

export type StampKind = 'now' | 'late' | 'eve' | 'after';
export function stampKind(e: MealEntry): StampKind {
  if (e.lag <= MEAL_LATE) return 'now';
  if (e.logged >= 1440) return 'after';
  if (e.logged >= EVENING) return 'eve';
  return 'late';
}

/** 'GG:MM' z minut (po północy liczy się od nowa). */
export function hm(m: number): string {
  return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
