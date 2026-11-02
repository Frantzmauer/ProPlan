// Cykl: dzień i faza, długość cyklu, prognoza następnego okresu, wzorce z check-inów.
// Same obliczenia — dane (okresy, sytuacja, objawy) podaje main.js z magazynu cyklu.
import { addDays, daysBetween } from './dates';

export type Phase = 'period' | 'foll' | 'ov' | 'lut';
export const PHASES: Phase[] = ['period', 'foll', 'ov', 'lut'];

export interface Period { s: string; e?: string | null; still?: string; auto?: boolean; flow?: Record<string, string>; longNote?: boolean }

export interface CycleDay { day: number | null; phase: Phase | null; inPeriod: boolean; p?: Period; len?: number; sit: string }

/** Odstępy między kolejnymi okresami (15–60 dni; krótsze/dłuższe to zwykle pomyłka), ostatnie 6. */
export function cycleGaps(periods: Period[]): number[] {
  const s = periods.map(p => p.s), d: number[] = [];
  for (let i = 1; i < s.length; i++) { const x = daysBetween(s[i - 1], s[i]); if (x >= 15 && x <= 60) d.push(x); }
  return d.slice(-6);
}

/** Średnia długość cyklu; bez danych 28 dni. */
export function cycleLength(periods: Period[]): number {
  const g = cycleGaps(periods);
  return g.length ? Math.round(g.reduce((a, b) => a + b, 0) / g.length) : 28;
}

/**
 * Dzień cyklu i faza w dniu iso. Faza tylko w naturalnym cyklu i najwyżej 10 dni po spodziewanym okresie.
 * Okres bez zapisanego końca trwa 7 dni albo do dnia po „jeszcze trwa”.
 */
export function cycleDay(periods: Period[], sit: string, iso: string): CycleDay {
  const ps = periods.filter(p => p.s <= iso), p = ps[ps.length - 1];
  if (!p) return { day: null, phase: null, inPeriod: false, sit };
  const day = daysBetween(p.s, iso) + 1, L = cycleLength(periods);
  const inPeriod = p.e ? iso <= p.e : (day <= 7 || !!(p.still && iso <= addDays(p.still, 1)));
  let phase: Phase | null = null;
  if (sit === 'natural' && day <= L + 10) phase = inPeriod ? 'period' : day <= L - 16 ? 'foll' : day <= L - 12 ? 'ov' : 'lut';
  else if (inPeriod) phase = 'period';
  return { day, phase, inPeriod, p, len: L, sit };
}

export interface Forecast {
  next: string; from: string; to: string; in: number; L: number; n: number;
  min: number | null; max: number | null; pre: string; late: number; sit: string;
}

/** Prognoza następnego okresu: ostatni + średnia; rozrzut z odchylenia (min. 2 dni, nieregularny 4, max 7). */
export function cycleForecast(periods: Period[], sit: string, today: string): Forecast | null {
  if (sit !== 'natural' && sit !== 'irregular') return null;
  if (!periods.length) return null;
  const g = cycleGaps(periods), L = cycleLength(periods);
  const sd = g.length >= 3 ? Math.sqrt(g.reduce((a, x) => a + (x - L) ** 2, 0) / g.length) : null;
  const spread = Math.min(7, Math.max(sit === 'irregular' ? 4 : 2, sd != null ? Math.round(sd) : 3));
  const next = addDays(periods[periods.length - 1].s, L), to = addDays(next, spread);
  return {
    next, from: addDays(next, -spread), to, in: daysBetween(today, next), L, n: g.length,
    min: g.length ? Math.min(...g) : null, max: g.length ? Math.max(...g) : null,
    pre: addDays(next, -7), late: today > to ? daysBetween(to, today) : 0, sit,
  };
}

export interface PhaseStat { n: number; energy: number; sleep: number; sore: number }
export type SymptomStat = { n: number } & Partial<Record<Phase, number>>;
export interface Patterns { by: Partial<Record<Phase, PhaseStat>>; sym: Record<string, SymptomStat>; ready: boolean; n: number; overall: number }
export interface CheckinPoint { iso: string; energy: number; sleep?: number; sore?: number }

/**
 * Średnie z check-inów (energia, sen, zakwasy 0–2) w każdej fazie i fazy, w których pojawiają się objawy.
 * Gotowe, gdy są co najmniej 3 check-iny w dwóch fazach.
 */
export function cyclePatterns(points: CheckinPoint[], symptoms: Record<string, string[]>, phaseOf: (iso: string) => Phase | null): Patterns {
  const by: Partial<Record<Phase, PhaseStat>> = {};
  let n = 0, e = 0;
  points.forEach(pt => {
    const ph = phaseOf(pt.iso); if (!ph) return;
    const b = by[ph] || (by[ph] = { n: 0, energy: 0, sleep: 0, sore: 0 });
    b.n++; b.energy += pt.energy; b.sleep += pt.sleep || 0; b.sore += pt.sore || 0; n++; e += pt.energy;
  });
  Object.values(by).forEach(b => { if (b) { b.energy /= b.n; b.sleep /= b.n; b.sore /= b.n; } });
  const sym: Record<string, SymptomStat> = {};
  Object.keys(symptoms).forEach(iso => {
    const ph = phaseOf(iso); if (!ph) return;
    symptoms[iso].forEach(x => { const o = sym[x] || (sym[x] = { n: 0 }); o.n++; o[ph] = (o[ph] || 0) + 1; });
  });
  const ready = Object.values(by).filter(b => b && b.n >= 3).length >= 2;
  return { by, sym, ready, n, overall: n ? e / n : 0 };
}

export type PhaseNote = { low: true; b: PhaseStat } | { high: true; b: PhaseStat } | null;

/** Czy ta faza jest u kogoś zwykle słabsza / mocniejsza niż średnio (energia w check-inie, różnica ≥ 0,35). */
export function phaseNote(P: Patterns | null, phase: Phase | null): PhaseNote {
  if (!P || !P.ready || !phase) return null;
  const b = P.by[phase]; if (!b || b.n < 3) return null;
  const d = b.energy - P.overall;
  return d <= -0.35 ? { low: true, b } : d >= 0.35 ? { high: true, b } : null;
}
