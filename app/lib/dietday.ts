import { t } from './i18n';
// Dzień diety zaliczony: kalorie blisko celu i dość białka — bez znaczenia, czy z posiłków z planu, czy własnych.
// Ta sama reguła: Dieta (karta „Dzień diety”), serie i kalendarz, Trener (opis w kontekście).

export const KCAL_LO = 0.85;   // od 85% celu kalorii…
export const KCAL_HI = 1.10;   // …do 110%
export const PROT_MIN = 0.80;  // białko co najmniej 80% celu

export interface DietScore {
  ok: boolean; kcalOk: boolean; pOk: boolean;
  lo: number; hi: number; pMin: number;   // granice w kcal i g
  kcalPct: number; pPct: number;          // zjedzone jako % celu (zaokrąglone)
}

/** Ocena dnia z sum (kcal, białko) i celu dnia. */
export function dietScore(tot: { kcal: number; p: number }, goal: { kcal: number; p: number }): DietScore {
  const lo = Math.round(goal.kcal * KCAL_LO), hi = Math.round(goal.kcal * KCAL_HI), pMin = Math.round(goal.p * PROT_MIN);
  const kcal = Math.round(tot.kcal || 0), p = Math.round(tot.p || 0);
  const kcalOk = kcal >= lo && kcal <= hi, pOk = p >= pMin;
  return { ok: kcalOk && pOk, kcalOk, pOk, lo, hi, pMin,
    kcalPct: goal.kcal ? Math.round(kcal / goal.kcal * 100) : 0, pPct: goal.p ? Math.round(p / goal.p * 100) : 0 };
}

/** Krótka podpowiedź, czego brakuje do zaliczenia (pusty tekst, gdy dzień jest zaliczony). */
export function dietTip(tot: { kcal: number; p: number }, s: DietScore): string {
  const kcal = Math.round(tot.kcal || 0), p = Math.round(tot.p || 0);
  if (kcal > s.hi) return t('Ponad {n} kcal — ten dzień nie będzie zaliczony.', { n: s.hi });
  if (!s.kcalOk) return s.pOk ? t('Do zaliczenia brakuje {k} kcal.', { k: s.lo - kcal }) : t('Do zaliczenia brakuje {k} kcal i {p} g białka.', { k: s.lo - kcal, p: s.pMin - p });
  if (!s.pOk) return t('Brakuje {p} g białka — np. skyr 330 ml (~33 g) albo twaróg 200 g (~36 g).', { p: s.pMin - p });
  return '';
}
