#!/usr/bin/env python3
"""ŻELAZO — model sylwetki 3D z danych MakeHuman (CC0) do aplikacji (Postęp → Sylwetka 3D).

Źródło danych: MakeHuman / MPFB2, licencja CC0 1.0 (bez warunków, także do użytku komercyjnego),
w kopii z repozytorium naver/anny (commit 8f35dc2), katalog src/anny/data/mpfb2/:
  3dobjs/base.obj, mesh_metadata/basemesh_vertex_groups.json oraz kształty (targets) — lista w TARGETS niżej.

Użycie:
  python3 tools/body_model.py <katalog z danymi mpfb2>      # zapisuje models/body-male.bin.gz i models/body-female.bin.gz

Co robi:
  1. Bierze ciało, oczy i spodenki (helper-tights przycięte od pasa do połowy uda; bez włosów, zębów, spódnicy) i składa sylwetkę kobiecą i męską
     (średnia z kształtów płci MakeHuman, jak przy płci 100% w samym MakeHuman). Kobieca: wygładzone sutki
     i znacznik wierzchołków sportowego topu — model w aplikacji jest „ubrany” (zasady sklepów, aplikacja fitness).
  2. Dokłada kształty, które aplikacja może mieszać: waga, mięśnie, wzrost, obwody talii, klatki, bioder,
     ramienia i uda, brzuch — każdy w dwie strony (+ i −).
  3. Mierzy na siatce (jak taśmą: obwód przekroju po wypukłej otoczce) wzrost i obwody dla sylwetki bazowej
     i dla każdego kształtu. Aplikacja z tych liczb dobiera kształty do pomiarów użytkownika (app/lib/body.ts).

Format pliku (gzip; GitHub Pages nie kompresuje .bin, aplikacja rozpakowuje DecompressionStream) — wewnątrz little-endian: 'ZBM1', uint32 długość nagłówka JSON, JSON (dopełniony spacjami do 4 bajtów),
potem: Float32 pozycje (nv×3), Uint16 trójkąty (nt×3, dopełnione do 4 bajtów; najpierw skóra, potem legginsy —
header.groups), Int16 przesunięcia każdego kształtu (nv×3; wartość × scale = przesunięcie w jednostkach siatki),
Uint8 znacznik topu dla każdego wierzchołka (nv, dopełnione do 4 bajtów). Jednostka siatki = 10 cm.
"""
import gzip, json, math, os, struct, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIT_CM = 10.0   # MakeHuman liczy w decymetrach

# kształty: nazwa w aplikacji → plik (+, −); {s} = male/female
TARGETS = {
    'weight':  ('macrodetails/universal-{s}-young-averagemuscle-maxweight', 'macrodetails/universal-{s}-young-averagemuscle-minweight'),
    'muscle':  ('macrodetails/universal-{s}-young-maxmuscle-averageweight', 'macrodetails/universal-{s}-young-minmuscle-averageweight'),
    'height':  ('macrodetails/height/{s}-young-averagemuscle-averageweight-maxheight', 'macrodetails/height/{s}-young-averagemuscle-averageweight-minheight'),
    'waist':   ('torso/measure-waist-circ-incr', 'torso/measure-waist-circ-decr'),
    'chest':   ('torso/measure-bust-circ-incr', 'torso/measure-bust-circ-decr'),
    'hips':    ('torso/measure-hips-circ-incr', 'torso/measure-hips-circ-decr'),
    'arm':     ('arms/measure-upperarm-circ-incr', 'arms/measure-upperarm-circ-decr'),
    'thigh':   ('legs/measure-thigh-circ-incr', 'legs/measure-thigh-circ-decr'),
    'stomach': ('stomach/stomach-pregnant-incr', 'stomach/stomach-pregnant-decr'),
}
RACES = ('african', 'asian', 'caucasian')
KEEP_GROUPS = ('body', 'helper-l-eye', 'helper-r-eye', 'helper-tights')
CLOTH_GROUPS = ('helper-tights',)
MEASURES = ('height', 'waist', 'chest', 'hips', 'thigh', 'arm')


def load_obj(path):
    verts, faces = [], []
    group = None
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('v '):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('g '):
                group = line.split(None, 1)[1].strip()
            elif line.startswith('f ') and group in KEEP_GROUPS:
                faces.append(([int(t.split('/')[0]) - 1 for t in line.split()[1:]], group in CLOTH_GROUPS))
    return verts, faces


