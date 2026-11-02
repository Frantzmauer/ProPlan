import { defineConfig } from 'vitest/config';

// testy logiki: czyste moduły z app/lib/ (bez przeglądarki)
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
