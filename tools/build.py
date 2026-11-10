#!/usr/bin/env python3
"""ŻELAZO — budowanie wersji z jednego źródła (app/, pakowane przez Vite).

Wszystkie wersje to ta sama aplikacja. Różnią się tylko adresem, znaczkiem przy logo,
nazwą ikony na telefonie i własną kopią offline (sw.js). O funkcjach i limitach
decyduje serwer według planu konta i wersji (cfg.enforce w Apps Script).

Wersje:
  beta    /beta/   Ty i testerzy — najnowsze funkcje
  users   /users/  konta, plany, panel admina, limity, płatności (wersja robocza)
  early   /early/  Early Access — dla Premium, po testach w becie
  stable  /        wszyscy — sprawdzone funkcje
  native  native/www/  aplikacja na telefon (Capacitor): jak stabilna, z ikonami i modelem sylwetki w paczce
                       (działa bez internetu); nie trafia do repo ani na GitHub Pages — budowana przed `npx cap sync`

Użycie:
  python3 tools/build.py beta users                 # nowa funkcja: beta + USERS z bieżącego app/
  python3 tools/build.py stable early --from <ref>  # po testach: stabilna + Early Access z przetestowanego commita
  python3 tools/build.py --check                    # czy pliki wersji zgadzają się ze źródłem (bez zapisu)
  python3 tools/build.py native [--from <ref>]      # aplikacja na telefon → native/www (potem: npx cap sync android)

Najpierw Vite buduje dist/ (index.html + assets/ z hashami w nazwach), potem każda wersja dostaje
kopię z wypełnionymi miejscami: ikony, manifest, nazwa na ekranie głównym, znaczek.
--from buduje z app/ podanego commita/tagu (git archive do katalogu tymczasowego), żeby do stabilnej
nie trafiło nic, co doszło do źródła po testach.
"""
import json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLOT = 'https://zelazo.invalid/'   # to samo co SLOT w vite.config.js

CHANNELS = {
    'stable': {'dir': '.',     'icons': 'icons/',    'apple': 'ŻELAZO',    'tag': '',
               'name': 'ŻELAZO — plan, trening, dieta', 'short': 'ŻELAZO',
               'desc': '6-miesięczny plan treningowy i dieta z Trenerem AI.'},
    'beta':   {'dir': 'beta',  'icons': '../icons/sixmo/', 'apple': 'SixMo β',  'tag': 'BETA',
               'name': 'SixMo β — plan, trening, dieta', 'short': 'SixMo β',
               'desc': '6-miesięczny plan treningowy i dieta z Trenerem AI — wersja beta.'},
    'early':  {'dir': 'early', 'icons': '../icons/', 'apple': 'ŻELAZO EA', 'tag': 'EARLY',
               'name': 'ŻELAZO Early Access — plan, trening, dieta', 'short': 'ŻELAZO EA',
               'desc': '6-miesięczny plan treningowy i dieta z Trenerem AI — nowości wcześniej dla Premium.'},
    'users':  {'dir': 'users', 'icons': '../icons/sixmo/', 'apple': 'SixMo U',  'tag': 'USERS',
               'name': 'SixMo USERS — konta i plany', 'short': 'SixMo U',
               'desc': 'SixMo — wersja robocza kont, planów i limitów.'},
    # aplikacja na telefon: ścieżki jak w stabilnej (icons/, models/ obok index.html), kopie katalogów w paczce
    'native': {'dir': 'native/www', 'icons': 'icons/sixmo/', 'apple': 'SixMo', 'tag': '',
               'name': 'SixMo — plan, trening, dieta', 'short': 'SixMo',
               'desc': '6-miesięczny plan treningowy i dieta z Trenerem AI.', 'copy': ['icons', 'models']},
}
# Nowa marka SixMo (ikony icons/sixmo/) jest w becie, USERS i native. Stabilna i Early Access zostają przy ŻELAZO,
# dopóki nie zostaną wydane z commita z nową marką — wtedy przestawić je tak samo (nazwa i ikony).
SOURCES = ['app', 'vite.config.js', 'package.json', 'package-lock.json']


