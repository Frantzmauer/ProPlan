#!/usr/bin/env python3
"""ŻELAZO — budowanie wersji z jednego źródła (src/).

Wszystkie wersje to ta sama aplikacja. Różnią się tylko adresem, znaczkiem przy logo,
nazwą ikony na telefonie i własną kopią offline (sw.js). O funkcjach i limitach
decyduje serwer według planu konta i wersji (cfg.enforce w Apps Script).

Wersje:
  beta    /beta/   Ty i testerzy — najnowsze funkcje
  users   /users/  konta, plany, panel admina, limity, płatności (wersja robocza)
  early   /early/  Early Access — dla Premium, po testach w becie
  stable  /        wszyscy — sprawdzone funkcje

Użycie:
  python3 tools/build.py beta users                 # nowa funkcja: beta + USERS z bieżącego src/
  python3 tools/build.py stable early --from <ref>  # po testach: stabilna + Early Access z przetestowanego commita
  python3 tools/build.py --check                    # czy pliki wersji zgadzają się ze źródłem (bez zapisu)

--from bierze src/ z podanego commita/tagu (git show), żeby do stabilnej nie trafiło nic,
co doszło do źródła po testach.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CHANNELS = {
    'stable': {'dir': '.',     'icons': 'icons/',    'apple': 'ŻELAZO',    'tag': '',
               'name': 'ŻELAZO — plan, trening, dieta', 'short': 'ŻELAZO',
               'desc': '6-miesięczny plan treningowy i dieta z Trenerem AI.'},
    'beta':   {'dir': 'beta',  'icons': '../icons/', 'apple': 'ŻELAZO β',  'tag': 'BETA',
               'name': 'ŻELAZO β — plan, trening, dieta', 'short': 'ŻELAZO β',
               'desc': '6-miesięczny plan treningowy i dieta z Trenerem AI — wersja beta.'},
    'early':  {'dir': 'early', 'icons': '../icons/', 'apple': 'ŻELAZO EA', 'tag': 'EARLY',
               'name': 'ŻELAZO Early Access — plan, trening, dieta', 'short': 'ŻELAZO EA',
               'desc': '6-miesięczny plan treningowy i dieta z Trenerem AI — nowości wcześniej dla Premium.'},
    'users':  {'dir': 'users', 'icons': '../icons/', 'apple': 'ŻELAZO U',  'tag': 'USERS',
               'name': 'ŻELAZO USERS — konta i plany', 'short': 'ŻELAZO U',
               'desc': 'ŻELAZO — wersja robocza kont, planów i limitów.'},
}


def source(path, ref):
    if not ref:
        return open(os.path.join(ROOT, path), encoding='utf-8').read()
    return subprocess.run(['git', 'show', f'{ref}:{path}'], cwd=ROOT, check=True,
                          capture_output=True).stdout.decode('utf-8')


def render(ch, html, sw):
    c = CHANNELS[ch]
    page = html.replace('%%ICONS%%', c['icons']).replace('%%APPLE_TITLE%%', c['apple']).replace('%%TAG%%', c['tag'])
    assert '%%' not in page, f'{ch}: zostało miejsce do wypełnienia'
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
    return {'index.html': page, 'sw.js': sw, 'manifest.webmanifest': json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'}


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
        chans = list(CHANNELS)
    if not chans:
        sys.exit(__doc__)
    html, sw = source('src/index.html', ref), source('src/sw.js', ref)
    stale = []
    for ch in chans:
        d = os.path.join(ROOT, CHANNELS[ch]['dir'])
        for name, text in render(ch, html, sw).items():
            p = os.path.join(d, name)
            cur = open(p, encoding='utf-8').read() if os.path.exists(p) else None
            if check:
                if cur != text: stale.append(os.path.relpath(p, ROOT))
                continue
            os.makedirs(d, exist_ok=True)
            if cur != text:
                open(p, 'w', encoding='utf-8').write(text)
                print('zapisano', os.path.relpath(p, ROOT))
    if check:
        print('różni się od źródła: ' + ', '.join(stale) if stale else 'wszystkie wersje zgodne ze źródłem')
        return 1 if stale else 0
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
