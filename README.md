# ProPlan — ŻELAZO

Aplikacja do śledzenia diety i treningu (plan 6-miesięczny) w jednym pliku HTML,
z opcjonalną synchronizacją między urządzeniami przez Google Apps Script.

| Plik | Co to jest |
|---|---|
| `index.html` | Aplikacja — otwórz w przeglądarce (telefon: dodaj do ekranu głównego). |
| `ZELAZO-AppsScript.gs` | Backend synchronizacji i szacowania kalorii (Google Apps Script). |
| `INSTRUKCJA-synchronizacja.md` | Jak wdrożyć skrypt i połączyć urządzenia. |

## Sekrety

Hasło synchronizacji (`SECRET`) i klucz Claude API (`CLAUDE_API_KEY`) ustawia się
**wyłącznie we Właściwościach skryptu** w Google Apps Script — nigdy w kodzie.
Kopie zapasowe danych (`*backup*.json`) są w `.gitignore` i nie trafiają do repozytorium.
