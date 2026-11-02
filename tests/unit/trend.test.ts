import { describe, expect, it } from 'vitest';
import { addDays } from '../../app/lib/dates';
import { estimateExpenditure, proposeGoal, weightSlope } from '../../app/lib/trend';

const today = '2026-11-02';
// ważenia co 2 dni przez 24 dni, spadek 0,5 kg/tydz.
const weights = Array.from({ length: 13 }, (_, i) => ({ d: addDays(today, -24 + i * 2), w: 80 - (i * 2) * 0.5 / 7 }));
const intakes = Array(20).fill(2000);

describe('kalorie z trendu wagi', () => {
  it('nachylenie prostej to tempo zmiany wagi', () => {
    expect(weightSlope(weights) * 7).toBeCloseTo(-0.5, 5);
  });

  it('wydatek = średnio zjedzone + spadek wagi w kcal', () => {
    const e = estimateExpenditure(weights, intakes, today);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.tdee).toBe(2550);            // 2000 + 0,5 kg × 7700 / 7
    expect(e.avg).toBe(2000);
    expect(e.weekly).toBeCloseTo(-0.5, 5);
  });

  it('za mało danych — mówi, czego brakuje', () => {
    const e = estimateExpenditure(weights.slice(-4), intakes.slice(0, 5), today);
    expect(e).toEqual({ ok: false, need: { w: 4, span: 6, days: 5 } });
  });

  it('ważenia spoza 28 dni się nie liczą', () => {
    const old = [{ d: addDays(today, -40), w: 90 }, ...weights];
    const e = estimateExpenditure(old, intakes, today);
    expect(e.ok && e.tdee).toBe(2550);
  });

  it('nierealny wynik (np. niepełny zapis) nie daje propozycji', () => {
    expect(estimateExpenditure(weights, Array(20).fill(300), today)).toMatchObject({ ok: false, odd: true });
  });

  it('propozycja zachowuje zamierzony deficyt, najwyżej ±300 kcal', () => {
    // wzór 2700, cel 2200 → deficyt 500; rzeczywisty wydatek 2550 → 2050, zaokrąglone do 100
    expect(proposeGoal({ tdee: 2550, weight: 80 }, 2200, 2700)).toBe(2100);
    // wydatek wyższy → najwyżej +300 naraz
    expect(proposeGoal({ tdee: 3100, weight: 80 }, 2200, 2700)).toBe(2500);
    // …chyba że wtedy deficyt przekroczyłby 1% masy ciała na tydzień — bezpieczeństwo wygrywa z limitem kroku
    expect(proposeGoal({ tdee: 3500, weight: 80 }, 2200, 2700)).toBe(2700);
  });

  it('propozycja nie schodzi poniżej 1% masy ciała na tydzień ani poza suwak', () => {
    // 60 kg: maks. deficyt 660 kcal; wydatek 2000 → co najmniej 1400 → granica suwaka 1500
    expect(proposeGoal({ tdee: 2000, weight: 60 }, 1600, 2400)).toBe(1500);
  });
});