def vite_build(ref):
    """Zwraca katalog dist/ zbudowany z bieżącego app/ albo z app/ podanego commita."""
    if not ref:
        subprocess.run(['npx', 'vite', 'build', '--logLevel', 'warn'], cwd=ROOT, check=True)
        return os.path.join(ROOT, 'dist')
    tmp = tempfile.mkdtemp(prefix='zelazo-build-')
    arc = subprocess.run(['git', 'archive', ref, '--'] + SOURCES, cwd=ROOT, check=True, capture_output=True).stdout
    subprocess.run(['tar', '-x', '-C', tmp], input=arc, check=True)
    os.symlink(os.path.join(ROOT, 'node_modules'), os.path.join(tmp, 'node_modules'))
    subprocess.run(['npx', 'vite', 'build', '--logLevel', 'warn'], cwd=tmp, check=True)
    return os.path.join(tmp, 'dist')


def render(ch, dist):
    c = CHANNELS[ch]
    page = open(os.path.join(dist, 'index.html'), encoding='utf-8').read()
    page = (page.replace(SLOT + 'icons/', c['icons']).replace(SLOT + 'manifest.webmanifest', 'manifest.webmanifest')
                .replace('%%APPLE_TITLE%%', c['apple']).replace('%%TAG%%', c['tag']))
    assert '%%' not in page and SLOT not in page, f'{ch}: zostało miejsce do wypełnienia'
    icons = c['icons']
    manifest = {
        'name': c['name'], 'short_name': c['short'], 'description': c['desc'], 'lang': 'pl',
        'id': './', 'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'portrait',
        'background_color': '#0e1114', 'theme_color': '#0e1114',
        'icons': [
            {'src': icons + 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
            {'src': icons + 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
            {'src': icons + 'icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ],
    }
    files = {'index.html': page, 'manifest.webmanifest': json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
             'sw.js': open(os.path.join(os.path.dirname(dist), 'app', 'sw.js'), encoding='utf-8').read()}
    assets = {n: open(os.path.join(dist, 'assets', n), 'rb').read() for n in sorted(os.listdir(os.path.join(dist, 'assets')))}
    return files, assets


def main(argv):
    ref, check, chans = None, False, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--from':
            ref = argv[i + 1]; i += 2; continue
        if a == '--check':
            check = True
        elif a in CHANNELS:
            chans.append(a)
        else:
            sys.exit(f'Nieznana wersja: {a}. Dostępne: {", ".join(CHANNELS)}')
        i += 1
    if check and not chans:
        chans = [c for c in CHANNELS if c != 'native']   # native/www nie jest w repo
    if not chans:
        sys.exit(__doc__)
    dist = vite_build(ref)
    stale = []
    for ch in chans:
        d = os.path.join(ROOT, CHANNELS[ch]['dir'])
        files, assets = render(ch, dist)
        ad = os.path.join(d, 'assets')
        if check:
            for name, text in files.items():
                p = os.path.join(d, name)
                if not os.path.exists(p) or open(p, encoding='utf-8').read() != text: stale.append(os.path.relpath(p, ROOT))
            have = sorted(os.listdir(ad)) if os.path.isdir(ad) else []
            if have != list(assets) or any(open(os.path.join(ad, n), 'rb').read() != b for n, b in assets.items()):
                stale.append(os.path.relpath(ad, ROOT) + '/')
            continue
        os.makedirs(d, exist_ok=True)
        for name, text in files.items():
            p = os.path.join(d, name)
            if not os.path.exists(p) or open(p, encoding='utf-8').read() != text:
                open(p, 'w', encoding='utf-8').write(text); print('zapisano', os.path.relpath(p, ROOT))
        # assets/: dokładnie bieżący pakiet (stare pliki z hashami usuwane)
        if os.path.isdir(ad): shutil.rmtree(ad)
        os.makedirs(ad)
        for n, b in assets.items():
            open(os.path.join(ad, n), 'wb').write(b)
        print('zapisano', os.path.relpath(ad, ROOT) + '/', '(' + ', '.join(assets) + ')')
        for sub in CHANNELS[ch].get('copy', []):   # native: ikony i modele w paczce aplikacji
            dst = os.path.join(d, sub)
            if os.path.isdir(dst): shutil.rmtree(dst)
            shutil.copytree(os.path.join(ROOT, sub), dst)
            print('skopiowano', os.path.relpath(dst, ROOT) + '/')
    if check:
        print('różni się od źródła: ' + ', '.join(stale) if stale else 'wszystkie wersje zgodne ze źródłem')
        return 1 if stale else 0
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
