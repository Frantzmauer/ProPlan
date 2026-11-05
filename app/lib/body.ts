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
  gain?: Partial<Record<BodyMeasure, number>>;   // kształty nie sumują się dokładnie: rzeczywista zmiana ≈ gain × suma
  rings?: Partial<Record<BodyMeasure, { v: number[]; r: number }>>;   // pierścienie pomiarowe: wierzchołki na linii pomiaru
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
const LAMBDA: Record<string, number> = { weight: 4, muscle: 40, height: 0.5, waist: 6, chest: 6, hips: 6, arm: 6, thigh: 6 };
const W: Record<BodyMeasure, number> = { height: 4, waist: 1, chest: 1, hips: 1, thigh: 1, arm: 1 };
// „brzuch” (stomach-pregnant) wypycha brzuch do przodu — nie dobieramy go z obwodów (większy pas = talia dookoła i waga)
const FIT_SKIP = new Set(['stomach']);
// talia może działać mocniej niż 1: duży obwód pasa bez „pożyczania” brzucha
const MAX_PLUS: Record<string, number> = { waist: 1.5 };

/** Wartości kształtów (−1…1; ujemna = strona −) najlepiej pasujące do pomiarów. Brakujące pomiary nie wpływają. */
export function fitBody(h: BodyHeader, target: Measures): Record<string, number> {
  const names = [...new Set(h.morphs.map(m => m.n.slice(0, -1)))].filter(n => !FIT_SKIP.has(n));
  const gain = (k: BodyMeasure) => h.gain?.[k] ?? 1;
  const keys = BODY_MEASURES.filter(k => typeof target[k] === 'number' && (target[k] as number) > 0);
  const x: Record<string, number> = Object.fromEntries(names.map(n => [n, 0]));
  const jac = (n: string, v: number) => h.jac[n + (v >= 0 ? '+' : '-')];
  const pred = (skip?: string) => Object.fromEntries(keys.map(k =>
    [k, h.base[k] + gain(k) * names.reduce((a, n) => a + (n === skip || !x[n] ? 0 : jac(n, x[n])[k] * Math.abs(x[n])), 0)])) as Record<BodyMeasure, number>;
  if (!keys.length) return x;
  for (let it = 0; it < 60; it++) {
    for (const n of names) {
      const p = pred(n), lam = LAMBDA[n] ?? 6;
      // osobno strona + i −: x = −Σ w·r·g / (Σ w·g² + λ), ograniczone do 0…1; wybór niższego błędu
      let best = 0, bestErr = Infinity;
      for (const side of [1, -1]) {
        const j = h.jac[n + (side > 0 ? '+' : '-')], g = (k: BodyMeasure) => gain(k) * j[k];
        let num = 0, den = lam;
        for (const k of keys) { const r = p[k] - (target[k] as number); num -= W[k] * r * g(k); den += W[k] * g(k) * g(k); }
        const a = Math.max(0, Math.min(side > 0 ? MAX_PLUS[n] ?? 1 : 1, num / den));
        let err = lam * a * a;
        for (const k of keys) { const r = p[k] - (target[k] as number) + g(k) * a; err += W[k] * r * r; }
        if (err < bestErr) { bestErr = err; best = side * a; }
      }
      x[n] = best;
    }
  }
  return x;
}

/** Obwody modelu (cm) przy danych wartościach kształtów — do sprawdzenia dopasowania. */
export function predictBody(h: BodyHeader, x: Record<string, number>): Record<BodyMeasure, number> {
  return Object.fromEntries(BODY_MEASURES.map(k => [k, h.base[k] + (h.gain?.[k] ?? 1) * Object.entries(x).reduce((a, [n, v]) =>
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

// ok. cm obwodu na kg zmiany masy (redukcja: głównie tłuszcz); u kobiet więcej z bioder i ud
export const CM_PER_KG: Record<'male' | 'female', Partial<Record<BodyMeasure, number>>> = {
  male: { waist: 1.0, hips: 0.6, chest: 0.6, thigh: 0.4, arm: 0.2 },
  female: { waist: 0.8, hips: 0.9, chest: 0.6, thigh: 0.6, arm: 0.25 },
};

/** Waga z dnia d: ostatni wpis tego dnia albo wcześniejszy (bez wpisu wcześniej — pierwszy po). */
export function weightOn(ws: { d: string; w: number }[], d: string): number | null {
  const s = ws.filter(x => x.w > 0).slice().sort((a, b) => (a.d < b.d ? -1 : 1));
  if (!s.length) return null;
  const before = s.filter(x => x.d <= d);
  return (before.length ? before[before.length - 1] : s[0]).w;
}

/**
 * Szacowana sylwetka sprzed pierwszego pomiaru obwodów: z różnicy wagi między pierwszym ważeniem (od dnia since)
 * a dniem pierwszego pomiaru. Tylko gdy ważenie jest co najmniej 7 dni wcześniej i waga różni się o ≥ 1 kg.
 */
export function bodyWeightStart(tl: { d: string; m: Measures }[], ws: { d: string; w: number }[], sex: 'male' | 'female', since = ''):
  { d: string; m: Measures; est: true; kg: number } | null {
  if (!tl.length) return null;
  const first = tl[0], early = ws.filter(x => x.w > 0 && x.d >= since && x.d < first.d).sort((a, b) => (a.d < b.d ? -1 : 1))[0];
  if (!early) return null;
  const wNow = weightOn(ws, first.d);
  if (wNow == null || (Date.parse(first.d) - Date.parse(early.d)) / 864e5 < 7) return null;
  const dkg = early.w - wNow;
  if (Math.abs(dkg) < 1) return null;
  const m: Measures = { ...first.m }, f = CM_PER_KG[sex];
  for (const k of Object.keys(f) as BodyMeasure[]) if (m[k]) m[k] = Math.round(((m[k] as number) + (f[k] as number) * dkg) * 10) / 10;
  return { d: early.d, m, est: true, kg: Math.round(dkg * 10) / 10 };
}

/** Obwody (cm) zmierzone na gotowej siatce pierścieniami (otoczka w rzucie z góry) — jak taśma w stałym miejscu. */
export function measureRings(h: BodyHeader, pos: Float32Array): Measures {
  const out: Measures = {};
  for (const [k, ring] of Object.entries(h.rings || {}) as [BodyMeasure, { v: number[]; r: number }][]) {
    const pts = ring.v.map(i => [pos[i * 3], pos[i * 3 + 2]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo: number[][] = [], hi: number[][] = [];
    for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.slice().reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
    let per = 0;
    for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; per += Math.hypot(a[0] - b[0], a[1] - b[1]); }
    out[k] = per * ring.r * h.unit_cm;
  }
  return out;
}
