import { describe, expect, it } from 'vitest';
import { dietScore, dietTip } from '../../app/lib/dietday';

// cel jak u właściciela: 2100 kcal, 180 g białka → zaliczone 1785–2310 kcal i co najmniej 144 g białka
const goal = { kcal: 2100, p: 180 };

describe('dzień diety zaliczony', () => {
  it('kcal 85–110% celu i białko ≥ 80% — zaliczony, niezależnie od źródła posiłków', () => {
    const s = dietScore({ kcal: 2000, p: 150 }, goal);
    expect(s).toMatchObject({ ok: true, lo: 1785, hi: 2310, pMin: 144 });
    expect(dietTip({ kcal: 2000, p: 150 }, s)).toBe('');
  });

  it('granice są włącznie', () => {
    expect(dietScore({ kcal: 1785, p: 144 }, goal).ok).toBe(true);
    expect(dietScore({ kcal: 2310, p: 144 }, goal).ok).toBe(true);
    expect(dietScore({ kcal: 2311, p: 200 }, goal).ok).toBe(false);
  });

  it('za mało białka (03.11: 1883 kcal, 137 g) — nie zaliczony, z podpowiedzią', () => {
    const s = dietScore({ kcal: 1883, p: 137 }, goal);
    expect(s).toMatchObject({ ok: false, kcalOk: true, pOk: false, kcalPct: 90, pPct: 76 });
    expect(dietTip({ kcal: 1883, p: 137 }, s)).toMatch(/^Brakuje 7 g białka/);
  });

  it('niedojadanie nie zalicza dnia (dawniej „≤ cel” wystarczało)', () => {
    const s = dietScore({ kcal: 1100, p: 150 }, goal);
    expect(s.ok).toBe(false);
    expect(dietTip({ kcal: 1100, p: 150 }, s)).toBe('Do zaliczenia brakuje 685 kcal.');
  });

  it('za dużo kalorii', () => {
    const s = dietScore({ kcal: 2600, p: 190 }, goal);
    expect(s.kcalOk).toBe(false);
    expect(dietTip({ kcal: 2600, p: 190 }, s)).toMatch(/^Ponad 2310 kcal/);
  });
});
