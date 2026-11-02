// Rekordy ćwiczeń: najcięższa seria, szacowany 1RM, objętość, powtórzenia przy ciężarze.
// Pierwszy trening ćwiczenia to punkt startowy, nie rekord.

export type Kind = 'kg' | 'reps' | 'time';
export interface WorkSet { kg: number; r: number }
export interface Session { iso: string; sets: WorkSet[]; full: boolean; phase3?: boolean }
export interface History { n: string; kind: Kind; timed: boolean; sess: Session[] }
export interface Metrics { top: number; e1: number; vol: number }
export type PrKind = 'top' | 'e1' | 'vol' | 'reps';
export type AnalyzedSession = Session & { m: Metrics; prs: PrKind[] };

/** Szacowany 1RM (Epley) — tylko z serii do 12 powtórzeń; inaczej 0 (brak szacunku). */
export function e1rm(kg: number, r: number): number {
  return kg > 0 && r >= 1 && r <= 12 ? kg * (1 + r / 30) : 0;
}

export function prMetrics(kind: Kind, s: Session): Metrics {
  if (kind === 'kg') return { top: Math.max(...s.sets.map(x => x.kg)), e1: Math.max(...s.sets.map(x => e1rm(x.kg, x.r))), vol: s.sets.reduce((a, x) => a + x.kg * x.r, 0) };
  return { top: Math.max(...s.sets.map(x => x.r)), e1: 0, vol: s.sets.reduce((a, x) => a + x.r, 0) };
}

/** Każdy trening z miarami i rekordami pobitymi względem wcześniejszych. Objętość tylko przy pełnym treningu. */
export function prAnalyze(h: History): AnalyzedSession[] {
  const best = { top: 0, e1: 0, vol: 0 }, seen: WorkSet[] = [];
  return h.sess.map((s, i) => {
    const m = prMetrics(h.kind, s), prs: PrKind[] = [];
    if (i > 0) {
      if (m.top > best.top) prs.push('top');
      if (h.kind === 'kg' && best.e1 > 0 && m.e1 > best.e1 + 0.01) prs.push('e1');
      if (s.full && best.vol > 0 && m.vol > best.vol) prs.push('vol');
      if (h.kind === 'kg' && !prs.includes('top') && s.sets.some(x => x.kg > 0 && x.r > Math.max(0, ...seen.filter(y => y.kg >= x.kg).map(y => y.r)))) prs.push('reps');
    }
    best.top = Math.max(best.top, m.top); best.e1 = Math.max(best.e1, m.e1); if (s.full) best.vol = Math.max(best.vol, m.vol);
    seen.push(...s.sets);
    return Object.assign({}, s, { m, prs });
  });
}

/** Najlepsze treningi: najcięższa seria (przy remisie więcej powtórzeń), 1RM, objętość (tylko pełne). */
export function prBest(kind: Kind, an: AnalyzedSession[]) {
  const pick = (f: (s: AnalyzedSession) => number) => an.reduce<AnalyzedSession | null>((b, s) => (!b || f(s) > f(b) ? s : b), null);
  return {
    top: pick(s => s.m.top * 1000 + (kind === 'kg' ? Math.max(...s.sets.filter(x => x.kg === s.m.top).map(x => x.r)) : 0)),
    e1: kind === 'kg' ? pick(s => s.m.e1) : null,
    vol: pick(s => (s.full ? s.m.vol : -1)),
  };
}
