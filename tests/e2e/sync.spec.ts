import { expect, test } from '@playwright/test';

// Synchronizacja w prawdziwej aplikacji z podstawionym serwerem: pobranie przy starcie scala dane z serwera,
// a zmiana na telefonie wysyła się sama ok. 2 s później (z wersją aplikacji i nazwą konta).

const SERVER = 'https://serwer.test/exec';
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

test('pobranie przy starcie i wysyłka po zmianie', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const today = iso(new Date());
  const sent: Record<string, unknown>[] = [];
  await page.route(SERVER, async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    sent.push(body);
    const data = { log: {}, weights: [{ d: today, w: 77.7 }], measures: [], shop: {}, _settingsM: 0 };
    const res = body.action === 'ping' ? { ok: true, pong: true, admin: false }
      : body.action === 'pull' || body.action === 'push' ? { ok: true, data } : { ok: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
  });
  await page.addInitScript(cfg => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem('zelazo_cloud', cfg); sessionStorage.setItem('seeded', '1'); }
  }, JSON.stringify({ url: SERVER, token: 'tok', account: 'Ola', on: true, lastSync: 0, lastError: '' }));

  await page.goto('/beta/');
  // waga z serwera trafia do telefonu
  await page.locator('.nav button[data-v="progress"]').click();
  await expect(page.locator('#wNow')).toHaveText('77.7');
  expect(sent.find(b => b.action === 'pull')).toMatchObject({ account: 'ola', token: 'tok', channel: 'beta' });

  // odhaczenie posiłku → wysyłka z tym posiłkiem
  await page.locator('.nav button[data-v="diet"]').click();
  await page.locator('#mealsCard [data-meal="m0"]').first().click();
  await expect.poll(() => sent.filter(b => b.action === 'push').length, { timeout: 6000 }).toBeGreaterThan(0);
  const push = sent.filter(b => b.action === 'push').pop() as { data: { log: Record<string, { meals: Record<string, boolean> }> } };
  expect(push.data.log[today].meals.m0).toBe(true);
  expect(errors).toEqual([]);
});
