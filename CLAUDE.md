# ŻELAZO (repo ProPlan) — zasady pracy dla Claude Code

Aplikacja do treningu i diety (plan 24 tygodnie) z Trenerem AI. Web (PWA na GitHub Pages) → docelowo
aplikacja w **Google Play**, potem w **App Store** (Capacitor, ten sam kod). Właściciel pisze po polsku;
odpowiadaj po polsku. Aktualny stan i kolejne kroki: `docs/STAN.md`.

## Komendy właściciela
- **„code bravo”** → przeczytaj `docs/CODE-BRAVO.md` i wykonaj go: własna domena, prywatne repozytorium, hosting w
  Cloudflare Pages, przeprowadzka użytkowników ze starego adresu. Najpierw sprawdź warunki z części A (domena kupiona i aktywna
  w Cloudflare). Do tego czasu **nie zmieniaj widoczności repozytorium ani hostingu** — zmiana repo na prywatne na darmowym planie
  wyłącza GitHub Pages i aplikacja przestaje działać.

## Zasady ustalone z właścicielem
- **Najpierw prototyp**, gdy właściciel o to prosi (zwykle przy nowym ekranie): klikalny plik HTML w stylu
  aplikacji, szerokość telefonu 375 px, przykładowe dane. Gotowe prototypy: `docs/prototypes/`.
- **Przepływ funkcji:** nowa funkcja → **beta + USERS**; po testach właściciela → **stabilna + Early Access**
  (budowane z przetestowanego commita). Do stabilnej nie trafia nic nieprzetestowanego.
- **Nowe funkcje są wstrzymane**, dopóki trwa przygotowanie pod Capacitor — tylko poprawki (zobacz `docs/STAN.md`).
- Teksty w aplikacji po polsku, **neutralne płciowo** („Limit wykorzystany”, nie „Wykorzystałeś”).
  Komentarze w kodzie po polsku, opisy commitów po angielsku.
- Po każdej zmianie: testy (niżej), sprawdzenie w przeglądarce na 375 px, wdrożenie, krótka informacja dla właściciela.
- Sekrety (`SECRET`, `CLAUDE_API_KEY`) są **tylko** we Właściwościach skryptu w Google Apps Script.
  Nigdy w kodzie, repo ani w plikach `.env` w repo. Wywołania AI tylko przez serwer, nigdy z przeglądarki.

## Struktura
- `app/` — źródło (Vite + TypeScript). `app/main.ts` uruchamia moduły; ekrany w `app/screens/`, funkcje w
  `app/features/`, stan i synchronizacja w `app/core/`, obliczenia bez ekranu w `app/lib/` (z testami).
  Moduły tylko deklarują; kod startowy jest w `__init_N` wywoływanych przez `main.ts` w stałej kolejności.
  Zmienną innego modułu zmienia się jego funkcją `__set_nazwa(...)`.
- `index.html` + `assets/`, `beta/`, `early/`, `users/` — **zbudowane wersje, nie edytuj ręcznie**
  (składa je `tools/build.py`). `v1.0/` — zamrożona stara wersja.
- `apps-script/Kod.js` — serwer (Google Apps Script): konta, synchronizacja, Trener AI (Claude), plany i limity.
  Zasady scalania danych są w dwóch miejscach: `app/lib/merge.js` i `mergeState` w `Kod.js` — zmieniaj oba.
- `tests/unit/` (Vitest) i `tests/e2e/` (Playwright, telefon 375 px, zainstalowany Google Chrome).

## Wersje
| Wersja | Adres | Dla kogo |
|---|---|---|
| Beta | `/beta/` | właściciel i testerzy |
| USERS | `/users/` | konta, plany, panel admina, limity, płatności (wersja robocza) |
| Early Access | `/early/` | Premium — nowości po testach |
| Stabilna | `/` | wszyscy (po uruchomieniu USERS dla wszystkich zostanie ukryta) |

Funkcje i limity zależą od **planu konta** na serwerze (`plans`, `cfg` we Właściwościach skryptu):
limity planu działają w wersjach z `cfg.enforce` (dziś USERS i Early Access), `cfg.off` wyłącza funkcję wszędzie.

## Polecenia
```bash
npm install                                        # raz po sklonowaniu
npm run dev                                        # podgląd lokalny (jak beta)
npm run check                                      # typy (ścisłe dla app/lib i testów) + ESLint + testy logiki
python3 tools/build.py beta users                  # zbuduj betę i USERS z bieżącego app/
python3 tools/build.py stable early --from <ref>   # wydanie: stabilna + Early Access z przetestowanego commita
python3 -m http.server 4173 --bind 127.0.0.1 &     # serwer dla testów ekranów (z katalogu repo)
npm run test:e2e                                   # testy ekranów
```
Wdrożenie stron: commit i `git push origin main` → GitHub Pages (ok. 1 min). Sprawdź, że plik z `assets/` odpowiada 200.

Wdrożenie serwera (Apps Script):
```bash
clasp pull            # najpierw sprawdź, że kod w Google = apps-script/Kod.js z main (porównaj w katalogu tymczasowym)
clasp push -f
clasp deployments     # znajdź wdrożenie „FitApp” (adres /exec używa aplikacja — musi zostać ten sam)
clasp create-deployment -i <ID wdrożenia FitApp> -d "FitApp"
```
Zawsze nowa wersja tego samego wdrożenia (`-i`), nigdy nowe wdrożenie — inaczej zmieni się adres serwera w aplikacjach.

## Typy
- `tsconfig.strict.json` — tryb ścisły: `app/lib/`, testy. Nowy kod obliczeń pisz tam, z testami.
- `tsconfig.json` — ekrany i funkcje bez trybu ścisłego; `app/types/dom-loose.d.ts` tymczasowo luzuje typy
  elementów strony. Przy większych zmianach w module dawaj mu pełne typy i przenoś do trybu ścisłego.
