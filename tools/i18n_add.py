#!/usr/bin/env python3
"""Dopisuje tłumaczenia do app/i18n/en.ts: plik JSON z listą par [pl, en] albo obiektem {pl: en}.
Pomija klucze, które już są w słowniku (zostawia istniejące tłumaczenie). Użycie: tools/i18n_add.py pary.json "Sekcja"."""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'app', 'i18n', 'en.ts')

def main(src, section):
    data = json.load(open(src, encoding='utf-8'))
    pairs = list(data.items()) if isinstance(data, dict) else [tuple(x) for x in data]
    s = open(P, encoding='utf-8').read()
    have = set(json.loads('"' + m + '"') for m in re.findall(r'^  "((?:[^"\\]|\\.)*)":', s, re.M))
    seen, lines = set(), []
    for pl, en in pairs:
        if pl in have or pl in seen: continue
        seen.add(pl)
        lines.append('  ' + json.dumps(pl, ensure_ascii=False) + ': ' + json.dumps(en, ensure_ascii=False) + ',')
    if not lines: print('nic nowego'); return
    block = '  // ---- ' + section + ' ----\n' + '\n'.join(lines) + '\n'
    i = s.rindex('};')
    open(P, 'w', encoding='utf-8').write(s[:i] + block + s[i:])
    print('dopisano', len(lines), 'wpisów:', section)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
