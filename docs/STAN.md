# Stan projektu — 5 listopada 2026

## Wersje na dziś
| Wersja | Kod | Uwagi |
|---|---|---|
| Stabilna `/` | v1.5 (Vite + TypeScript, moduły) | wszystkie funkcje poniżej |
| Early Access `/early/` | v1.5 | wydawana razem ze stabilną; limity planu (`cfg.enforce`) |
| Beta `/beta/` | ten sam kod co v1.5 | tu trafiają nowe zmiany przed testem |
| USERS `/users/` | ten sam kod co v1.5 | jak beta + panel admina (konta, plany, język konta) |
| Serwer (Apps Script) | wdrożenie FitApp @38 | Trener: Claude Opus 5.5, proste pytania Claude Sonnet 5.5 |

Wydania na GitHubie: v1.3 (przejście stabilnej na nowy kod), v1.4, v1.5 — opisy zmian w Releases.

## Zrobione ostatnio
**v1.5**
- **Sylwetka 3D** (Postęp → „Pokaż sylwetkę 3D”): model MakeHuman (CC0) dopasowany do wzrostu i obwodów, płeć z profilu;
  Teraz / Start / Porównaj (start na niebiesko tam, gdzie ubyło), suwak pomiarów, zmiany w cm. Bez pomiaru obwodów na
  starcie — szacunek z wagi (oznaczony). Spodenki i sportowy top (model „ubrany” pod sklepy).
  Model budowany przez `tools/body_model.py` → `models/body-{male,female}.zbm`; obwody mierzone pierścieniami wierzchołków,
  dopasowanie w `app/lib/body.ts` (siatka trzyma pomiary w granicach ~1,5 cm). three.js 0.170.0 ładowany tylko z sylwetką.
- **Język konta** (Więcej → Profil i plan → Język · Language): Trener, ocena techniki i szacowanie AI po polsku albo
  po angielsku; administrator ustawia język konta w panelu. Reszta aplikacji jest jeszcze po polsku (etap 2 niżej).
- **Trener taniej:** kontekst w dwóch częściach (stała + bieżąca) z osobną pamięcią podręczną, zwięzły dziennik jedzenia
  (szczegóły tylko 4 ostatnie dni), historia rozmowy 8 wiadomości (starsze odpowiedzi skrócone), `max_tokens` 4000.
  Zużycie AI pokazuje udział tokenów z pamięci podręcznej. Pomiar przed zmianami: ~9 c za pytanie (głównie wejście).

**v1.4**
- **Dzień diety zaliczony:** kcal 85–110% celu z tego dnia i białko ≥ 80% celu (`app/lib/dietday.ts`), z planu czy własne;
  serie i kalendarz liczone wstecz. Karta „Dzień diety” pod makrami z podpowiedzią.
- **„Zamień”** przy posiłku z planu i **„Zastępuje”** w „Dodaj posiłek”. Obwody: historia z „Edytuj”.
- **Trener widzi dziennik jedzenia** (sumy jak w Diecie, godziny, zastąpione/pominięte) i opis ekranów aplikacji;
  może zaproponować poprawkę obwodu. Rozmowa: 100 wiadomości dla administratora, 40 dla reszty.

**v1.3**: stabilna i Early Access na nowym kodzie (kalorie z trendu wagi, zdjęcie posiłku → AI, godziny posiłków,
cykl etap 2, praca bez internetu).

## Następne kroki (w tej kolejności)
1. **Aplikacja Android (Capacitor)** — potrzebne: Android Studio z Android SDK, Java (JDK 17+), konto Google Play
   Console (25 $, zakłada właściciel). Klucz podpisu aplikacji przechowywać bezpiecznie poza repo (utrata = brak
   aktualizacji w Google Play). Najpierw sprawdzić, czy Android Studio działa na tym laptopie (Intel, macOS 12) —
   jeśli nie: starsza zgodna wersja albo budowanie w chmurze (GitHub Actions).
   Przy okazji: powiadomienia lokalne (przypomnienia przy zamkniętej aplikacji), później kroki z Health Connect.
2. **Język etap 2 — cała aplikacja po angielsku:** teksty do słownika pl/en (`t('klucz')`, test pilnujący braków),
   plan (ćwiczenia, opisy techniki, jadłospis, zakupy), daty, komunikaty serwera. Przed wpisem do Google Play
   albo razem z nim; tłumaczenia przejrzy osoba anglojęzyczna.
