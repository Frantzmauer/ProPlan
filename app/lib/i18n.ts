// Tłumaczenie aplikacji. Kluczem jest polski tekst: t('Zapisz') → po angielsku „Save”, po polsku bez zmian.
// Słownik angielski: app/i18n/en.ts. Zmienne w nawiasach klamrowych: t('Zostało {n} z {max}', {n, max}).
// Statyczne teksty z index.html tłumaczy translateDom przy starcie; zmiana języka przeładowuje aplikację.
// Brakujące tłumaczenia wyłapuje test (tests/unit/i18n.test.ts) — po angielsku zostaje wtedy tekst polski.
import type { Lang } from './lang';

export type Dict = Record<string, string>;
type Vars = Record<string, string | number>;

let LANG: Lang = 'pl';
let DICT: Dict = {};

/** Ustaw język i słownik (dla 'pl' słownik jest pusty). */
export function setLang(l: Lang, dict: Dict = {}): void { LANG = l; DICT = l === 'pl' ? {} : dict; }
export function curLang(): Lang { return LANG; }
export const isEn = (): boolean => LANG === 'en';

function fill(s: string, v?: Vars): string {
  return v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? String(v[k]) : m)) : s;
}

/** Tekst w bieżącym języku. */
export function t(pl: string, v?: Vars): string { return fill((LANG !== 'pl' && DICT[pl]) || pl, v); }

/** Wybór gotowych wariantów, gdy zdania różnią się budową: tr('Zjedzone', 'Eaten'). */
export function tr(pl: string, en: string): string { return LANG === 'en' ? en : pl; }

/** Liczba mnoga: po polsku 1 / 2–4 / 5+, po angielsku 1 / reszta. Formy mogą mieć {n}. */
export function plural(n: number, one: string, few: string, many: string, enOne: string, enMany: string): string {
  let s: string;
  if (LANG === 'en') s = n === 1 ? enOne : enMany;
  else {
    const a = Math.abs(n), d = a % 10, h = a % 100;
    s = a === 1 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
  }
  return fill(s, { n });
}

/** Klucz tekstu z węzła strony: bez skrajnych spacji, spacje w środku zwinięte. */
export function textKey(s: string): string { return s.replace(/\s+/g, ' ').trim(); }

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

/** Przetłumacz statyczne teksty i atrybuty pod `root` (dokładne dopasowanie do klucza słownika). */
export function translateDom(root: Element): void {
  if (LANG === 'pl') return;
  const walk = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const p = n.parentElement;
    if (!p || p.closest('script,style,[data-no-i18n]')) continue;
    const raw = n.nodeValue || '', k = textKey(raw);
    if (!k || !DICT[k]) continue;
    const lead = raw.match(/^\s*/)![0], trail = raw.match(/\s*$/)![0];
    n.nodeValue = lead + DICT[k] + trail;
  }
  root.querySelectorAll('*').forEach(el => ATTRS.forEach(a => {
    const v = el.getAttribute(a); if (v && DICT[textKey(v)]) el.setAttribute(a, DICT[textKey(v)]);
  }));
}

/** Ustawienia regionalne do dat i liczb (toLocaleDateString itp.). */
export function locale(): string { return LANG === 'en' ? 'en-GB' : 'pl-PL'; }

/** Nazwy dni i miesięcy w bieżącym języku. */
export function dayNames(): string[] {
  return LANG === 'en' ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
}
export function dayShort(): string[] {
  return LANG === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
}
export function monthShort(): string[] {
  return LANG === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
}
/** Pełne nazwy miesięcy w mianowniku („listopad”, „November”). */
export function monthNames(): string[] {
  return LANG === 'en' ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
}

/** Liczba z przecinkiem (pl) albo kropką (en): dec(0.456, 2) → „0,46” / „0.46”. Bez `digits` — tak, jak jest. */
export function dec(x: number, digits?: number): string {
  const s = digits === undefined ? String(x) : x.toFixed(digits);
  return LANG === 'en' ? s : s.replace('.', ',');
}
