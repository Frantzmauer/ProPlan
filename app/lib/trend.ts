// Kalorie z trendu wagi: rzeczywisty wydatek z danych użytkownika (jak w MacroFactor).
// Wydatek = średnie kalorie z dni z pełnym zapisem − zmiana wagi (nachylenie prostej, 1 kg ≈ 7700 kcal).
import { addDays, daysBetween } from './dates';

export interface WeightEntry { d: string; w: number }
export interface TrendNeed { w: number; span: number; days: number }
export type TrendEstimate =
  | { ok: false; need: TrendNeed; odd?: boolean }
  | { ok: true; need: TrendNeed; tdee: number; avg: number; weekly: number; weight: number };

export const TREND = {
  WINDOW: 28,         // dni wstecz od dziś
  MIN_SPAN: 14,       // ważenia rozciągnięte na co najmniej tyle dni
  MIN_WEIGHINGS: 6,
  MIN_DAYS: 10,       // dni z pełnym zapisem jedzenia
  EVERY: 14,          // propozycja zmiany celu nie częściej niż co tyle dni
  KCAL_PER_KG: 7700,
} as const;

/** Nachylenie prostej przez ważenia (kg na dzień) — mniej czułe na wodę niż różnica pierwszego i ostatniego. */
export function weightSlope(ws: WeightEntry[]): number {
  if (ws.length < 2) return 0;
  const xs = ws.map(w => daysBetween(ws[0].d, w.d));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ws.reduce((a, w) => a + w.w, 0) / ws.length;
  let num = 0, den = 0;
  ws.forEach((w, i) => { num += (xs[i] - mx) * (w.w - my); den += (xs[i] - mx) ** 2; });
  return den ? num / den : 0;
}

/**
 * @param weights wszystkie ważenia (wybierane są te z okna 28 dni do dziś)
 * @param intakes kalorie dni z pełnym zapisem jedzenia z tego samego okna (bez dzisiaj)
 */
export function estimateExpenditure(weights: WeightEntry[], intakes: number[], today: string): TrendEstimate {
  const from = addDays(today, -TREND.WINDOW);
  const ws = weights.filter(w => w.d >= from && w.d <= today && w.w > 0).sort((a, b) => (a.d < b.d ? -1 : 1));
  const span = ws.length > 1 ? daysBetween(ws[0].d, ws[ws.length - 1].d) : 0;
  const need = { w: ws.length, span, days: intakes.length };
  if (ws.length < TREND.MIN_WEIGHINGS || span < TREND.MIN_SPAN || intakes.length < TREND.MIN_DAYS) return { ok: false, need };
  const slope = weightSlope(ws), avg = intakes.reduce((a, b) => a + b, 0) / intakes.length;
  const tdee = Math.round(avg - slope * TREND.KCAL_PER_KG);
  if (tdee < 1200 || tdee > 5500) return { ok: false, need, odd: true };
  return { ok: true, need, tdee, avg: Math.round(avg), weekly: slope * 7, weight: ws[ws.length - 1].w };
}

/**
 * Nowy cel kalorii, który zachowuje zamierzony deficyt (wzór − obecny cel).
 * Najwyżej ±300 kcal naraz, spadek nie szybszy niż 1% masy ciała na tydzień, w granicach suwaka 1500–3200.
 */
export function proposeGoal(e: { tdee: number; weight: number }, goal: number, formula: number): number {
  const deficit = formula - goal;
  let to = Math.round((e.tdee - deficit) / 100) * 100;
  to = Math.max(goal - 300, Math.min(goal + 300, to));
  const maxDef = e.weight * 0.01 * TREND.KCAL_PER_KG / 7;
  if (e.tdee - to > maxDef) to = Math.ceil((e.tdee - maxDef) / 100) * 100;
  return Math.max(1500, Math.min(3200, to));
}
