import { expect, test, type Page } from '@playwright/test';

// Przegląd ekranów po każdej zmianie: strona się ładuje bez błędów, zakładki działają,
// podstawowe akcje (posiłek, waga, okna) robią to, co powinny. Bez serwera (synchronizacja wyłączona).

// świeża aplikacja: najpierw okno zgód (Regulamin i Polityka + dane o zdrowiu)
async function consent(page: Page) {
  await expect(page.locator('#consentDialog')).toBeVisible();
  await expect(page.locator('#csOk')).toBeDisabled();
  await page.locator('#csTerms').check(); await page.locator('#csHealth').check();
  await page.locator('#csOk').click();
  await expect(page.locator('#consentDialog')).toBeHidden();
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

for (const [ver, tag] of [['beta', 'BETA'], ['users', 'USERS']] as const) {
  test.describe(ver, () => {
    test('ładuje się i przechodzi przez wszystkie zakładki', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/${ver}/`); await consent(page);
      await expect(page.locator('.beta-tag')).toHaveText(tag);
      for (const v of ['train', 'diet', 'progress', 'shop', 'set']) {
        await page.locator(`.nav button[data-v="${v}"]`).click();
        await expect(page.locator(`#v-${v}`)).toHaveClass(/\bon\b/);
      }
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(375);
      expect(errors).toEqual([]);
    });

    test('odhaczenie posiłku liczy się w dniu', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/${ver}/`); await consent(page);
      await page.locator('.nav button[data-v="diet"]').click();
      await expect(page.locator('#mealsProgress')).toContainText('0/');
      await page.locator('#mealsCard [data-meal="m0"]').first().click();
      await expect(page.locator('#mealsProgress')).toContainText('1/');
      await expect(page.locator('#mealsCard .mt-st').first()).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('zapis wagi pokazuje się w Postępie', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/${ver}/`); await consent(page);
      await page.locator('.nav button[data-v="progress"]').click();
      await page.locator('#weightInput').fill('82.4');
      await page.locator('#weightSave').click();
      await expect(page.locator('#wNow')).toHaveText('82.4');
      await expect(page.locator('#tdeeCard')).toContainText('Wydatek z Twoich danych');
      expect(errors).toEqual([]);
    });

    test('okna: dodaj posiłek i Trener otwierają się', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/${ver}/`); await consent(page);
      await page.locator('.nav button[data-v="diet"]').click();
      await page.locator('#addMealBtn').click();
      await expect(page.locator('#mealDialog')).toHaveClass(/show/);
      await expect(page.locator('#mdPhoto')).toBeVisible();
      await page.locator('#mdCancel').click();
      await page.locator('#coachFab').click();
      await expect(page.locator('#coachDialog')).toHaveClass(/show/);
      await expect(page.locator('#coachSetup')).toBeVisible();   // bez synchronizacji Trener prosi o jej włączenie
      expect(errors).toEqual([]);
    });
  });
}

test('bez zewnętrznych serwerów: czcionki, skaner i rozpoznawanie sylwetki z paczki aplikacji', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', r => { const h = new URL(r.url()).host; if (h && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(h)) outside.push(r.url()); });
  await page.goto('/beta/');
  await page.waitForLoadState('networkidle');
  const ok = await page.evaluate(async () => {
    const url = '/vendor/mediapipe/vision_bundle.mjs';
    const m = await import(/* @vite-ignore */ url);
    const fs = await m.FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
    const p = await m.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: '/vendor/mediapipe/pose_landmarker_lite.task', delegate: 'CPU' }, runningMode: 'IMAGE', numPoses: 1 });
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/vendor/zxing/index.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return !!p && typeof (window as any).ZXing === 'object';
  });
  expect(ok).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('700 20px "Barlow Condensed"'))).toBe(true);
  expect(outside).toEqual([]);
});
