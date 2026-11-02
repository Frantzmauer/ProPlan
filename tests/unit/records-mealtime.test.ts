import { describe, expect, it } from 'vitest';
import { e1rm, prAnalyze, prBest, type History } from '../../app/lib/records';
import { hm, mealEntry, stampKind, usualTime } from '../../app/lib/mealtime';
import { parseISO } from '../../app/lib/dates';

describe('rekordy', () => {
  it('1RM tylko z serii do 12 powtórzeń', () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 2);
    expect(e1rm(130, 14)).toBe(0);
  });

  const h: History = { n: 'Przysiad', kind: 'kg', timed: false, sess: [
    { iso: '2026-10-20', full: true, sets: [{ kg: 100, r: 5 }, { kg: 100, r: 5 }] },
    { iso: '2026-10-24', full: true, sets: [{ kg: 105, r: 5 }, { kg: 100, r: 6 }] },
    { iso: '2026-10-28', full: false, sets: [{ kg: 105, r: 6 }] },
  ] };

  it('pierwszy trening to punkt startowy, potem rekordy', () => {
    const an = prAnalyze(h);
    expect(an[0].prs).toEqual([]);
    expect(an[1].prs).toEqual(['top', 'e1', 'vol']);
    expect(an[2].prs).toEqual(['e1', 'reps']);   // niepełny trening: bez rekordu objętości
  });

  it('najlepsze: przy tym samym ciężarze wygrywa więcej powtórzeń; objętość tylko z pełnych', () => {
    const b = prBest('kg', prAnalyze(h));
    expect(b.top?.iso).toBe('2026-10-28');
    expect(b.vol?.iso).toBe('2026-10-24');
  });
});

describe('godziny posiłków', () => {
  const at = (iso: string, min: number) => parseISO(iso).getTime() + min * 60000;

  it('zwykła pora: mediana z 3+ zapisów, inaczej domyślna', () => {
    expect(usualTime([830, 850, 840, 900], 'Obiad')).toBe(850);
    expect(usualTime([830], 'Obiad')).toBe(840);
    expect(usualTime([], 'Nieznany')).toBe(720);
  });

  it('zapis na bieżąco, później, wieczorem i następnego dnia', () => {
    const iso = '2026-11-02';
    expect(stampKind(mealEntry(iso, at(iso, 860), 840, 840))).toBe('now');
    expect(stampKind(mealEntry(iso, at(iso, 990), 840, 840))).toBe('late');
    expect(stampKind(mealEntry(iso, at(iso, 1290), 840, 840))).toBe('eve');
    expect(stampKind(mealEntry(iso, at('2026-11-03', 480), 840, 840))).toBe('after');
  });

  it('bez godziny zjedzenia: późny zapis liczy się od zwykłej pory', () => {
    const iso = '2026-11-02';
    expect(mealEntry(iso, at(iso, 1290), null, 840)).toEqual({ ate: 840, logged: 1290, lag: 450 });
    expect(mealEntry(iso, at(iso, 870), undefined, 840).lag).toBe(0);
  });

  it('format godziny', () => {
    expect(hm(845)).toBe('14:05');
    expect(hm(1440 + 30)).toBe('00:30');
  });
});
