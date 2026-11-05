// ŻELAZO — Vite: źródło w app/, wynik w dist/ (jeden pakiet bez wersji).
// tools/build.py rozkłada dist/ na wersje (stabilna, beta, early, users) i wypełnia ich miejsca w index.html.
import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

// Adres zastępczy: Vite nie próbuje dołączać plików spod pełnego adresu, więc ikony i manifest zostają
// poza pakietem (każda wersja ma do nich inną ścieżkę). build.py podmienia go na ścieżkę wersji.
export const SLOT = 'https://zelazo.invalid/';
const TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.gz': 'application/gzip' };

function channelSlots() {
  let serve = false;
  return {
    name: 'zelazo-channel-slots',
    configResolved(c) { serve = c.command === 'serve'; },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (serve) {   // podgląd lokalny = beta
          return html.replaceAll('%%ICONS%%', '/icons/').replaceAll('%%APPLE_TITLE%%', 'ŻELAZO β').replaceAll('%%TAG%%', 'BETA');
        }
        return html.replaceAll('%%ICONS%%', SLOT + 'icons/').replaceAll('href="manifest.webmanifest"', `href="${SLOT}manifest.webmanifest"`);
      },
    },
    // podgląd lokalny: ikony z icons/ i modele sylwetki z models/ w repozytorium
    configureServer(server) {
      for (const dir of ['icons', 'models']) server.middlewares.use('/' + dir + '/', async (req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
        if (!/^[\w.-]+$/.test(name)) return next();
        try {
          const body = await readFile(resolve(__dirname, dir, name));
          res.setHeader('Content-Type', TYPES[extname(name)] || 'application/octet-stream');
          res.end(body);
        } catch { next(); }
      });
    },
  };
}

export default defineConfig({
  root: 'app',
  base: './',
  publicDir: false,
  plugins: [channelSlots()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
  server: { port: 5173 },
});
