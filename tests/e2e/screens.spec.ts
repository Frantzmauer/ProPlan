import { expect, test, type Page } from '@playwright/test';

// Ekrany z modułów screens/ i features/: tryb treningu z check-inem, Zamień, przerwy, Trener, panel admina, skaner.
// Serwer i Open Food Facts są podstawione.

const SERVER = 'https://serwer.test/exec';
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const ALL_ON = { coach: true, voice: true, form: true, estimate: true, photo: true, scanner: true, early: true };

async function seed(page: Page, { cloud = false, admin = false } = {}) {
  const state = { startDate: ago(7), kcalGoal: 2200, profile: { name: 'Test', weight: 80, height: 180, age: 35, sex: 'm', activity: 1.55 , consent: { v: '2026-11-10', terms: 1, health: 1 } },
    log: {}, weights: [], measures: [], shop: {}, shopT: {}, reminders: { on: false }, _settingsM: 1 };
  const cfg = cloud ? { url: SERVER, token: 'tok', account: 'test', on: true, lastSync: 0, lastError: '' } : null;
  await page.addInitScript(([s, c]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('zelazo_v1', s); if (c) localStorage.setItem('zelazo_cloud', c); sessionStorage.setItem('seeded', '1');
  }, [JSON.stringify(state), cfg ? JSON.stringify(cfg) : '']);
  if (cloud) await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    const quota = { m: ago(0).slice(0, 7), coach: { n: 3, max: 30 }, form: { n: 0, max: 10 }, est: { n: 0, max: 300, day: 20 } };
    const plan = { plan: 'premium', planName: 'Premium', enforced: true, features: ALL_ON, quota };
    const plans = { premium: { name: 'Premium', limits: { coach: 30, form: 10, est: 300, estDay: 20 }, features: ALL_ON } };
    const cfgS = { enforce: ['users', 'early'], defaultPlan: 'premium', adminPlan: 'premium', off: [] };
    const res: Record<string, unknown> =
      b.action === 'ping' ? { ok: true, pong: true, admin, ...plan }
      : b.action === 'usage' ? { ok: true, usage: {}, ...plan }
      : b.action === 'pull' || b.action === 'push' ? { ok: true, data: null }
      : b.action === 'coach' ? { ok: true, text: 'Odpowiedź testowa Trenera.', quota: { ...quota, coach: { n: 4, max: 30 } } }
      : b.action === 'adminSetLang' ? { ok: true, lang: b.lang, langPending: true }
      : b.action === 'adminList' ? { ok: true, users: [{ account: 'anna', plan: '', lastSeen: Date.now(), lang: 'pl', usage: { coach: 27, form: 2, est: 40, usd: 2.1 } }],
          invites: [], myUsage: { usd: 1 }, totalUsd: 3.1, totalAllUsd: 5, plans, cfg: cfgS }
      : { ok: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
  });
}
function watch(page: Page) { const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); return errors; }

test('tryb treningu: check-in, start, pauza', async ({ page }) => {
  const errors = watch(page);
  await seed(page);
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="train"]').click();
  const start = page.locator('[data-wo-start]');
  test.skip(!(await start.count()), 'dziś w planie nie ma treningu siłowego');
  await start.click();
  await expect(page.locator('#ciSheet')).toBeVisible();
  for (const k of ['sleep', 'sore', 'energy']) await page.locator(`[data-cia="${k}:2"]`).click();
  await page.locator('#ciSheet [data-ciplan="normal"]').first().click();
  await expect(page.locator('#woFocus')).toBeVisible();
  await expect(page.locator('#woEnd')).toHaveText(/Wstrzymaj/i);
  await page.locator('#woEnd').click();
  await expect(page.locator('#woEnd')).toHaveText(/Wznów|Zamknij/i);
  expect(errors).toEqual([]);
});

