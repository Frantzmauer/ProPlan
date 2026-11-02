# Stan projektu — 2 listopada 2026

## Wersje na dziś
| Wersja | Kod | Uwagi |
|---|---|---|
| Stabilna `/` | stary jednoplikowy kod (v1.2 + skaner kodów) | czeka na wydanie z nowego kodu |
| Early Access `/early/` | stary jednoplikowy kod (limity planu) | wydawana razem ze stabilną |
| Beta `/beta/` | nowy kod (Vite + TypeScript, moduły) | wszystkie funkcje poniżej |
| USERS `/users/` | nowy kod | jak beta + panel admina |
| Serwer (Apps Script) | wersja wdrożenia 32 | plany, limity, zdjęcie posiłku, godziny posiłków |

## Zrobione ostatnio (beta + USERS)
- Kalorie z trendu wagi (wydatek z danych, propozycja celu), historia celu kalorii.
- Cykl etap 2: prognoza okresu, wzorce z check-inów, dopasowanie check-inu.
- Nawyk zapisywania: godzina zjedzenia/zapisu, przypomnienia po zwykłej porze posiłku, domknięcie dnia, karta „Twoje nawyki”.
- Zdjęcie posiłku → AI (składniki, gramatury, kcal, makro); liczy się jako 1 szacowanie.
- Plany kont (Darmowy, Premium, Tester), funkcje, limity, wyłącznik awaryjny; panel admina w USERS.
- Porządki pod Capacitor: Vite, podział na 29 modułów, TypeScript, 57 testów logiki, 16 testów ekranów.

## Następne kroki (w tej kolejności)
1. **Właściciel testuje betę na telefonie** po porządkach (Vite, moduły, TypeScript).
2. **Wydanie stabilnej i Early Access** z przetestowanego commita:
   `python3 tools/build.py stable early --from <commit>` + notka „co nowego” (`APP_REL` w `core/shell.ts`) + tag i wydanie na GitHub.
3. **Aplikacja Android (Capacitor)** — potrzebne: Android Studio z Android SDK, Java (JDK 17+), konto Google Play Console (25 $).
   Klucz podpisu aplikacji przechowywać bezpiecznie poza repo (utrata = brak aktualizacji w Google Play).
   Przy okazji: powiadomienia lokalne (planowane na telefonie), później kroki z Google Fit / Apple Zdrowie.
4. Później: płatności (najpierw decyzja: sprzedaż przez stronę vs. w sklepach — prowizje 15–30% w sklepach),
   przeniesienie serwera z Apps Script do backendu z bazą danych, App Store.

## Znane ograniczenia
- Limity planów działają tylko w USERS i Early Access (`cfg.enforce`); w becie i stabilnej da się je obejść.
  Domyka to dopiero uruchomienie USERS dla wszystkich.
- Przypomnienia działają tylko przy otwartej aplikacji (bez serwerowych powiadomień push) — rozwiąże Capacitor.
- Kalorie z trendu: historia celu kalorii zaczyna się 1.11.2026; starsze dni liczą się z obecnym celem.

## Nowy Mac / nowe konto Claude — jednorazowo
```bash
gh auth login
git clone https://github.com/Frantzmauer/ProPlan.git && cd ProPlan && npm install
npm install -g @google/clasp && clasp login      # konto Google, do którego należy skrypt (scriptId w .clasp.json)
npm run check                                     # powinno przejść bez błędów
```
- Testy ekranów używają zainstalowanego Google Chrome (`PW_CHANNEL=chromium` → przeglądarka Playwright).
- Uprawnienia Claude Code ustaw w `~/.claude/settings.json` (np. pozwolenie bez pytania na `git status/diff/log/add/commit/push origin`,
  `clasp pull/push/create-deployment`, `npm run`, `python3 tools/build.py`; zabronione `git push --force`, `git reset --hard`).
- Token administratora (`SECRET`) i klucz Claude API są tylko we Właściwościach skryptu w Google — nie kopiuj ich do repo ani notatek.

## Prototypy
`docs/prototypes/*.html` — otwórz w przeglądarce (najlepiej w trybie telefonu, 375 px). Na starym koncie Claude
są też jako prywatne artefakty; na nowym koncie można je opublikować ponownie z tych plików.