def load_target(data, rel, n):
    d = [0.0] * (n * 3)
    with gzip.open(os.path.join(data, 'targets', rel + '.target.gz'), 'rt', encoding='utf-8') as f:
        for line in f:
            p = line.split()
            if len(p) != 4 or line.startswith('#'):
                continue
            i = int(p[0])
            d[i * 3], d[i * 3 + 1], d[i * 3 + 2] = float(p[1]), float(p[2]), float(p[3])
    return d


def add(base, delta, k=1.0):
    return [b + k * x for b, x in zip(base, delta)]


# ---------- pomiary na siatce ----------

def tris_of(faces):
    t = []
    for f in faces:
        for i in range(1, len(f) - 1):
            t.append((f[0], f[i], f[i + 1]))
    return t


def joint(pos, vg, name):
    a, b = vg[name][0]
    n = b - a + 1
    return [sum(pos[i * 3 + k] for i in range(a, b + 1)) / n for k in range(3)]


def hull_perimeter(pts):
    """Obwód wypukłej otoczki punktów 2D (tak mierzy taśma)."""
    pts = sorted(set(pts))
    if len(pts) < 3:
        return 0.0
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    h = lo[:-1] + hi[:-1]
    return sum(math.dist(h[i], h[(i + 1) % len(h)]) for i in range(len(h)))


def slice_loops(pos, tris, point, normal, near=None):
    """Przekrój płaszczyzną: lista pętli (punkty 3D), każda = spójny kawałek przekroju."""
    nx, ny, nz = normal
    px, py, pz = point
    parent = {}
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    pt = {}
    for t in tris:
        if near is not None:
            c = [(pos[t[0] * 3 + k] + pos[t[1] * 3 + k] + pos[t[2] * 3 + k]) / 3 for k in range(3)]
            if math.dist(c, point) > near: continue
        d = [(pos[i * 3] - px) * nx + (pos[i * 3 + 1] - py) * ny + (pos[i * 3 + 2] - pz) * nz for i in t]
        cut = []
        for a, b in ((0, 1), (1, 2), (2, 0)):
            if (d[a] < 0) != (d[b] < 0):
                ia, ib = t[a], t[b]
                key = (min(ia, ib), max(ia, ib))
                if key not in pt:
                    s = d[a] / (d[a] - d[b]) if (ia, ib) == key else d[b] / (d[b] - d[a])
                    i0, i1 = key
                    pt[key] = [pos[i0 * 3 + k] + s * (pos[i1 * 3 + k] - pos[i0 * 3 + k]) for k in range(3)]
                    parent[key] = key
                cut.append(key)
        if len(cut) == 2:
            ra, rb = find(cut[0]), find(cut[1])
            if ra != rb: parent[ra] = rb
    loops = {}
    for k in pt:
        loops.setdefault(find(k), []).append(pt[k])
    return list(loops.values())


def plane_basis(n):
    a = (1, 0, 0) if abs(n[0]) < 0.9 else (0, 1, 0)
    u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]
    l = math.sqrt(sum(x * x for x in u)); u = [x / l for x in u]
    v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]
    return u, v


def perim(loop, n):
    u, v = plane_basis(n)
    return hull_perimeter([(round(sum(p[k] * u[k] for k in range(3)), 5), round(sum(p[k] * v[k] for k in range(3)), 5)) for p in loop])


def torso_perims(pos, tris, y0, y1, steps, xmax):
    """Obwody tułowia (pętla przez x=0, bez rąk) na kolejnych wysokościach."""
    out = []
    for i in range(steps + 1):
        y = y0 + (y1 - y0) * i / steps
        for lp in slice_loops(pos, tris, (0, y, 0), (0, 1, 0)):
            xs = [p[0] for p in lp]
            if min(xs) < 0 < max(xs) and max(abs(x) for x in xs) <= xmax:
                out.append((perim(lp, (0, 1, 0)), y))
    return out


