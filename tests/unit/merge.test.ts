import { describe, expect, it } from 'vitest';
import { COACH_KEEP, COACH_KEEP_ADMIN, coachKeep, mergeState } from '../../app/lib/merge.js';

// minimalny stan aplikacji — tylko pola, które scalanie zawsze czyta
const base = (o: Record<string, unknown> = {}) => ({ log: {}, weights: [], measures: [], shop: {}, ...o });

describe('scalanie danych z dwóch urządzeń', () => {
  it('odhaczone posiłki z obu stron zostają odhaczone', () => {
    const a = base({ log: { '2026-11-01': { meals: { m0: true }, ex: {}, habits: {}, _m: 1 } } });
    const b = base({ log: { '2026-11-01': { meals: { m1: true }, ex: {}, habits: {}, _m: 2 } } });
    const m = mergeState(a, b).log['2026-11-01'].meals;
    expect(m).toEqual({ m0: true, m1: true });
  });

  it('późniejsze odznaczenie wygrywa z wcześniejszym zaznaczeniem', () => {
    const a = base({ log: { d: { meals: { m0: true }, _t: { 'meal:m0': 10 }, _m: 10 } } });
    const b = base({ log: { d: { meals: { m0: false }, _t: { 'meal:m0': 20 }, _m: 20 } } });
    expect(mergeState(a, b).log.d.meals.m0).toBe(false);
    expect(mergeState(b, a).log.d.meals.m0).toBe(false);
  });

  it('godzina zjedzenia: nowsza zmiana wygrywa, pominięty (-1) zostaje', () => {
    const a = base({ log: { d: { meals: { m0: true }, ate: { m0: 480 }, _t: { 'ate:m0': 5 }, _m: 5 } } });
    const b = base({ log: { d: { meals: { m0: true }, ate: { m0: 500, m1: -1 }, _t: { 'ate:m0': 9, 'ate:m1': 9 }, _m: 9 } } });
    expect(mergeState(a, b).log.d.ate).toEqual({ m0: 500, m1: -1 });
    expect(mergeState(b, a).log.d.ate).toEqual({ m0: 500, m1: -1 });
  });

  it('wagi z dwóch urządzeń łączą się po dacie', () => {
    const a = base({ weights: [{ d: '2026-11-01', w: 80 }] });
    const b = base({ weights: [{ d: '2026-11-02', w: 79.5 }] });
    expect(mergeState(a, b).weights.map((w: { d: string }) => w.d)).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('ustawienia (cel kalorii, plan od Trenera) bierze nowsza strona', () => {
    const a = base({ kcalGoal: 2000, _settingsM: 1, adj: { kcal: { hist: [] } } });
    const b = base({ kcalGoal: 2200, _settingsM: 2, adj: { kcal: { hist: [{ d: '2026-11-02', kcal: 2200, prev: 2000 }] } } });
    const m = mergeState(a, b);
    expect(m.kcalGoal).toBe(2200);
    expect(m.adj.kcal.hist).toHaveLength(1);
  });

  it('nie zmienia obiektów wejściowych', () => {
    const a = base({ log: { d: { meals: { m0: true }, _m: 1 } } });
    const snap = JSON.stringify(a);
    mergeState(a, base({ log: { d: { meals: { m1: true }, _m: 2 } } }));
    expect(JSON.stringify(a)).toBe(snap);
  });
});

describe('czat z Trenerem: ile wiadomości zostaje', () => {
  const msgs = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: 'x' + (from + i), t: from + i + 1, role: 'user', content: '' }));

  it('zwykłe konto: 40 ostatnich wiadomości', () => {
    const m = mergeState(base({ coach: { clearedAt: 0, msgs: msgs(30) } }), base({ coach: { clearedAt: 0, msgs: msgs(30, 30) } }));
    expect(m.coach.msgs).toHaveLength(COACH_KEEP);
    expect(m.coach.msgs[0].id).toBe('x20');
    expect(m.coach.keep).toBeUndefined();
  });

  it('administrator (keep=100 po którejkolwiek stronie): do 100 wiadomości', () => {
    const m = mergeState(base({ coach: { clearedAt: 0, keep: 100, msgs: msgs(70) } }), base({ coach: { clearedAt: 0, msgs: msgs(50, 70) } }));
    expect(m.coach.msgs).toHaveLength(COACH_KEEP_ADMIN);
    expect(m.coach.keep).toBe(100);
  });

  it('keep spoza zakresu wraca do 40–100', () => {
    expect(coachKeep({ keep: 5000 })).toBe(COACH_KEEP_ADMIN);
    expect(coachKeep({ keep: 3 }, null)).toBe(COACH_KEEP);
    expect(coachKeep()).toBe(COACH_KEEP);
  });
});

describe('posiłek zastąpiony własnym („Zamień”)', () => {
  it('powiązanie z posiłkiem z planu przetrwa scalanie', () => {
    const own = { txt: 'Kurczak z puree', kcal: 331, p: 17, c: 0, f: 0, done: true, _t: 5, rep: 'm3' };
    const a = base({ log: { d: { meals: {}, custom: [own], ate: { m3: -1 }, _t: { 'ate:m3': 5 }, _m: 5 } } });
    const b = base({ log: { d: { meals: { m0: true }, _t: { 'meal:m0': 3 }, _m: 3 } } });
    const L = mergeState(b, a).log.d;
    expect(L.custom[0].rep).toBe('m3');
    expect(L.ate.m3).toBe(-1);
  });
});
