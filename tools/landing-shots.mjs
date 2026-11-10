// SixMo — zrzuty ekranów aplikacji na stronę startową (telefon 375×812, ekran ×2), z przykładowymi danymi.
// Dane są zmyślone (użytkownik „Tomek”, 11. tydzień planu) — nigdy dane prawdziwych osób.
// Wymaga podglądu Vite: `npx vite --port 5199 --strictPort` (moduły aplikacji ładowane bez pakowania — skrypt
// korzysta z planu z app/plan/data.ts, żeby historia treningów pasowała do ćwiczeń). Serwer Apps Script podstawiony.
// Uruchom: node tools/landing-shots.mjs [pl|en]   → docs/prototypes/shots/<lang>/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANG = process.argv[2] === 'en' ? 'en' : 'pl';
const OUT = join(ROOT, 'docs', 'prototypes', 'shots', LANG);
const BASE = 'http://127.0.0.1:5199/';
const SERVER = 'https://serwer.test/exec';
const NOW = new Date('2026-11-11T17:40:00+01:00');   // środa, dzień siłowni w fazie 2
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = n => { const d = new Date(NOW); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const ALL_ON = { coach: true, voice: true, form: true, estimate: true, photo: true, scanner: true, early: true };

const state = { startDate: ago(74), kcalGoal: 2300, _settingsM: 1,
  profile: { name: 'Tomek', weight: 92, height: 182, age: 34, sex: 'm', activity: 1.55, lang: LANG , consent: { v: '2026-11-10', terms: 1, health: 1 } },
  log: {}, weights: [], measures: [], custom: {}, shop: {}, shopT: {}, reminders: { on: false } };
const cloud = { url: SERVER, token: 'demo', account: 'tomek', on: true, lastSync: Date.now(), lastError: '' };

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: LANG === 'en' ? 'en-GB' : 'pl-PL', timezoneId: 'Europe/Warsaw', serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.clock.install({ time: NOW });
await page.route(SERVER, async route => {
  const b = JSON.parse(route.request().postData() || '{}');
  const quota = { m: ago(0).slice(0, 7), coach: { n: 12, max: 300 }, form: { n: 1, max: 30 }, est: { n: 4, max: 300, day: 20 } };
  const plan = { plan: 'premium', planName: 'Premium', enforced: false, features: ALL_ON, quota, lang: LANG };
  const res = b.action === 'ping' ? { ok: true, pong: true, admin: false, ...plan }
    : b.action === 'pull' || b.action === 'push' ? { ok: true, data: null }
    : { ok: true, ...plan };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
});
await page.addInitScript(([s, c]) => {
  if (sessionStorage.getItem('seeded')) return;
  localStorage.setItem('zelazo_v1', s); localStorage.setItem('zelazo_cloud', c); sessionStorage.setItem('seeded', '1');
  ['zelazo_seen_users', 'zelazo_seen_ea'].forEach(k => localStorage.setItem(k, '1'));
}, [JSON.stringify(state), JSON.stringify(cloud)]);
await page.goto(BASE);
await page.waitForTimeout(1500);

// historia: treningi z progresją ciężarów, posiłki, waga, obwody, rozmowa z Trenerem — z planu w aplikacji
await page.evaluate(async ({ today, lang }) => {
  const st = await import('/core/state.ts'), data = await import('/plan/data.ts');
  const S = st.S, days = 74, add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const r25 = x => Math.round(x / 2.5) * 2.5, rnd = (i, k) => (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
  for (let i = days; i >= 0; i--) {
    const d = add(today, -i), w = data.workoutOn(d), L = S.log[d] = { meals: {}, ex: {}, habits: {}, water: i ? 6 : 3 };
    const dow = new Date(d + 'T12:00:00').getDay(), meals = (data.DIET[dow] || { meals: [] }).meals;
    const eaten = i === 0 ? Math.min(3, meals.length) : (i > 40 && Math.abs(rnd(i, 1)) < 0.15 ? meals.length - 1 : meals.length);   // ostatnie 6 tygodni bez wpadek
    for (let k = 0; k < eaten; k++) L.meals['m' + k] = true;
    if (i === 0 || w.type !== 'lift' || (i > 40 && Math.abs(rnd(i, 2)) < 0.1)) continue;   // dziś trening jeszcze przed nami
    const prog = 1 - i / days;
    w.ex.forEach((e, k) => {
      const kg = e.w > 0 ? r25(e.w * (0.78 + 0.27 * prog)) : 0, reps = typeof e.rp === 'number' ? e.rp : 10, sets = {}, ok = {};
      for (let s = 1; s <= e.s; s++) { if (kg) sets['w' + s] = String(kg); sets['r' + s] = String(Math.max(1, reps - (s === e.s && Math.abs(rnd(i, k + s)) < 0.4 ? 1 : 0))); ok[s] = true; }
      L.ex[d + '_e' + k] = { done: true, sets, ok };
    });
  }
  S.weights = [];
  for (let i = days + 3; i >= 0; i -= 2) S.weights.push({ d: add(today, -i), w: Math.round((92.4 - 7.8 * (1 - i / (days + 3)) + 0.5 * rnd(i, 3)) * 10) / 10 });
  S.measures = [[days + 2, 101, 108, 37, 61, 105], [52, 98.5, 107, 37.5, 60, 103], [30, 96, 106.5, 38, 59.5, 101.5], [3, 93.5, 106, 38.5, 59, 100]]
    .map(([i, waist, chest, arm, thigh, hips]) => ({ d: add(today, -i), waist, chest, arm, thigh, hips, _t: 1 }));
  const pl = lang === 'pl', t0 = Date.now() - 3600e3;
  S.coach = { clearedAt: 0, msgs: [
    { id: 'c1', t: t0, role: 'user', content: pl ? 'Wyciskanie na ławce w poniedziałek szło lekko — 4×8 na 77,5 kg. A waga stoi od 10 dni. Co zmieniamy?' : 'Bench press on Monday felt easy — 4×8 at 77.5 kg. And my weight has stalled for 10 days. What do we change?' },
    { id: 'c2', t: t0 + 60e3, role: 'assistant', content: pl
      ? '**Ławka:** 4×8 na 77,5 kg to pełny zakres — czas na progres: **80 kg**, celuj w 7 powtórzeń.\n\n**Waga:** średnia z 7 dni spadła z 85,1 do 84,8 kg — wolniej niż zakładane 0,5% tygodniowo. Białko trzymasz (śr. 176 g), więc tniemy kalorie tam, gdzie najmniej boli: **lżejsza kolacja w dni bez siłowni** (−180 kcal).\n\nTo da ok. −0,4 kg tygodniowo bez ruszania treningów.'
      : '**Bench:** 4×8 at 77.5 kg is the full range — time to progress: **80 kg**, aim for 7 reps.\n\n**Weight:** your 7-day average went from 85.1 to 84.8 kg — slower than the planned 0.5% a week. Protein is on point (avg 176 g), so we cut where it hurts least: **a lighter dinner on non-gym days** (−180 kcal).\n\nThat’s about −0.4 kg a week without touching your training.',
      proposal: { podsumowanie: pl ? 'Progres na ławce i lżejsza kolacja w dni bez siłowni.' : 'Bench progression and a lighter dinner on non-gym days.',
        cwiczenia: [{ nazwa: 'Wyciskanie sztangi — ławka płaska', ciezar_kg: 80, serie: 4, powtorzenia: 7 }, { nazwa: 'Wiosłowanie hantlem jednorącz', ciezar_kg: 32, serie: 3, powtorzenia: 12 }],
        posilki: [{ posilek: 'Kolacja', dni: [2, 4, 6, 0], opis: pl ? 'Twarożek chudy 250 g, rzodkiewka, pomidory, 2 kromki żytnie' : 'Low-fat cottage cheese 250 g, radish, tomatoes, 2 slices of rye bread', kcal: 420, bialko_g: 42, wegle_g: 38, tluszcz_g: 9 }], cel_kcal: 0 } },
  ] };
  localStorage.setItem('zelazo_v1', JSON.stringify(S));
}, { today: ago(0), lang: LANG });
await page.reload();
await page.waitForTimeout(1500);

const shot = async (name, prep) => {
  if (prep) await prep();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, name + '.png') });
  console.log('zapisano', name);
};
const tab = v => page.locator(`.nav button[data-v="${v}"]`).click();
const top = () => page.evaluate(() => window.scrollTo(0, 0));

