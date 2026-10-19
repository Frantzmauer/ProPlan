# ProPlan — ŻELAZO

Aplikacja do śledzenia diety i treningu (plan 6-miesięczny) w jednym pliku HTML,
z opcjonalną synchronizacją między urządzeniami przez Google Apps Script.

| Plik | Co to jest |
|---|---|
| `index.html` | Aplikacja — otwórz w przeglądarce (telefon: dodaj do ekranu głównego). |
| `apps-script/Kod.js` | Backend synchronizacji i szacowania kalorii (Google Apps Script). |
| `apps-script/appsscript.json` | Manifest projektu Apps Script (strefa czasowa, dostęp web app). |
| `.clasp.json` | Powiązanie z projektem Apps Script dla `clasp` (sam identyfikator, bez sekretów). |
| `INSTRUKCJA-synchronizacja.md` | Jak wdrożyć skrypt i połączyć urządzenia. |
| `icons/` | Logo (`logo-dark.png`, `logo-light.png`), ikony aplikacji i ekranu głównego (`icon.svg`, `icon-192/512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`). |
| `manifest.webmanifest` | Nazwa, kolory i ikony dla „Dodaj do ekranu głównego”. |

Aplikacja działa pod: https://frantzmauer.github.io/ProPlan/

## Wdrażanie skryptu (clasp)

```bash
clasp push -f                                   # wyślij apps-script/ do projektu
clasp create-deployment -i <ID wdrożenia FitApp> -d "opis"   # nowa wersja, ten sam URL /exec
```

## Sekrety

Hasło synchronizacji (`SECRET`) i klucz Claude API (`CLAUDE_API_KEY`) ustawia się
**wyłącznie we Właściwościach skryptu** w Google Apps Script — nigdy w kodzie.
Kopie zapasowe danych (`*backup*.json`) są w `.gitignore` i nie trafiają do repozytorium.