test('Zamień i przerwy otwierają swoje okna', async ({ page }) => {
  const errors = watch(page);
  await seed(page);
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="train"]').click();
  const sw = page.locator('[data-swap]').first();
  if (await sw.count()) { await sw.click(); await expect(page.locator('#swSheet')).toBeVisible(); await page.keyboard.press('Escape'); await page.goto('/beta/'); }
  await page.locator('.nav button[data-v="set"]').click();
  await page.locator('#moreMenu [data-rest-list]').click();
  await expect(page.locator('#rsSheet')).toBeVisible();
  await expect(page.locator('#rsSheet')).toContainText('Przerwy między seriami');
  expect(errors).toEqual([]);
});

test('Trener: pytanie, odpowiedź i licznik (USERS)', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true });
  await page.goto('/users/');
  await page.locator('#coachFab').click();
  await expect(page.locator('#coachQuota')).toHaveText(/27 z 30/);
  await page.locator('#coachIn').fill('Jak mi idzie?');
  await page.locator('#coachSend').click();
  await expect(page.locator('#coachMsgs')).toContainText('Odpowiedź testowa Trenera.');
  await expect(page.locator('#coachQuota')).toHaveText(/26 z 30/);
  await page.locator('#coachIn').fill('dzięki!');
  await page.locator('#coachSend').click();
  await expect(page.locator('#coachMsgs')).toContainText('nie liczy się do limitu');
  await expect(page.locator('#coachQuota')).toHaveText(/26 z 30/);
  expect(errors).toEqual([]);
});

test('panel admina: konta i plany (USERS)', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true, admin: true });
  await page.goto('/users/');
  await page.locator('.nav button[data-v="set"]').click();
  await expect(page.locator('#mmAdmBtn')).toBeVisible();
  await page.locator('#mmAdmBtn').click();
  await expect(page.locator('.ap-acc', { hasText: 'anna' })).toBeVisible();
  await page.locator('[data-aptab="plans"]').click();
  await expect(page.locator('.ap-card')).toContainText('Najgorszy przypadek');
  expect(errors).toEqual([]);
});

test('skaner: kod wpisany ręcznie → produkt z Open Food Facts', async ({ page }) => {
  const errors = watch(page);
  await seed(page);
  await page.route('https://world.openfoodfacts.org/**', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 1, product: { product_name: 'Skyr naturalny', brands: 'Testowa', quantity: '150 g', serving_quantity: 150,
      nutriments: { 'energy-kcal_100g': 64, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 } } }) }));
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="diet"]').click();
  await page.locator('#addMealBtn').click();
  await page.locator('#mdScan').click();
  await page.locator('#bcCode').fill('5901234123457');
  await page.locator('#bcGo').click();
  await expect(page.locator('#bcPanel')).toContainText('Skyr naturalny');
  await page.locator('#bcUse').click();
  await expect(page.locator('#mdKcal')).toHaveValue('96');
  expect(errors).toEqual([]);
});