3. Później: płatności (najpierw decyzja: sprzedaż przez stronę vs. w sklepach — prowizje 15–30% w sklepach),
   przeniesienie serwera z Apps Script do backendu z bazą danych, App Store.

Drobne, do rozważenia: wygładzenie brzegu spodenek w sylwetce 3D; etykieta „jutro / za 2 dni / wczoraj” przy oglądaniu
innego dnia; po kilku dniach sprawdzić w „Zużycie AI”, czy koszt pytania do Trenera spadł (oczekiwane ~4–5 c).

**Zaparkowane — „code bravo”:** własna domena, prywatne repozytorium, Cloudflare Pages i przeprowadzka użytkowników
ze starego adresu. Czeka na zakup domeny przez właściciela. Pełny opis: `docs/CODE-BRAVO.md`.

## Znane ograniczenia
- Limity planów działają tylko w USERS i Early Access (`cfg.enforce`); w becie i stabilnej da się je obejść.
  Domyka to dopiero uruchomienie USERS dla wszystkich.
- Przypomnienia działają tylko przy otwartej aplikacji (bez serwerowych powiadomień push) — rozwiąże Capacitor.
- Kalorie z trendu: historia celu kalorii zaczyna się 1.11.2026; starsze dni liczą się z obecnym celem.
- Sylwetka 3D jest przybliżona (pokazuje kierunek zmian); ramię mierzone „napięte” porównujemy z ramieniem modelu w spoczynku.
- Pamięć podręczna Trenera jest osobna dla każdego modelu — przeplatanie prostych i złożonych pytań zapisuje kontekst dwa razy.

## Wdrożenia — jak to robić
- Strony: commit i `git push origin main` → GitHub Pages (ok. 1 min); sprawdź, że nowy plik z `assets/` odpowiada 200.
  Pliki modelu mają końcówkę `.zbm`, nie `.gz` — z plikami `.gz` publikacja GitHub Pages przekraczała limit czasu.
  Przy większych commitach (modele, three.js) git potrzebuje `git config http.postBuffer 157286400` (ustawione w tym repo).
- Serwer: `clasp push -f`, potem `clasp create-deployment -i <ID FitApp> -d "FitApp"` — każde jako **osobne, proste
  polecenie** z katalogu repo (złożone `cd … && …` nie pasują do reguł uprawnień i tryb automatyczny je blokuje).
  Właściciel zgodził się na oba bez pytania. Serwer wdrażaj **przed** zmianą aplikacji, która go potrzebuje.

## Nowy Mac / nowe konto Claude — jednorazowo
```bash
gh auth login
git clone https://github.com/Frantzmauer/ProPlan.git && cd ProPlan && npm install
npm install -g @google/clasp && clasp login      # konto Google, do którego należy skrypt (scriptId w .clasp.json)
npm run check                                     # powinno przejść bez błędów
```
- Laptop z procesorem Intel (macOS 12): Homebrew nie działa; Node 22 LTS i `gh` instalujemy do `~/.local`
  (Node 24 wymaga macOS 13.5+). Jeśli logowanie `gh` zrywa się błędem sieci: `GODEBUG=http2client=0 gh auth login --web`.
- clasp musi być zalogowany kontem Google, do którego należy skrypt (inne konto: „The caller does not have permission”).
- Testy ekranów używają zainstalowanego Google Chrome (`PW_CHANNEL=chromium` → przeglądarka Playwright).
- Uprawnienia Claude Code w `~/.claude/settings.json`: bez pytania `git status/diff/log/add/commit/push origin`,
  `gh release create/view`, `clasp pull/push`, `clasp create-deployment -i <ID FitApp>`, `npm run`,
  `python3 tools/build.py`, `node --check`; zabronione `git push --force`/`-f` i `git reset --hard`.
- Token administratora (`SECRET`) i klucz Claude API są tylko we Właściwościach skryptu w Google — nie kopiuj ich do repo ani notatek.

## Prototypy
`docs/prototypes/*.html` — otwórz w przeglądarce (najlepiej w trybie telefonu, 375 px). Na starym koncie Claude
są też jako prywatne artefakty; na nowym koncie można je opublikować ponownie z tych plików.
