// Sylwetka 3D: model MakeHuman (CC0, tools/body_model.py → models/body-*.zbm) dopasowany do pomiarów.
// Każdy kształt ma stronę + i − (np. waist+ / waist−). Plik modelu zawiera dla każdego kształtu, o ile cm
// zmienia wzrost i obwody (jac); dopasowanie dobiera kształty tak, żeby obwody modelu były jak najbliżej pomiarów.

export const BODY_MEASURES = ['height', 'waist', 'chest', 'hips', 'thigh', 'arm'] as const;
export type BodyMeasure = typeof BODY_MEASURES[number];
export type Measures = Partial<Record<BodyMeasure, number>>;

export interface BodyHeader {
  v: number; sex: 'male' | 'female'; nv: number; nt: number; unit_cm: number; source: string;
  groups: { skin: [number, number]; cloth: [number, number] };   // trójkąty: [od, ile] — skóra i spodenki
  morphs: { n: string; s: number }[];
  base: Record<BodyMeasure, number>;
  jac: Record<string, Record<BodyMeasure, number>>;
}
export interface BodyModel { header: BodyHeader; positions: Float32Array; indices: Uint16Array; morphs: Map<string, { d: Int16Array; s: number }>; top: Uint8Array }

/** Odczyt pliku modelu (już rozpakowanego z gzip). */
export function parseBody(buf: ArrayBuffer): BodyModel {
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'ZBM1') throw new Error('Zły plik modelu sylwetki');
  const hl = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl))) as BodyHeader;
  let o = 8 + hl;
  const positions = new Float32Array(buf.slice(o, o + header.nv * 12)); o += header.nv * 12;
  const indices = new Uint16Array(buf.slice(o, o + header.nt * 6)); o += header.nt * 6 + ((header.nt * 3) % 2 ? 2 : 0);
  const morphs = new Map<string, { d: Int16Array; s: number }>();
  for (const m of header.morphs) { morphs.set(m.n, { d: new Int16Array(buf.slice(o, o + header.nv * 6)), s: m.s }); o += header.nv * 6; }
  const top = new Uint8Array(buf.slice(o, o + header.nv));   // 1 = wierzchołek sportowego topu (sylwetka kobieca)
  return { header, positions, indices, morphs, top };
}

// granice i „opór” kształtów: makro (waga, mięśnie) zmieniają dużo naraz, więc są tańsze niż korekty pojedynczych obwodów;
// mięśnie droższe, bo obwody ich nie rozstrzygają. Waga pomiaru: wzrost ważniejszy (podany dokładnie w profilu).
const LAMBDA: Record<string, number> = { weight: 4, muscle: 40, height: 0.5, waist: 6, chest: 6, hips: 6, arm: 6, thigh: 6, stomach: 10 };
const W: Record<BodyMeasure, number> = { height: 4, waist: 1, chest: 1, hips: 1, thigh: 1, arm: 1 };

/** Wartości kształtów (−1…1; ujemna = strona −) najlepiej pasujące do pomiarów. Brakujące pomiary nie wpływają. */
export function fitBody(h: BodyHeader, target: Measures): Record<string, number> {
  const names = [...new Set(h.morphs.map(m => m.n.slice(0, -1)))];
  const keys = BODY_MEASURES.filter(k => typeof target[k] === 'number' && (target[k] as number) > 0);
  const x: Record<string, number> = Object.fromEntries(names.map(n => [n, 0]));
  const jac = (n: string, v: number) => h.jac[n + (v >= 0 ? '+' : '-')];
  const pred = (skip?: string) => Object.fromEntries(keys.map(k =>
    [k, h.base[k] + names.reduce((a, n) => a + (n === skip || !x[n] ? 0 : jac(n, x[n])[k] * Math.abs(x[n])), 0)])) as Record<BodyMeasure, number>;
  if (!keys.length) return x;
  for (let it = 0; it < 60; it++) {
    for (const n of names) {
      const p = pred(n), lam = LAMBDA[n] ?? 6;
      // osobno strona + i −: x = −Σ w·r·g / (Σ w·g² + λ), ograniczone do 0…1; wybór niższego błędu
      let best = 0, bestErr = Infinity;
      for (const side of [1, -1]) {
        const g = h.jac[n + (side > 0 ? '+' : '-')];
        let num = 0, den = lam;
        for (const k of keys) { const r = p[k] - (target[k] as number); num -= W[k] * r * g[k]; den += W[k] * g[k] * g[k]; }
        const a = Math.max(0, Math.min(1, num / den));
        let err = lam * a * a;
        for (const k of keys) { const r = p[k] - (target[k] as number) + g[k] * a; err += W[k] * r * r; }
        if (err < bestErr) { bestErr = err; best = side * a; }
      }
      x[n] = best;
    }
  }
  return x;
}

/** Obwody modelu (cm) przy danych wartościach kształtów — do sprawdzenia dopasowania. */
export function predictBody(h: BodyHeader, x: Record<string, number>): Record<BodyMeasure, number> {
  return Object.fromEntries(BODY_MEASURES.map(k => [k, h.base[k] + Object.entries(x).reduce((a, [n, v]) =>
    a + (v ? h.jac[n + (v >= 0 ? '+' : '-')][k] * Math.abs(v) : 0), 0)])) as Record<BodyMeasure, number>;
}

/** Pozycje wierzchołków z nałożonymi kształtami (do out, długość nv×3). */
export function applyBody(m: BodyModel, x: Record<string, number>, out: Float32Array): Float32Array {
  out.set(m.positions);
  for (const [n, v] of Object.entries(x)) {
    if (!v) continue;
    const t = m.morphs.get(n + (v >= 0 ? '+' : '-')); if (!t) continue;
    const k = Math.abs(v) * t.s, d = t.d;
    for (let i = 0; i < d.length; i++) out[i] += d[i] * k;
  }
  return out;
}

/** Pomiary z historii obwodów do osi czasu: brakująca wartość = ostatnia znana (wzrost z profilu). */
export function bodyTimeline(ms: { d: string; [k: string]: unknown }[], height?: number): { d: string; m: Measures }[] {
  const keys: BodyMeasure[] = ['waist', 'chest', 'hips', 'thigh', 'arm'];
  const out: { d: string; m: Measures }[] = [];
  let last: Measures = height ? { height } : {};
  for (const e of ms.slice().sort((a, b) => (a.d < b.d ? -1 : 1))) {
    const cur: Measures = { ...last };
    let any = false;
    for (const k of keys) { const v = Number(e[k]); if (v > 0) { cur[k] = v; any = true; } }
    if (any) { out.push({ d: e.d, m: cur }); last = cur; }
  }
  return out;
}