test('Dieta: „Zamień” — własny posiłek zamiast posiłku z planu', async ({ page }) => {
  const errors = watch(page);
  await seed(page);
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="diet"]').click();
  await page.locator('#mealsCard [data-mrep="m0"]').click();
  await expect(page.locator('#mdTxt')).toHaveAttribute('placeholder', /co było zamiast/);
  await expect(page.locator('#mdRep [aria-checked="true"]')).toHaveAttribute('data-mdrep', 'm0');   // „Zamień” = ten posiłek wybrany w „Zastępuje”
  await page.locator('#mdTxt').fill('Kurczak z puree');
  await page.locator('#mdKcal').fill('331');
  await page.locator('#mdSave').click();
  await expect(page.locator('#mealsCard')).toContainText('zastąpiony: Kurczak z puree');
  await expect(page.locator('#mealsCard')).toContainText('Zamiast:');
  await expect(page.locator('#mealsCard [data-mrep="m0"]')).toHaveCount(0);
  await expect(page.locator('#mealsProgress')).toContainText('1/');
  await expect(page.locator('#dateLabel')).toContainText('posiłki 1/4');
  // usunięcie zamiennika: posiłek z planu znów do odhaczenia
  await page.locator('#mealsCard [data-cdel]').click();
  await expect(page.locator('#mealsCard [data-mrep="m0"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Postęp: edycja zapisanego obwodu', async ({ page }) => {
  const errors = watch(page);
  await seed(page);
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="progress"]').click();
  await page.locator('#ms_waist').fill('98');
  await page.locator('#ms_chest').fill('115.5');
  await page.locator('#msSave').click();
  await expect(page.locator('#msHist')).toContainText('Pas 98,0');
  await expect(page.locator('#msHist')).toContainText('Klatka 115,5');
  await page.locator('#msHist [data-msedit]').click();
  await expect(page.locator('#ms_waist')).toHaveValue('98');
  await expect(page.locator('#ms_chest')).toHaveValue('115.5');   // wartość z częścią dziesiętną też wraca do pola
  await expect(page.locator('#msSave')).toHaveText('Zapisz zmiany');
  await page.locator('#ms_waist').fill('105');
  await page.locator('#msSave').click();
  await expect(page.locator('#msHist')).toContainText('Pas 105,0');
  await expect(page.locator('#msHist')).toContainText('Klatka 115,5');
  await expect(page.locator('#msHist .ms-hist')).toHaveCount(1);
  await expect(page.locator('#msSave')).toHaveText('Zapisz pomiar');
  expect(errors).toEqual([]);
});

test('Trener dostaje dziennik jedzenia i opis aplikacji (USERS)', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true });
  let sent: { context?: string; contextLive?: string; features?: string[] } = {};
  await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.action !== 'coach') return route.fallback();
    sent = b;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'OK.' }) });
  });
  await page.goto('/users/');
  await page.locator('.nav button[data-v="diet"]').click();
  await page.locator('#mealsCard [data-meal="m0"]').first().click();
  await page.locator('#coachFab').click();
  await page.locator('#coachIn').fill('Ile dziś zjadłem?');
  await page.locator('#coachSend').click();
  await expect(page.locator('#coachMsgs')).toContainText('OK.');
  // część bieżąca: dziennik (zwięzły, z legendą); stała: opis aplikacji na początku
  expect(sent.contextLive).toContain('Dziennik jedzenia, ostatnie 14 dni');
  expect(sent.contextLive).toMatch(/DZIŚ\|[1-9]\d*\/2200\|B\d+\/\d+/);
  expect(sent.contextLive).toMatch(/\n {2}✓Śniadanie/);
  expect(sent.contextLive).toMatch(/DZIŚ\|.*\|(w toku|ZAL)/);
  expect(sent.context).toMatch(/^Jak działa aplikacja SixMo/);
  expect(sent.context).toContain('Dzień diety zaliczony');
  expect(sent.context).not.toContain('Dziennik jedzenia');
  expect(sent.features).toContain('obwody');
  expect(errors).toEqual([]);
});

test('Dieta: „Zastępuje” w oknie posiłku i karta „Dzień diety”', async ({ page }) => {
  const errors = watch(page);
  await seed(page);
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="diet"]').click();
  await expect(page.locator('#dietScore')).toContainText('w toku');
  await page.locator('#addMealBtn').click();
  await expect(page.locator('#mdRep [aria-checked="true"]')).toHaveText('Dodatkowy');
  await page.locator('#mdRep [data-mdrep="m2"]').click();
  await expect(page.locator('#mdRepHint')).toContainText('przestanie się liczyć');
  await page.locator('#mdTxt').fill('Kurczak z puree');
  await page.locator('#mdKcal').fill('600');
  await page.locator('#mdP').fill('45');
  await page.locator('#mdSave').click();
  await expect(page.locator('#mealsCard')).toContainText('zastąpiony: Kurczak z puree');
  await expect(page.locator('#mealsCard [data-mrep="m2"]')).toHaveCount(0);
  // ponowne otwarcie: zastąpiony posiłek nie jest już do wyboru
  await page.locator('#addMealBtn').click();
  await expect(page.locator('#mdRep [data-mdrep="m2"]')).toHaveCount(0);
  await page.locator('#mdCancel').click();
  // dodatkowy posiłek domyka dzień: 2200 kcal → 1870–2420, białko ≥ 80%
  await page.locator('#addMealBtn').click();
  await page.locator('#mdTxt').fill('Dzień w posiłkach własnych');
  await page.locator('#mdKcal').fill('1400');
  await page.locator('#mdP').fill('150');
  await page.locator('#mdSave').click();
  await expect(page.locator('#dietScore')).toContainText('✓ zaliczony');
  expect(errors).toEqual([]);
});