await shot('01-dieta', async () => { await tab('diet'); await top(); });
await shot('02-trener-rozmowa', async () => { await page.locator('#coachFab').click(); await page.waitForTimeout(800); await page.locator('#coachMsgs').evaluate(el => { el.scrollTop = 0; }); });
await page.goto(BASE); await page.waitForTimeout(1500);
await shot('03-trening', async () => { await tab('train'); await top(); });
await page.goto(BASE); await page.waitForTimeout(1500);
await shot('05-postep', async () => { await tab('progress'); await page.locator('#weightInput').scrollIntoViewIfNeeded(); await page.evaluate(() => { document.getElementById('weightInput').scrollIntoView({ block: 'start' }); window.scrollBy(0, -150); }); });
await shot('06-rekordy', async () => { await page.locator('#recSide').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -70)); });
await shot('07-historia-cwiczenia', async () => { if (await page.locator('#recMore').isVisible()) await page.locator('#recMore').click(); await page.locator('[data-hist]', { hasText: LANG === 'en' ? 'Barbell bench' : 'Wyciskanie sztangi' }).first().click(); });
await page.goto(BASE); await page.waitForTimeout(1500);
await shot('08-sylwetka-3d', async () => {
  await tab('progress'); await page.locator('#b3Open').click();
  await page.locator('#b3Stage canvas').waitFor(); await page.locator('#b3Msg').waitFor({ state: 'hidden', timeout: 20000 });
  await page.locator('#b3Mode [data-m="cmp"]').click(); await page.waitForTimeout(1500);
});
await page.goto(BASE); await page.waitForTimeout(1500);
await shot('09-trener-propozycja', async () => { await page.locator('#coachFab').click(); await page.waitForTimeout(800); await page.locator('#coachMsgs').evaluate(el => { el.scrollTop = el.scrollHeight; }); });
await page.goto(BASE); await page.waitForTimeout(1500);
await shot('10-zakupy', async () => { await tab('shop'); await top(); });
await shot('11-plan', async () => { await tab('progress'); await top(); await page.locator('.plan-more summary').click(); await page.locator('.plan-more').scrollIntoViewIfNeeded(); });
// tryb treningu na końcu — po rozpoczęciu aplikacja wraca do niego przy każdym otwarciu
await page.goto(BASE); await page.waitForTimeout(1500); await tab('train');
await shot('04-trening-aktywny', async () => {
  await page.locator('[data-wo-start]').first().click();
  for (const k of ['sleep', 'sore', 'energy']) await page.locator(`[data-cia="${k}:2"]`).click();
  await page.locator('#ciSheet [data-ciplan="normal"]').first().click();
  await page.locator('#woFocus').waitFor();
  await page.waitForTimeout(4000);
});
await browser.close();
