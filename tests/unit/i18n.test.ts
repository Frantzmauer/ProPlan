// Słownik angielski jest kompletny: każdy t('…') w kodzie i każdy statyczny tekst z index.html ma tłumaczenie.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EN } from '../../app/i18n/en';
import { plural, setLang, t, textKey } from '../../app/lib/i18n';

const ROOT = join(__dirname, '..', '..');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === 'i18n' ? [] : tsFiles(p)) : /\.ts$/.test(n) && n !== 'i18n.ts' ? [p] : [];
  });
}

/** Klucze t('…') z kodu: pierwszy argument jako zwykły napis (bez wstawek ${…}). */
export function codeKeys(): string[] {
  const out = new Set<string>();
  for (const f of tsFiles(join(ROOT, 'app'))) {
    const s = readFileSync(f, 'utf-8');
    for (const m of s.matchAll(/\bt\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g)) {
      const k = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
      if (k) out.add(k);
    }
  }
  return [...out];
}

/** Statyczne teksty i atrybuty z index.html (bez skryptów, stylów i elementów data-no-i18n). */
export function htmlKeys(): string[] {
  let h = readFileSync(join(ROOT, 'app', 'index.html'), 'utf-8');
  h = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
  const out = new Set<string>();
  for (const m of h.matchAll(/>([^<>]+)</g)) out.add(textKey(m[1]));
  for (const m of h.matchAll(/\s(?:placeholder|aria-label|title|alt)="([^"]+)"/g)) out.add(textKey(m[1]));
  // bez znaków do tłumaczenia: liczby, symbole, emoji, miejsca do wypełnienia, nazwa marki
  return [...out].filter(k => /\p{L}/u.test(k) && !/^%%\w+%%$/.test(k) && !/^(SixMo|Six|Mo|kcal|BETA|g|kg|cm|min|s|×|PL|EN|OK)$/.test(k));
}

describe('tłumaczenie', () => {
  it('t(): polski bez zmian, angielski ze słownika, zmienne', () => {
    setLang('en', { 'Zostało {n} z {max}': '{n} of {max} left', Zapisz: 'Save' });
    expect(t('Zapisz')).toBe('Save');
    expect(t('Zostało {n} z {max}', { n: 3, max: 10 })).toBe('3 of 10 left');
    expect(t('Brak w słowniku')).toBe('Brak w słowniku');
    expect(plural(1, '{n} dzień', '{n} dni', '{n} dni', '{n} day', '{n} days')).toBe('1 day');
    setLang('pl');
    expect(t('Zostało {n} z {max}', { n: 3, max: 10 })).toBe('Zostało 3 z 10');
    expect(plural(3, '{n} seria', '{n} serie', '{n} serii', '', '')).toBe('3 serie');
    expect(plural(12, '{n} seria', '{n} serie', '{n} serii', '', '')).toBe('12 serii');
    expect(plural(22, '{n} seria', '{n} serie', '{n} serii', '', '')).toBe('22 serie');
  });

  it('każdy t(…) z kodu ma tłumaczenie', () => {
    expect(codeKeys().filter(k => !(k in EN))).toEqual([]);
  });

  it('każdy statyczny tekst ekranu ma tłumaczenie', () => {
    expect(htmlKeys().filter(k => !(k in EN))).toEqual([]);
  });

  it('tłumaczenia zachowują zmienne {…}', () => {
    const bad = Object.entries(EN).filter(([k, v]) => {
      const vars = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join();
      return vars(k) !== vars(v);
    }).map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