test('Język konta: English → Trener po angielsku, lang w zapytaniu (USERS)', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true });
  let sent: { lang?: string } = {};
  await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.action !== 'coach') return route.fallback();
    sent = b;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Great job.' }) });
  });
  await page.goto('/users/');
  await page.locator('#coachFab').click();
  await expect(page.locator('#coachChips button').first()).toHaveText('Jak mi idzie? Oceń moje postępy');
  await page.locator('#coachClose').click();
  // Więcej → Profil: Język · Language
  await page.evaluate(() => { const el = document.getElementById('pfLang') as HTMLSelectElement; el.value = 'en'; el.dispatchEvent(new Event('change')); });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zelazo_v1') || '{}').profile.lang)).toBe('en');
  await page.locator('#coachFab').click();
  await expect(page.locator('#coachMsgs')).toContainText("I'm your Coach");
  await expect(page.locator('#coachChips button').first()).toHaveText('How am I doing? Review my progress');
  await expect(page.locator('#coachIn')).toHaveAttribute('placeholder', 'Type or say your question…');
  await page.locator('#coachChips button').first().click();
  await expect(page.locator('#coachMsgs')).toContainText('Great job.');
  expect(sent.lang).toBe('en');
  expect(errors).toEqual([]);
});

test('panel admina: język konta — znaczek i zmiana (USERS)', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true, admin: true });
  await page.goto('/users/');
  await page.locator('.nav button[data-v="set"]').click();
  await page.locator('#mmAdmBtn').click();
  const acc = page.locator('.ap-acc', { hasText: 'anna' });
  await expect(acc.locator('.ap-lang')).toHaveText('PL');
  await acc.click();
  await page.locator('#apAccLang [data-aplang="en"]').click();
  await expect(page.locator('#apAccLang [data-aplang="en"]')).toHaveClass(/\bon\b/);
  await expect(page.locator('#apPanel')).toContainText('Czeka na urządzenie');
  await expect(acc.locator('.ap-lang')).toHaveText('EN…');
  expect(errors).toEqual([]);
});

test('język ustawiony przez administratora: aplikacja przejmuje go przy połączeniu', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true });
  await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.action !== 'ping') return route.fallback();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pong: true, admin: false, lang: 'en', langAt: 5000 }) });
  });
  await page.goto('/users/');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zelazo_v1') || '{}').profile.lang)).toBe('en');
  await page.locator('#coachFab').click();
  await expect(page.locator('#coachMsgs')).toContainText("I'm your Coach");
  expect(errors).toEqual([]);
});

test('Postęp: sylwetka 3D z obwodów, porównanie ze startem', async ({ page }) => {
  const errors = watch(page);
  await seed(page);
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="progress"]').click();
  // obecny pomiar z formularza, start z wcześniejszą datą dopisany w danych
  await page.locator('#ms_waist').fill('101'); await page.locator('#ms_chest').fill('114'); await page.locator('#msSave').click();
  await page.evaluate(() => {
    const k = 'zelazo_v1', S = JSON.parse(localStorage.getItem(k) || '{}');
    S.measures.unshift({ d: '2026-10-01', waist: 110, chest: 112, _t: 1 });
    S.weights = [{ d: '2026-09-01', w: 96 }, { d: '2026-09-30', w: 92 }];   // 4 kg więcej przed pierwszym pomiarem → szacowany start
    localStorage.setItem(k, JSON.stringify(S));
  });
  await page.reload();
  await page.locator('.nav button[data-v="progress"]').click();
  await page.locator('#b3Open').click();
  await expect(page.locator('#b3Stage canvas')).toBeVisible();
  await expect(page.locator('#b3Msg')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('#b3Chg')).toContainText('Pas');
  await expect(page.locator('#b3Chg')).toContainText('-13');   // 101 teraz vs 114 na szacowanym starcie (110 + 4 kg × 1 cm)
  await expect(page.locator('#b3Est')).toContainText('szacunek z wagi');
  await expect(page.locator('#b3Ghost')).toBeHidden();               // przełącznik tylko przy porównaniu
  await page.locator('#b3Mode [data-m="cmp"]').click();
  await expect(page.locator('#b3Leg')).toContainText('start');
  // siatka ↔ wypełnienie, zapamiętane na urządzeniu
  await expect(page.locator('#b3Ghost')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#b3Ghost').click();
  await expect(page.locator('#b3Ghost')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('zelazo_body3d_fill'))).toBe('1');
  // przybliżenie suwakiem: po przybliżeniu pionowe przeciągnięcie przesuwa sylwetkę (nie przewija strony)
  await page.locator('#b3Zoom').fill('2.5');
  await expect(page.locator('#b3Stage canvas')).toHaveCSS('touch-action', 'none');
  await page.locator('#b3Front').click();                             // Przód = cała sylwetka
  await expect(page.locator('#b3Zoom')).toHaveValue('1');
  expect(errors).toEqual([]);
});

