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

## Wersje i jedno źródło

Kod aplikacji jest w `app/` i jest pakowany przez **Vite** (przygotowanie pod aplikację mobilną w Capacitor):

| Ścieżka | Co to jest |
|---|---|
| `app/index.html` | układ strony (miejsca `%%…%%` wypełnia `tools/build.py` dla każdej wersji) |
| `app/styles.css` | wygląd |
| `app/main.js` | główny moduł — dzielony stopniowo na moduły w `app/lib/` |
| `app/lib/*.ts` | wydzielone moduły w TypeScript (np. `dates.ts`); `*.js` czekają na przejście na TS |
| `app/sw.js` | praca bez internetu (kopiowany do każdej wersji bez zmian) |
| `tests/unit/` | testy logiki (Vitest) · `tests/e2e/` — testy ekranów (Playwright, telefon 375 px) |

Pliki wersji (`index.html`, `assets/`, `beta/`, `early/`, `users/`) **nie są edytowane ręcznie** — składa je `tools/build.py`.
`v1.0/` to zamrożona stara wersja.

```bash
npm install                 # raz, po pobraniu repozytorium
npm run dev                 # podgląd lokalny (jak beta) z automatycznym odświeżaniem
npm run check               # TypeScript + ESLint + testy logiki
npm run test:e2e            # testy ekranów (po python3 tools/build.py beta users)
```

| Wersja | Adres | Dla kogo |
|---|---|---|
| Beta | `/beta/` | właściciel i testerzy — najnowsze funkcje |
| USERS | `/users/` | konta, plany, panel admina, limity, płatności (wersja robocza) |
| Early Access | `/early/` | Premium — nowości po testach, przed stabilną |
| Stabilna | `/` | wszyscy — sprawdzone funkcje (po uruchomieniu USERS dla wszystkich zostanie ukryta) |

```bash
python3 tools/build.py beta users                  # nowa funkcja: beta + USERS z bieżącego app/
python3 tools/build.py stable early --from <ref>   # po testach: stabilna + Early Access z przetestowanego commita
python3 tools/build.py --check                     # czy wersje zgadzają się ze źródłem
```

O funkcjach i limitach decyduje serwer według **planu konta** (Darmowy, Premium, Tester) i wersji:
limity planu obowiązują w wersjach z `cfg.enforce` (na start USERS i Early Access), a `cfg.off`
wyłącza funkcję wszędzie (wyłącznik awaryjny). Plany i ustawienia są we Właściwościach skryptu
(`plans`, `cfg`), zmienia je administrator; bez nich działają wartości domyślne z `Kod.js`.

## Wdrażanie skryptu (clasp)

```bash
clasp push -f                                   # wyślij apps-script/ do projektu
clasp create-deployment -i <ID wdrożenia FitApp> -d "opis"   # nowa wersja, ten sam URL /exec
```

## Sekrety

Hasło synchronizacji (`SECRET`) i klucz Claude API (`CLAUDE_API_KEY`) ustawia się
**wyłącznie we Właściwościach skryptu** w Google Apps Script — nigdy w kodzie.
Kopie zapasowe danych (`*backup*.json`) są w `.gitignore` i nie trafiają do repozytorium.
