import { describe, expect, it } from 'vitest';
import { mergeState } from '../../app/lib/merge.js';

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