test('Trener: historia rozmowy — 8 ostatnich wiadomości, starsze odpowiedzi skrócone (USERS)', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true });
  // 12 wcześniejszych wiadomości, długie odpowiedzi Trenera
  await page.addInitScript(() => {
    const k = 'zelazo_v1', S = JSON.parse(localStorage.getItem(k) || '{}'); if (S.coach) return;
    const msgs = []; for (let i = 0; i < 12; i++) msgs.push({ id: 'm' + i, t: i + 1, role: i % 2 ? 'assistant' : 'user', content: (i % 2 ? 'Odpowiedź ' : 'Pytanie ') + i + ' ' + 'x'.repeat(i % 2 ? 1500 : 20) });
    S.coach = { clearedAt: 0, msgs }; localStorage.setItem(k, JSON.stringify(S));
  });
  let sent: { messages?: { role: string; content: string }[] } = {};
  await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.action !== 'coach') return route.fallback();
    sent = b;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'OK.' }) });
  });
  await page.goto('/users/');
  await page.locator('#coachFab').click();
  await page.locator('#coachIn').fill('Nowe pytanie');
  await page.locator('#coachSend').click();
  await expect(page.locator('#coachMsgs')).toContainText('OK.');
  const m = sent.messages || [];
  expect(m).toHaveLength(8);
  expect(m[m.length - 1].content).toBe('Nowe pytanie');
  expect(m[0].role).toBe('assistant');
  expect(m[0].content).toMatch(/… \[skrócone\]$/);              // starsza odpowiedź Trenera — skrót
  expect(m[0].content.length).toBeLessThan(560);
  expect(m[m.length - 2].content.length).toBeGreaterThan(1500);   // ostatnia odpowiedź w całości
  expect(errors).toEqual([]);
});

test('limit Trenera wykorzystany: bez wysyłania do AI, oferta Premium i pakietu (USERS, plan Darmowy)', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true });
  let asked = 0;
  await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.action === 'coach') asked++;
    if (b.action !== 'ping' && b.action !== 'usage') return route.fallback();
    const quota = { m: ago(0).slice(0, 7), coach: { n: 5, max: 5 }, form: { n: 0, max: 0 }, est: { n: 2, max: 10, day: 10 } };
    const features = { ...ALL_ON, voice: false, form: false, photo: false, scanner: false, early: false };
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, pong: true, admin: false, plan: 'free', planName: 'Darmowy', enforced: true, features, quota }) });
  });
  await page.goto('/users/');
  await page.locator('#coachFab').click();
  await expect(page.locator('#coachLimit')).toBeVisible();
  await expect(page.locator('#coachLimit')).toContainText('Limit 5 pytań');
  await expect(page.locator('#coachLimit [data-offer="premium"]')).toContainText('Przejdź na Premium');
  await expect(page.locator('#coachLimit [data-offer="pack"]')).toContainText('50 pytań');
  await expect(page.locator('#coachIn')).toBeDisabled();
  await page.locator('#coachLimit [data-offer="premium"]').click();
  expect(asked).toBe(0);
  expect(errors).toEqual([]);
});

