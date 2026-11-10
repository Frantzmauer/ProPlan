import { expect, test } from '@playwright/test';

// Ekrany liczone z danych: kalorie z trendu wagi i prognoza cyklu. Dane wstawiane do pamięci telefonu przed startem.

const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };

test.beforeEach(async ({ page }) => {
  const weights = Array.from({ length: 13 }, (_, i) => ({ d: ago(24 - i * 2), w: +(72 - (i * 2) * 0.6 / 7).toFixed(2) }));
  const log: Record<string, unknown> = {};
  for (let i = 1; i <= 21; i++) log[ago(i)] = { meals: { m0: true, m1: true, m2: true, m3: true }, ex: {}, habits: {}, _m: 1 };
  const state = { startDate: ago(30), kcalGoal: 1800, profile: { name: 'Ola', weight: 72, height: 168, age: 32, sex: 'f', activity: 1.55 , consent: { v: '2026-11-10', terms: 1, health: 1 } },
    log, weights, measures: [], shop: {}, shopT: {}, reminders: { on: false }, _settingsM: 1 };
  const cycle = { on: true, sit: 'natural', coach: true, at: 1,
    periods: [{ s: ago(61), e: ago(57) }, { s: ago(32), e: ago(28) }, { s: ago(3), e: ago(0) }], sym: {} };
  await page.addInitScript(([s, c]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('zelazo_v1', s); localStorage.setItem('zelazo_cycle', c); sessionStorage.setItem('seeded', '1');
    }
  }, [JSON.stringify(state), JSON.stringify(cycle)]);
});

test('kalorie z trendu: wydatek i propozycja celu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="progress"]').click();
  const card = page.locator('#tdeeCard');
  await expect(card).toContainText('Wydatek z Twoich danych');
  await expect(card).toContainText('kcal — Twój wydatek');
  await expect(card.locator('#tdApply')).toBeVisible();
  await card.locator('#tdApply').click();
  await expect(card).toContainText('Cel zmieniony dziś');
  expect(errors).toEqual([]);
});

test('cykl: prognoza i dzień cyklu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="train"]').click();
  await expect(page.locator('#cyBox .cy-chip')).toContainText('dzień 4');
  await page.locator('.nav button[data-v="set"]').click();
  await page.locator('#moreMenu [data-cycle]').click();
  await expect(page.locator('.cy-fc')).toContainText('Następny okres: ok.');
  await expect(page.locator('.cy-fc')).toContainText('Średni cykl 29 dni');
  expect(errors).toEqual([]);
});
