import { expect, test, type Page } from '@playwright/test';

// Więcej → Konto: logowanie kodem z e-maila (Supabase podstawione), połączenie konta z zaproszenia, konto bez zaproszenia.

const SERVER = 'https://serwer.test/exec';
const SB = 'https://jrospbidwuxqaaknepfh.supabase.co';
const today = new Date().toISOString().slice(0, 10);

async function seed(page: Page, cloud: Record<string, unknown> | null) {
  const state = { startDate: today, kcalGoal: 2200, profile: { name: 'Test', weight: 80, height: 180, age: 35, sex: 'm', activity: 1.55, consent: { v: '2026-11-10', terms: 1, health: 1 } },
    log: {}, weights: [], measures: [], shop: {}, shopT: {}, reminders: { on: false }, _settingsM: 1 };
  await page.addInitScript(([s, c]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('zelazo_v1', s); if (c) localStorage.setItem('zelazo_cloud', c); sessionStorage.setItem('seeded', '1');
  }, [JSON.stringify(state), cloud ? JSON.stringify(cloud) : '']);
}

// Supabase: kod wysłany, kod 123456 poprawny
async function fakeSupabase(page: Page) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  await page.route(SB + '/auth/v1/**', async route => {
    const url = route.request().url(), b = JSON.parse(route.request().postData() || '{}');
    if (url.endsWith('/otp')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (url.endsWith('/verify')) {
      if (b.token !== '123456') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error_code: 'otp_expired', msg: 'Token has expired or is invalid' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'h.p.s', refresh_token: 'r', expires_at: exp, user: { id: 'u-1', email: b.email, app_metadata: { provider: 'email' } } }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
}

async function signInWithCode(page: Page) {
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="set"]').click();
  await page.locator('#moreMenu [data-more="acc"]').click();
  await page.locator('#accEmailBtn').click();
  await page.locator('#sbEmail').fill('Ola@Example.com');
  await page.locator('#sbSend').click();
  await expect(page.locator('#sbEmailShow')).toHaveText('ola@example.com');
  await page.locator('#sbCode').fill('000000');
  await expect(page.locator('#sbMsg')).toContainText('nieprawidłowy');
  await page.locator('#sbCode').fill('123456');
}

test('konto z zaproszenia: logowanie kodem łączy je z e-mailem, dalej synchronizacja tokenem Supabase', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seed(page, { url: SERVER, token: 'tok', account: 'test', on: true, lastSync: 0, lastError: '' });
  await fakeSupabase(page);
  const bodies: any[] = [];
  await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}'); bodies.push(b);
    const res = b.action === 'sbLink' ? { ok: true, account: 'test', admin: false }
      : b.action === 'pull' || b.action === 'push' ? { ok: true, data: null }
      : { ok: true, pong: true, admin: false, account: 'test', plan: 'free', features: {} };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
  });
  await page.goto('/beta/');
  await page.locator('.nav button[data-v="set"]').click();
  await expect(page.locator('#mmAcc')).toHaveText('Połącz konto z Google albo e-mailem');
  await page.locator('#moreMenu [data-more="acc"]').click();
  await expect(page.locator('#accOutH')).toHaveText('Zabezpiecz konto „test”');
  await signInWithCode(page);
  await expect(page.locator('#accIn')).toBeVisible();
  await expect(page.locator('#accEmail')).toHaveText('ola@example.com');
  await expect(page.locator('#accName')).toHaveText('test');
  await expect(page.locator('#accMsg')).toContainText('Zalogowano');
  const link = bodies.find(b => b.action === 'sbLink');
  expect(link).toMatchObject({ token: 'tok', account: 'test', sb: 'h.p.s' });
  const cloud = await page.evaluate(() => JSON.parse(localStorage.getItem('zelazo_cloud') || '{}'));
  expect(cloud).toMatchObject({ sb: true, token: '', account: 'test', on: true });
  await expect.poll(() => bodies.filter(b => b.action === 'pull' && b.sb === 'h.p.s').length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('logowanie bez konta SixMo: komunikat i brak półzalogowanego stanu', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seed(page, null);
  await fakeSupabase(page);
  await page.route('https://script.google.com/**', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: false, unlinked: true, error: 'Ten adres e-mail nie ma jeszcze konta SixMo. Rejestracja ruszy wkrótce — do tego czasu konto zakłada się z linku zaproszenia.' }) }));
  await signInWithCode(page);
  await expect(page.locator('#accMsg')).toContainText('nie ma jeszcze konta SixMo');
  await expect(page.locator('#accOut')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sixmo_sb'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zelazo_cloud') || '{}').sb)).toBeFalsy();
  expect(errors).toEqual([]);
});

test('link z e-maila wraca do aplikacji z tokenami: logowanie kończy się samo, tokeny znikają z adresu', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seed(page, { url: SERVER, token: 'tok', account: 'test', on: true, lastSync: 0, lastError: '' });
  await page.route(SB + '/auth/v1/user', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'u-1', email: 'ola@example.com', app_metadata: { provider: 'email' } }) }));
  await page.route(SERVER, async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    const res = b.action === 'sbLink' ? { ok: true, account: 'test' } : b.action === 'pull' || b.action === 'push' ? { ok: true, data: null } : { ok: true, pong: true, account: 'test' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
  });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  await page.goto(`/beta/#access_token=h.p.s&expires_at=${exp}&expires_in=3600&refresh_token=r&token_type=bearer&type=magiclink`);
  await expect(page.locator('#accIn')).toBeVisible();
  await expect(page.locator('#accEmail')).toHaveText('ola@example.com');
  expect(page.url()).not.toContain('access_token');
  expect(errors).toEqual([]);
});
