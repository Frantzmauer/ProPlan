import { defineConfig, devices } from '@playwright/test';

// testy ekranów: zbudowane wersje (beta, users) z katalogu repozytorium, telefon 375 px
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    channel: process.env.PW_CHANNEL ?? 'chrome',   // zainstalowany Google Chrome; PW_CHANNEL=chromium → przeglądarka Playwright
    viewport: { width: 375, height: 812 },
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/beta/',
    reuseExistingServer: true,
  },
});