test('Więcej: ustawienia techniczne tylko dla administratora', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true });
  await page.goto('/users/');
  await page.locator('.nav button[data-v="set"]').click();
  await expect(page.locator('[data-more="ver"]')).toBeHidden();
  await page.locator('[data-more="sync"]').click();
  await expect(page.locator('#cloudSyncBtn')).toBeVisible();
  for (const id of ['#cloudUrl', '#cloudToken', '#cloudAccount', '#cloudTestBtn', '#cloudToggle']) await expect(page.locator(id)).toBeHidden();
  await page.locator('#moreBack').click(); await page.locator('[data-more="data"]').click();
  await expect(page.locator('#btnExport')).toBeVisible();
  await expect(page.locator('#btnImport')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Więcej: administrator widzi ustawienia techniczne', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true, admin: true });
  await page.goto('/users/');
  await page.locator('.nav button[data-v="set"]').click();
  await expect(page.locator('[data-more="ver"]')).toBeVisible();
  await page.locator('[data-more="sync"]').click();
  await expect(page.locator('#cloudUrl')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Więcej: regulamin i polityka prywatności otwierają się w języku aplikacji', async ({ page, request }) => {
  await seed(page);
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="set"]').click();
  await page.locator('[data-more="legal"]').click();
  await expect(page.locator('#lgTerms')).toHaveAttribute('href', '../legal/regulamin.html');
  await expect(page.locator('#lgPrivacy')).toHaveAttribute('href', '../legal/polityka-prywatnosci.html');
  for (const f of ['regulamin', 'polityka-prywatnosci', 'terms', 'privacy']) expect((await request.get('/legal/' + f + '.html')).status()).toBe(200);
  await page.locator('#lgPrivacy').click();
  await expect(page.locator('h1')).toContainText('Polityka prywatności');
});

test('Więcej: usunięcie konta — dwa stuknięcia, serwer usuwa konto, telefon czyści dane', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { cloud: true });
  let deleted = false;
  await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.action !== 'deleteAccount') return route.fallback();
    deleted = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  page.on('dialog', d => d.accept());
  await page.goto('/users/');
  await page.locator('.nav button[data-v="set"]').click();
  await page.locator('[data-more="data"]').click();
  await page.locator('#delAcc').click();
  await expect(page.locator('#delAcc')).toHaveText(/Na pewno/);
  expect(deleted).toBe(false);
  await page.locator('#delAcc').click();
  await expect.poll(() => deleted).toBe(true);
  // po usunięciu strona się przeładowuje — odczyt w trakcie przeładowania próbujemy ponownie
  await expect.poll(() => page.evaluate(() => localStorage.getItem('zelazo_cloud')).catch(() => 'przeładowanie')).toBe(null);
  expect(errors).toEqual([]);
});

test('zgody: nowa wersja dokumentów pyta ponownie; wycofanie zgody na dane o zdrowiu wraca do okna zgód', async ({ page }) => {
  const errors = watch(page);
  await seed(page);
  await page.addInitScript(() => {
    const k = 'zelazo_v1', S = JSON.parse(localStorage.getItem(k) || '{}');
    if (S.profile && S.profile.consent && S.profile.consent.v === '2026-11-10' && !sessionStorage.getItem('old')) { S.profile.consent.v = '2025-01-01'; localStorage.setItem(k, JSON.stringify(S)); sessionStorage.setItem('old', '1'); }
  });
  await page.goto('/beta/');
  await expect(page.locator('#consentDialog')).toBeVisible();
  await page.locator('#csTerms').check(); await page.locator('#csHealth').check(); await page.locator('#csOk').click();
  await expect(page.locator('#consentDialog')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zelazo_v1') || '{}').profile.consent.v)).toBe('2026-11-10');
  await page.locator('.nav button[data-v="set"]').click();
  await page.locator('[data-more="legal"]').click();
  await expect(page.locator('#csStatus')).toContainText('Udzielona');
  await page.locator('#csWithdraw').click(); await page.locator('#csWithdraw').click();
  await expect(page.locator('#consentDialog')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zelazo_v1') || '{}').profile.consent.health)).toBe(null);
  expect(errors).toEqual([]);
});
