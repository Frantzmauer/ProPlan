import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { applyBody, bodyTimeline, bodyWeightStart, fitBody, measureRings, parseBody, predictBody, weightOn } from '../../app/lib/body';

// prawdziwe pliki modelu z repozytorium (tools/body_model.py)
const load = (sex: string) => { const b = gunzipSync(readFileSync(`models/body-${sex}.zbm`)); return parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const male = load('male'), female = load('female');

describe('sylwetka 3D: plik modelu', () => {
  it('ma siatkę, trójkąty i wszystkie kształty w obie strony', () => {
    for (const m of [male, female]) {
      expect(m.positions.length).toBe(m.header.nv * 3);
      expect(m.indices.length).toBe(m.header.nt * 3);
      expect(Math.max(...m.indices)).toBeLessThan(m.header.nv);
      expect(m.header.groups.skin[1] + m.header.groups.cloth[1]).toBe(m.header.nt);   // skóra + spodenki
      expect(m.header.groups.cloth[1]).toBeGreaterThan(500);
      expect(m.top.length).toBe(m.header.nv);
      for (const n of ['weight', 'muscle', 'height', 'waist', 'chest', 'hips', 'arm', 'thigh', 'stomach'])
        for (const s of ['+', '-']) expect(m.morphs.get(n + s)?.d.length).toBe(m.header.nv * 3);
    }
    expect(male.header.sex).toBe('male');
    expect(male.top.some(Boolean)).toBe(false);
    expect(female.top.filter(Boolean).length).toBeGreaterThan(300);   // top tylko w sylwetce kobiecej
    expect(female.header.base.height).toBeLessThan(male.header.base.height);
  });
});

describe('sylwetka 3D: dopasowanie do pomiarów', () => {
  it('bez pomiarów zostaje sylwetka bazowa', () => {
    expect(Object.values(fitBody(male.header, {})).every(v => v === 0)).toBe(true);
  });

  it('mężczyzna 180 cm, pas 105, klatka 115, biodra 104, udo 63, ramię 38,5 — model w granicach kilku cm', () => {
    const t = { height: 180, waist: 105, chest: 115, hips: 104, thigh: 63, arm: 38.5 };
    const p = predictBody(male.header, fitBody(male.header, t));
    expect(Math.abs(p.height - 180)).toBeLessThan(2);
    for (const k of ['waist', 'chest', 'hips', 'thigh', 'arm'] as const) expect(Math.abs(p[k] - t[k])).toBeLessThan(6);
  });

  it('gotowa siatka (pomiar pierścieniami) ma obwody użytkownika — także przy dużym pasie', () => {
    for (const t of [{ height: 186, waist: 105, chest: 115.5, hips: 104, thigh: 63, arm: 38.5 }, { height: 186, waist: 98, chest: 115, hips: 104, thigh: 63, arm: 38.5 }]) {
      const out = applyBody(male, fitBody(male.header, t), new Float32Array(male.positions.length));
      const r = measureRings(male.header, out);
      for (const k of ['waist', 'chest', 'hips', 'thigh'] as const) expect(Math.abs((r[k] as number) - t[k])).toBeLessThan(1.5);
    }
  });

  it('dopasowanie nie używa „brzucha” (wypycha brzuch do przodu) — pas rośnie dookoła', () => {
    expect(fitBody(male.header, { height: 186, waist: 112, chest: 112 }).stomach ?? 0).toBe(0);
  });

  it('mniejszy pas → mniejszy obwód talii modelu (kierunek zmian się zgadza)', () => {
    const a = predictBody(male.header, fitBody(male.header, { height: 180, waist: 108, chest: 112 }));
    const b = predictBody(male.header, fitBody(male.header, { height: 180, waist: 100, chest: 112 }));
    expect(b.waist).toBeLessThan(a.waist - 4);
  });

  it('kształty zmieniają wierzchołki', () => {
    const out = new Float32Array(male.positions.length);
    applyBody(male, { waist: 1 }, out);
    expect(out.some((v, i) => Math.abs(v - male.positions[i]) > 0.01)).toBe(true);
    applyBody(male, {}, out);
    expect(out).toEqual(male.positions);
  });
});

describe('sylwetka 3D: oś czasu pomiarów', () => {
  it('brakujące obwody biorą ostatnią znaną wartość, puste wpisy znikają', () => {
    const tl = bodyTimeline([{ d: '2026-11-03', waist: 101 }, { d: '2026-10-07', waist: 110, chest: 112 }, { d: '2026-10-10' }], 180);
    expect(tl.map(x => x.d)).toEqual(['2026-10-07', '2026-11-03']);
    expect(tl[1].m).toEqual({ height: 180, waist: 101, chest: 112 });
  });
});

describe('sylwetka 3D: szacunek ze startu planu (z wagi)', () => {
  const tl = bodyTimeline([{ d: '2026-10-28', waist: 105, chest: 115, hips: 104, thigh: 63, arm: 38.5 }], 186);
  const ws = [{ d: '2026-08-21', w: 104.4 }, { d: '2026-10-15', w: 99.8 }, { d: '2026-10-27', w: 100 }];

  it('4,4 kg więcej na starcie → większe obwody (mężczyzna: pas ~1 cm/kg)', () => {
    const s = bodyWeightStart(tl, ws, 'male')!;   // pierwsze ważenie w ogóle (także sprzed startu planu)
    expect(s).toMatchObject({ d: '2026-08-21', est: true, kg: 4.4 });
    expect(s.m.waist).toBe(109.4);
    expect(s.m.hips).toBeCloseTo(106.6, 1);
    expect(s.m.height).toBe(186);
  });

  it('bez wcześniejszego ważenia, przy małej różnicy albo zbyt blisko — brak szacunku', () => {
    expect(bodyWeightStart(tl, [{ d: '2026-10-27', w: 100 }], 'male')).toBeNull();
    expect(bodyWeightStart(tl, [{ d: '2026-08-21', w: 100.5 }, { d: '2026-10-27', w: 100 }], 'male')).toBeNull();
    expect(bodyWeightStart(tl, [{ d: '2026-10-25', w: 104 }, { d: '2026-10-27', w: 100 }], 'male')).toBeNull();
  });

  it('waga z dnia: ostatni wpis do tego dnia', () => {
    expect(weightOn(ws, '2026-10-20')).toBe(99.8);
    expect(weightOn(ws, '2026-01-01')).toBe(104.4);
  });
});
