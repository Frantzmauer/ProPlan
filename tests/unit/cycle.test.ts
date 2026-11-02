import { describe, expect, it } from 'vitest';
import { cycleDay, cycleForecast, cycleGaps, cycleLength, cyclePatterns, phaseNote, type Phase } from '../../app/lib/cycle';
import { checkinVerdict } from '../../app/lib/checkin';

const periods = [{ s: '2026-08-03', e: '2026-08-07' }, { s: '2026-09-01', e: '2026-09-05' }, { s: '2026-09-30', e: '2026-10-04' }, { s: '2026-10-29' }];

describe('cykl', () => {
  it('długość cyklu ze średniej odstępów; pomyłki (<15 dni) pomija', () => {
    expect(cycleGaps(periods)).toEqual([29, 29, 29]);
    expect(cycleLength(periods)).toBe(29);
    expect(cycleLength([{ s: '2026-10-01' }, { s: '2026-10-05' }])).toBe(28);
  });

  it('dzień i faza', () => {
    expect(cycleDay(periods, 'natural', '2026-10-30')).toMatchObject({ day: 2, phase: 'period', inPeriod: true });
    expect(cycleDay(periods, 'natural', '2026-10-10')).toMatchObject({ day: 11, phase: 'foll' });
    expect(cycleDay(periods, 'natural', '2026-10-15')).toMatchObject({ day: 16, phase: 'ov' });
    expect(cycleDay(periods, 'natural', '2026-10-25')).toMatchObject({ day: 26, phase: 'lut' });
    // przy antykoncepcji hormonalnej tylko okres, bez faz
    expect(cycleDay(periods, 'hormonal', '2026-10-25').phase).toBeNull();
  });

  it('okres bez zapisanego końca trwa 7 dni', () => {
    expect(cycleDay(periods, 'natural', '2026-11-04').inPeriod).toBe(true);
    expect(cycleDay(periods, 'natural', '2026-11-05').inPeriod).toBe(false);
  });

  it('prognoza następnego okresu i spóźnienie', () => {
    const f = cycleForecast(periods, 'natural', '2026-11-02');
    expect(f).toMatchObject({ next: '2026-11-27', from: '2026-11-25', to: '2026-11-29', in: 25, L: 29, late: 0 });
    expect(cycleForecast(periods, 'natural', '2026-12-02')?.late).toBe(3);
    expect(cycleForecast(periods, 'meno', '2026-11-02')).toBeNull();
    expect(cycleForecast(periods, 'irregular', '2026-11-02')).toMatchObject({ from: '2026-11-23', to: '2026-12-01' });
  });

  it('wzorce z check-inów i notka o słabszej fazie', () => {
    const phases: Record<string, Phase> = {};
    const points = [];
    for (let i = 0; i < 4; i++) { phases['l' + i] = 'lut'; points.push({ iso: 'l' + i, energy: 0, sleep: 0 }); }
    for (let i = 0; i < 4; i++) { phases['f' + i] = 'foll'; points.push({ iso: 'f' + i, energy: 2, sleep: 2 }); }
    const P = cyclePatterns(points, { l0: ['Ból głowy'], l1: ['Ból głowy'], l2: ['Ból głowy'] }, iso => phases[iso] || null);
    expect(P.ready).toBe(true);
    expect(P.by.lut).toMatchObject({ n: 4, energy: 0 });
    expect(P.sym['Ból głowy']).toMatchObject({ n: 3, lut: 3 });
    expect(phaseNote(P, 'lut')).toMatchObject({ low: true });
    expect(phaseNote(P, 'foll')).toMatchObject({ high: true });
    expect(phaseNote(P, 'ov')).toBeNull();
  });
});

describe('check-in', () => {
  const lut = cycleDay(periods, 'natural', '2026-10-25');
  it('brak odpowiedzi → brak propozycji', () => {
    expect(checkinVerdict({ sleep: 1, sore: 1 }, null, [], null)).toBeNull();
  });
  it('bez cyklu: suma odpowiedzi decyduje', () => {
    expect(checkinVerdict({ sleep: 2, sore: 1, energy: 1 }, null, [], null)?.plan).toBe('normal');
    expect(checkinVerdict({ sleep: 1, sore: 0, energy: 1 }, null, [], null)?.plan).toBe('light');
    expect(checkinVerdict({ sleep: 0, sore: 0, energy: 1 }, null, [], null)?.plan).toBe('light2');
  });
  it('okres ze skurczami → lżej albo ruch', () => {
    const per = cycleDay(periods, 'natural', '2026-10-30');
    expect(checkinVerdict({ sleep: 1, sore: 1, energy: 1 }, per, ['Skurcze'], null)).toMatchObject({ t: 'Okres z objawami', move: true });
  });
  it('Twoja słabsza faza przy granicznym dniu → lżej z dłuższymi przerwami', () => {
    const note = { low: true as const, b: { n: 4, energy: 0, sleep: 0, sore: 1 } };
    expect(checkinVerdict({ sleep: 2, sore: 1, energy: 1 }, lut, [], note)).toMatchObject({ t: 'Twoja słabsza faza', plan: 'light', rest: true });
    expect(checkinVerdict({ sleep: 2, sore: 2, energy: 1 }, lut, [], note)).toMatchObject({ plan: 'normal' });
  });
});
