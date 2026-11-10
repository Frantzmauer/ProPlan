#!/usr/bin/env python3
"""Polskie napisy w kodzie, które nie przechodzą przez t()/tr()/plural() — lista do tłumaczenia.
Użycie: python3 tools/i18n_scan.py [plik.ts ...]   (bez argumentów: podsumowanie dla app/)
Pomija komentarze. Dane planu (nazwy ćwiczeń, produktów) są tłumaczone osobno — to też pokaże, ale celowo zostają po polsku."""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PL = re.compile(r'[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(i|w|z|na|do|nie|się|jest|dla|lub|albo|od|po|przy|bez|już|tylko|dziś|tydzień)\b', re.I)
LIT = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", re.S)
WRAP = re.compile(r'\b(t|tt|tr|plural|textKey)\(\s*$')

def strip_comments(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c in '\'"`':
            j = i + 1
            while j < n and s[j] != c:
                j += 2 if s[j] == '\\' else 1
            out.append(s[i:j + 1]); i = j + 1
        elif s.startswith('//', i) and (i == 0 or s[i - 1] != ':'):
            j = s.find('\n', i); j = n if j < 0 else j
            out.append(' ' * (j - i)); i = j
        elif s.startswith('/*', i):
            j = s.find('*/', i + 2); j = n if j < 0 else j + 2
            out.append(re.sub(r'[^\n]', ' ', s[i:j])); i = j
        else:
            out.append(c); i += 1
    return ''.join(out)

def scan(path):
    s = strip_comments(open(path, encoding='utf-8').read())
    res = []
    for m in LIT.finditer(s):
        txt = next(g for g in m.groups() if g is not None) if any(g is not None for g in m.groups()) else ''
        # tekst wewnątrz t('…')/plural(…) w szablonie jest już tłumaczony
        bare = re.sub(r"\b(t|tt|tr|plural)\(\s*('(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\")(\s*,\s*('(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"))*", '', txt)
        if len(txt) < 2 or not PL.search(bare): continue
        before = s[max(0, m.start() - 12):m.start()]
        if WRAP.search(before): continue
        line = s.count('\n', 0, m.start()) + 1
        res.append((line, txt))
    return res

if __name__ == '__main__':
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'app', '**', '*.ts'), recursive=True))
    tot = 0
    for f in files:
        if os.sep + 'i18n' + os.sep in f or f.endswith('i18n.ts'): continue
        r = scan(f); tot += len(r)
        if len(sys.argv) > 1:
            for line, txt in r: print(f'{line}: {txt[:160]!r}')
        elif r: print(f'{len(r):4d}  {os.path.relpath(f, ROOT)}')
    print('razem', tot)
