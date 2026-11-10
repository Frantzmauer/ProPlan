import { expect, test, type Page } from '@playwright/test';

// Wersja angielska: po kolei ekrany i okna — żaden widoczny tekst nie może zostać po polsku.
// Polski rozpoznajemy po literach z ogonkami i typowych słowach; wyjątki: nazwa „ŻELAZO”, przełącznik języka „Polski”.

const SERVER = 'https://serwer.test/exec';
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const ALL_ON = { coach: true, voice: true, form: true, estimate: true, photo: true, scanner: true, early: true };
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(nie|się|jest|dla|albo|tylko|dziś|tydzień|trening|posiłek|posiłki|serie|zapisz|dodaj|pokaż|wróć)\b/i;
const OK = /^(Polski|Polski · .*|Język · Language|Language · Język|Coach & AI · Trener i AI)$/;

async function seed(page: Page) {
  const state = { startDate: ago(30), kcalGoal: 2200, _settingsM: 1,
    profile: { name: 'Sam', weight: 80, height: 180, age: 35, sex: 'f', activity: 1.55, lang: 'en' },
    log: {}, weights: [{ d: ago(20), w: 82 }, { d: ago(10), w: 81 }, { d: ago(1), w: 80.4 }],
    measures: [{ d: ago(20), waist: 90, chest: 100, _t: 1 }, { d: ago(2), waist: 88, chest: 100, _t: 1 }],
    shop: {}, shopT: {}, reminders: { on: false } };
  const cloud = { url: SERVER, token: 'tok', account: 'sam', on: true, lastSync: Date.now(), lastError: '' };
  await page.addInitScript(([s, c]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('zelazo_v1', s); localStorage.setItem('zelazo_cloud', c);
    localStorage.setItem('zelazo_cycle', JSON.stringify({ on: true, sit: 'natural', coach: true, periods: [] }));
    sessionStorage.setItem('seeded', '1');
  }, [JSON.stringify(state), JSON.stringify(cloud)]);
  await page.route(SERVER, async route => {
    const quota = { m: ago(0).slice(0, 7), coach: { n: 3, max: 30 }, form: { n: 0, max: 10 }, est: { n: 0, max: 300, day: 20 } };
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, pong: true, admin: false, plan: 'premium', planName: 'Premium', enforced: true, features: ALL_ON, quota, data: null, usage: {} }) });
  });
}

/** Widoczne teksty po polsku (z kontekstem, żeby łatwo znaleźć miejsce). */
async function polish(page: Page): Promise<string[]> {
  const texts = await page.evaluate(() => {
    const out: string[] = [];
    const vis = (el: Element) => { const r = (el as HTMLElement).getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement, v = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!p || !v || p.closest('script,style,[data-no-i18n]') || !vis(p)) continue;
      out.push(v);
    }
    document.querySelectorAll('[placeholder],[aria-label]').forEach(el => { if (vis(el)) ['placeholder', 'aria-label'].forEach(a => { const v = el.getAttribute(a); if (v) out.push(v); }); });
    return out;
  });
  return [...new Set(texts)].filter(x => PL.test(x) && !OK.test(x));
}

test('wersja angielska: główne ekrany bez polskich tekstów', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seed(page);
  await page.goto('/beta/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const found: Record<string, string[]> = {};
  const check = async (name: string) => { const p = await polish(page); if (p.length) found[name] = p; };
  for (const v of ['diet', 'train', 'progress', 'shop', 'set']) {
    await page.locator(`.nav button[data-v="${v}"]`).click();
    await page.waitForTimeout(300);
    await check('tab:' + v);
  }
  for (const sec of ['cw', 'prof', 'rem', 'plan']) {
    await page.locator('.nav button[data-v="set"]').click();
    const b = page.locator(`[data-more="${sec}"]`);
    if (await b.isVisible()) { await b.click(); await page.waitForTimeout(200); await check('more:' + sec); }
  }
  await page.locator('.nav button[data-v="diet"]').click();
  await page.locator('#addMealBtn').click(); await check('dialog:meal'); await page.keyboard.press('Escape');
  await page.goto('/beta/'); await page.locator('#coachFab').click(); await page.waitForTimeout(300); await check('dialog:coach');
  expect(found).toEqual({});
  expect(errors).toEqual([]);
});

test('wersja angielska: okna treningu, cyklu i instruktażu bez polskich tekstów', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seed(page);
  await page.goto('/beta/');
  const found: Record<string, string[]> = {};
  const check = async (name: string) => { const p = await polish(page); if (p.length) found[name] = p; };
  const close = async () => { await page.keyboard.press('Escape'); await page.goto('/beta/'); };
  // instruktaż i historia ćwiczenia: pierwszy dzień z siłownią w tym tygodniu
  await page.locator('.nav button[data-v="train"]').click();
  for (let i = 0; i < 7 && !(await page.locator('[data-guide]').count()); i++) await page.locator('#nextDay').click();
  if (await page.locator('[data-guide]').count()) {
    await page.locator('[data-guide]').first().click(); await page.waitForTimeout(200); await check('guide'); await close();
  }
  // przerwy między seriami
  await page.locator('.nav button[data-v="set"]').click();
  const rest = page.locator('#moreMenu [data-rest-list]');
  if (await rest.isVisible()) { await rest.click(); await page.waitForTimeout(200); await check('rest'); await close(); }
  // cykl
  await page.locator('.nav button[data-v="set"]').click();
  const cy = page.locator('#mmCycleBtn');
  if (await cy.isVisible()) { await cy.click(); await page.waitForTimeout(200); await check('cycle'); await close(); }
  // tryb treningu z check-inem (gdy dziś jest siłownia)
  await page.locator('.nav button[data-v="train"]').click();
  const start = page.locator('[data-wo-start]');
  if (await start.count()) {
    await start.click(); await page.waitForTimeout(200); await check('checkin');
    for (const k of ['sleep', 'sore', 'energy']) await page.locator(`[data-cia="${k}:2"]`).click();
    await page.locator('#ciSheet [data-ciplan="normal"]').first().click();
    await page.locator('#woFocus').waitFor(); await page.waitForTimeout(300); await check('workout');
  }
  expect(found).toEqual({});
  expect(errors).toEqual([]);
});
