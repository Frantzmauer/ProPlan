// ŻELAZO — ESLint: tylko błędy, które psują działanie (niezadeklarowane zmienne, powtórzone klucze itp.).
// Moduły ES działają w trybie ścisłym — przypisanie do niezadeklarowanej zmiennej rzuca błąd w przeglądarce.
import globals from 'globals';

export default [
  {
    files: ['app/**/*.js'],
    ignores: ['app/sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-redeclare': 'error',
      'no-const-assign': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-unreachable': 'warn',
    },
  },
  {
    files: ['app/sw.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.serviceworker } },
    rules: { 'no-undef': 'error' },
  },
];
