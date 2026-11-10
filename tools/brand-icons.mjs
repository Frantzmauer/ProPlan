// SixMo — znak i ikony z jednego źródła: icons/sixmo/ (strona, PWA) i android/…/res (ikona aplikacji, ekran startowy).
// Znak: sześć rozdzielonych krawędzi sześciokąta (krawędź 6 = bieżący, ostatni miesiąc) i cyfra 6 z Barlow Condensed Bold
// (kontur litery wpisany na stałe — pliki nie zależą od czcionek). Uruchom: node tools/brand-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'icons', 'sixmo');
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');
const C = { bg: '#0e1114', ink: '#f2f0ea', amber: '#ff7a1a' };

// krawędzie od górnego wierzchołka w prawo, pole 200×200
const EDGES = ['M109.7 25.6L159.6 54.4', 'M169.3 71.2L169.3 128.8', 'M159.6 145.6L109.7 174.4',
  'M90.3 174.4L40.4 145.6', 'M30.7 128.8L30.7 71.2', 'M40.4 54.4L90.3 25.6'];
// cyfra 6 — Barlow Condensed Bold (SIL OFL 1.1), jednostki czcionki (1000/em, oś y w górę)
const SIX = 'M417 218Q417 196 415 158Q412 79 361.0 35.5Q310 -8 225 -8Q145 -8 95.5 32.0Q46 72 37 151Q33 172 33 206L31 529Q31 611 83.5 659.5Q136 708 223 708Q304 708 355.5 659.0Q407 610 407 529V499Q407 494 403.5 490.5Q400 487 395 487H278Q273 487 269.5 490.5Q266 494 266 499V521Q266 548 253.0 566.0Q240 584 223 584Q201 584 187.0 566.5Q173 549 173 521V420Q173 417 175.0 416.5Q177 416 179 418Q212 446 254 446Q324 446 366.5 400.0Q409 354 413 277Q417 253 417 218ZM274 228Q274 255 270 290Q267 313 255.0 326.0Q243 339 224 339Q204 339 191.5 325.5Q179 312 176 288Q173 249 173 228Q173 204 176 166Q179 140 191.5 126.0Q204 112 224 112Q244 112 256.5 127.0Q269 142 272 169Q274 217 274 228Z';

/** Znak w polu 200×200. px = docelowy rozmiar znaku: grubsze linie przy małych, bez cyfry poniżej 24 px. */
function mark({ px, edge, cur, curOp = 1, six }) {
  const sw = px >= 120 ? 12 : px >= 48 ? 13 : px >= 24 ? 16 : 22;
  const lines = EDGES.map((d, i) => `<path d="${d}" stroke="${i === 5 ? cur : edge}"${i === 5 && curOp < 1 ? ` stroke-opacity="${curOp}"` : ''}/>`).join('');
  // rozmiar cyfry jak tekst 84/92 px na linii bazowej 129/133, wyśrodkowany (środek konturu x = 224)
  const [k, y] = px >= 48 ? [0.084, 129] : [0.092, 133];
  const digit = px >= 24 ? `<path d="${SIX}" fill="${six}" transform="translate(${(100 - 224 * k).toFixed(2)} ${y}) scale(${k} ${-k})"/>` : '';
  return `<g fill="none" stroke-width="${sw}" stroke-linecap="round">${lines}</g>${digit}`;
}

/** SVG w×h: tło (kształt), znak o boku `frac` krótszego boku, wyśrodkowany. */
function svg(w, h, { bg = null, shape = 'square', frac, look }) {
  const side = Math.min(w, h) * frac, x = (w - side) / 2, y = (h - side) / 2;
  const back = !bg ? '' : shape === 'circle' ? `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2}" fill="${bg}"/>`
    : shape === 'rounded' ? `<rect width="${w}" height="${h}" rx="${(w * 224 / 1024).toFixed(1)}" fill="${bg}"/>`
    : `<rect width="${w}" height="${h}" fill="${bg}"/>`;
  const m = look === 'dark' ? { edge: C.bg, cur: C.bg, curOp: 0.38, six: C.bg } : { edge: C.ink, cur: C.amber, six: C.ink };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${back}` +
    `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(side / 200).toFixed(4)})">${mark({ px: side, ...m })}</g></svg>`;
}

const icon = (n, o = {}) => svg(n, n, { bg: C.amber, shape: 'rounded', frac: 0.66, look: 'dark', ...o });
const jobs = [
  // strona i PWA
  [join(WEB, 'icon-1024.png'), icon(1024, { shape: 'square' })],          // sklepy (same zaokrąglają rogi)
  [join(WEB, 'icon-512.png'), icon(512)],
  [join(WEB, 'icon-192.png'), icon(192)],
  [join(WEB, 'icon-maskable-512.png'), icon(512, { shape: 'square', frac: 0.6 })],
  [join(WEB, 'apple-touch-icon.png'), icon(180, { shape: 'square' })],
  [join(WEB, 'favicon-32.png'), icon(32)],
];
// Android: ikona zwykła, okrągła i warstwa adaptacyjna (tło = kolor, warstwa przezroczysta, strefa bezpieczna 66/108)
for (const [dpi, n] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  jobs.push([join(RES, `mipmap-${dpi}`, 'ic_launcher.png'), icon(n)]);
  jobs.push([join(RES, `mipmap-${dpi}`, 'ic_launcher_round.png'), icon(n, { shape: 'circle' })]);
  const f = Math.round(n * 108 / 48);
  jobs.push([join(RES, `mipmap-${dpi}`, 'ic_launcher_foreground.png'), svg(f, f, { frac: 0.6, look: 'dark' })]);
}
// ekran startowy: ciemne tło, jasny znak z pomarańczową krawędzią
const splash = (w, h) => svg(w, h, { bg: C.bg, frac: 0.3, look: 'light' });
jobs.push([join(RES, 'drawable', 'splash.png'), splash(480, 320)]);
for (const [dpi, w, h] of [['mdpi', 320, 480], ['hdpi', 480, 800], ['xhdpi', 720, 1280], ['xxhdpi', 960, 1600], ['xxxhdpi', 1280, 1920]]) {
  jobs.push([join(RES, `drawable-port-${dpi}`, 'splash.png'), splash(w, h)]);
  jobs.push([join(RES, `drawable-land-${dpi}`, 'splash.png'), splash(h, w)]);
}

// pliki SVG: ikona (favicon) i znak do nagłówka aplikacji (przezroczysty, na ciemne tło)
mkdirSync(WEB, { recursive: true });
writeFileSync(join(WEB, 'icon.svg'), icon(1024).replace('<svg ', '<svg role="img" aria-label="SixMo" ') + '\n');
writeFileSync(join(WEB, 'logo.svg'), svg(200, 200, { frac: 1, look: 'light' }).replace('width="200" height="200" ', '') + '\n');
// znak 34 px w nagłówku: grubsze linie, mniejsza cyfra — osobny plik, żeby nie skalować dużego
writeFileSync(join(WEB, 'logo-sm.svg'), svg(34, 34, { frac: 1, look: 'light' }).replace('width="34" height="34" ', '') + '\n');

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, s] of jobs) {
  const [, w, h] = s.match(/width="(\d+)" height="(\d+)"/);
  await page.setViewportSize({ width: +w, height: +h });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${s}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await page.screenshot({ omitBackground: true }));
  console.log('zapisano', file.slice(ROOT.length + 1), `${w}×${h}`);
}
await browser.close();
