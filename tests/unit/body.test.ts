import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { applyBody, bodyTimeline, fitBody, parseBody, predictBody } from '../../app/lib/body';

// prawdziwe pliki modelu z repozytorium (tools/body_model.py)
const load = (sex: string) => { const b = gunzipSync(readFileSync(`models/body-${sex}.bin.gz`)); return parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
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