def measure(pos, tris, vg):
    """Wzrost i obwody (cm) sylwetki o pozycjach pos."""
    ys = [pos[i * 3 + 1] for i in range(13380)]
    j = {k: joint(pos, vg, 'joint-' + k) for k in ('pelvis', 'spine-1', 'spine-2', 'spine-4', 'l-shoulder', 'l-elbow', 'l-upper-leg', 'l-knee')}
    xmax = j['l-shoulder'][0] * 1.25   # szerzej = pętla złapała rękę
    s1, s2, s4 = j['spine-1'][1], j['spine-2'][1], j['spine-4'][1]
    m = {'height': (max(ys) - min(ys)) * UNIT_CM}
    chest = torso_perims(pos, tris, s2 + 0.3 * (s1 - s2), s1 + 0.1 * (j['l-shoulder'][1] - s1), 10, xmax)
    m['chest'] = max(chest)[0] * UNIT_CM
    waist = torso_perims(pos, tris, s4, s2 + 0.5 * (s1 - s2), 12, xmax)
    m['waist'] = min(waist)[0] * UNIT_CM
    m['_waist_y'] = min(waist)[1]
    leg = j['l-upper-leg'][1]
    hips = torso_perims(pos, tris, leg - 1.2, s4, 12, xmax)
    m['hips'] = max(hips)[0] * UNIT_CM
    # udo: tuż pod kroczem, na pierwszej wysokości, na której noga jest osobną pętlą (u kobiet uda często się stykają)
    crotch = min(y for _, y in hips)   # najniższy przekrój, w którym tułów jest jeszcze jedną pętlą
    knee = j['l-knee'][1]
    m['thigh'] = 0.0
    for k in range(1, 30):
        ty = crotch - (crotch - knee) * (0.1 + 0.02 * k)
        legs = [lp for lp in slice_loops(pos, tris, (0, ty, 0), (0, 1, 0)) if min(p[0] for p in lp) > 0]
        if legs:
            m['thigh'] = max(perim(lp, (0, 1, 0)) for lp in legs) * UNIT_CM
            break
    m['_crotch'], m['_knee'], m['_xmax'] = crotch, knee, xmax
    m['_chest_y'] = max(chest)[1]
    a, b = j['l-shoulder'], j['l-elbow']
    mid = [(a[k] + b[k]) / 2 for k in range(3)]
    ax = [b[k] - a[k] for k in range(3)]; l = math.sqrt(sum(x * x for x in ax)); ax = [x / l for x in ax]
    arm = slice_loops(pos, tris, mid, ax, near=1.6)
    best = min(arm, key=lambda lp: math.dist([sum(p[k] for p in lp) / len(lp) for k in range(3)], mid))
    m['arm'] = perim(best, ax) * UNIT_CM
    return {k: round(v, 2) if not k.startswith('_') else v for k, v in m.items()}


def torso_halfwidth(pos, tris, y, xmax):
    for lp in slice_loops(pos, tris, (0, y, 0), (0, 1, 0)):
        xs = [p[0] for p in lp]
        if min(xs) < 0 < max(xs) and max(abs(x) for x in xs) <= xmax:
            return max(abs(x) for x in xs)
    return xmax / 1.25


def female_top(base, body_tris, vg, chest_y):
    """Wygładza sutki (przód klatki) i zwraca zbiór wierzchołków sportowego topu."""
    xmax = joint(base, vg, 'joint-l-shoulder')[0] * 1.25
    hw = torso_halfwidth(base, body_tris, chest_y, xmax)
    band = [i for i in range(13380) if abs(base[i * 3 + 1] - chest_y) < 0.45 and abs(base[i * 3]) < hw]
    zf = max(base[i * 3 + 2] for i in band)
    soft = {i for i in band if base[i * 3 + 2] > zf - 0.45}
    nb = {i: set() for i in soft}
    for t in body_tris:
        for a in t:
            if a in nb: nb[a].update(x for x in t if x != a)
    for _ in range(25):   # wygładzanie Laplace'a tylko przodu klatki
        new = {}
        for i in soft:
            ns = nb[i]
            new[i] = [base[i * 3 + k] + 0.6 * (sum(base[x * 3 + k] for x in ns) / len(ns) - base[i * 3 + k]) for k in range(3)]
        for i, v in new.items(): base[i * 3:i * 3 + 3] = v
    return {i for i in range(13380) if chest_y - 0.85 <= base[i * 3 + 1] <= chest_y + 0.5 and abs(base[i * 3]) <= hw * 1.02}


# ---------- zapis ----------

