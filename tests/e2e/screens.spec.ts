import { expect, test, type Page } from '@playwright/test';

// Ekrany z modułów screens/ i features/: tryb treningu z check-inem, Zamień, przerwy, Trener, panel admina, skaner.
// Serwer i Open Food Facts są podstawione.

const SERVER = 'https://serwer.test/exec';
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const ALL_ON = { coach: true, voice: true, form: true, estimate: true, photo: true, scanner: true, early: true };

async function seed(page: Page, { cloud = false, admin = false } = {}) {
  const state = { startDate: ago(7), kcalGoal: 2200, profile: { name: 'Test', weight: 80, height: 180, age: 35, sex: 'm', activity: 1.55 },
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
      : b.action === 'adminList' ? { ok: true, users: [{ account: 'anna', plan: '', lastSeen: Date.now(), usage: { coach: 27, form: 2, est: 40, usd: 2.1 } }],
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