def write_bin(path, header, pos, tris, morphs, top):
    hj = json.dumps(header, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    hj += b' ' * ((4 - len(hj) % 4) % 4)
    with gzip.GzipFile(path, 'wb', compresslevel=9, mtime=0) as f:   # mtime=0: ten sam plik przy każdym budowaniu
        f.write(b'ZBM1'); f.write(struct.pack('<I', len(hj))); f.write(hj)
        f.write(struct.pack('<%df' % len(pos), *pos))
        flat = [i for t in tris for i in t]
        f.write(struct.pack('<%dH' % len(flat), *flat))
        if len(flat) % 2: f.write(b'\0\0')
        for d, scale in morphs:
            f.write(struct.pack('<%dh' % len(d), *[max(-32767, min(32767, round(x / scale))) for x in d]))
        f.write(bytes(top)); f.write(b'\0' * ((4 - len(top) % 4) % 4))


def main(data):
    verts, faces = load_obj(os.path.join(data, '3dobjs', 'base.obj'))
    n = len(verts)
    vg = json.load(open(os.path.join(data, 'mesh_metadata', 'basemesh_vertex_groups.json')))
    base0 = [c for v in verts for c in v]
    skin_tris = tris_of([f for f, cloth in faces if not cloth])
    tights_tris = tris_of([f for f, cloth in faces if cloth])
    body_tris = [t for t in skin_tris if max(t) < 13380]
    os.makedirs(os.path.join(ROOT, 'models'), exist_ok=True)
    for sex in ('male', 'female'):
        base = base0[:]
        for r in RACES:
            base = add(base, load_target(data, 'macrodetails/%s-%s-young' % (r, sex), n), 1 / len(RACES))
        m0 = measure(base, body_tris, vg)
        top = female_top(base, body_tris, vg, m0['_chest_y']) if sex == 'female' else set()
        m0 = measure(base, body_tris, vg)   # po wygładzeniu klatki
        # spodenki: z kombinezonu helper-tights tylko trójkąty od pasa do połowy uda, bez rąk
        y0 = m0['_crotch'] - 0.45 * (m0['_crotch'] - m0['_knee']); y1 = m0['_waist_y'] - 0.15
        cloth_tris = [t for t in tights_tris if all(y0 <= base[i * 3 + 1] <= y1 and abs(base[i * 3]) <= m0['_xmax'] for i in t)]
        tris_all = skin_tris + cloth_tris   # najpierw skóra, potem spodenki (dwie grupy materiałów w aplikacji)
        used = sorted({i for t in tris_all for i in t})   # tylko wierzchołki ciała, oczu i spodenek, w nowej kolejności
        remap = {old: new for new, old in enumerate(used)}
        out_tris = [tuple(remap[i] for i in t) for t in tris_all]
        groups = {'skin': [0, len(skin_tris)], 'cloth': [len(skin_tris), len(cloth_tris)]}
        morphs, meta, jac = [], [], {}
        for name, (plus, minus) in TARGETS.items():
            for sign, rel in (('+', plus), ('-', minus)):
                d = load_target(data, rel.format(s=sex), n)
                m1 = measure(add(base, d), body_tris, vg)
                jac[name + sign] = {k: round(m1[k] - m0[k], 2) for k in MEASURES}
                sub = [d[i * 3 + k] for i in used for k in range(3)]
                scale = max(1e-6, max(abs(x) for x in sub) / 32767)
                morphs.append((sub, scale)); meta.append({'n': name + sign, 's': scale})
        pos = [base[i * 3 + k] for i in used for k in range(3)]
        m0 = {k: v for k, v in m0.items() if not k.startswith('_')}
        header = {'v': 1, 'sex': sex, 'nv': len(used), 'nt': len(out_tris), 'unit_cm': UNIT_CM,
                  'source': 'MakeHuman / MPFB2 (CC0 1.0) via naver/anny 8f35dc2',
                  'groups': groups, 'morphs': meta, 'base': m0, 'jac': jac}
        path = os.path.join(ROOT, 'models', 'body-%s.bin.gz' % sex)
        write_bin(path, header, pos, out_tris, morphs, [1 if i in top else 0 for i in used])
        print('zapisano', os.path.relpath(path, ROOT), '%d KB' % (os.path.getsize(path) // 1024), '— baza:', m0)
        for k, v in jac.items():
            print('   %-9s' % k, ' '.join('%s %+6.1f' % (m, v[m]) for m in MEASURES))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
