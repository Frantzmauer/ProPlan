# CODE BRAVO — własna domena, prywatne repozytorium, hosting w Cloudflare

**Zaparkowane 4 listopada 2026.** Uruchamia je właściciel, pisząc **„code bravo”**. Wtedy Claude czyta ten plik,
sprawdza warunki z części A i wykonuje część B krok po kroku, informując o postępie. Nic z tego nie dzieje się wcześniej.

Cel: aplikacja pod **własną domeną**, kod w **prywatnym** repozytorium, strona hostowana w **Cloudflare Pages**
(darmowo, bez własnego serwera), a obecni użytkownicy przechodzą na nowy adres bez utraty danych.
To krok 1 drogi do płatnego produktu (kolejne kroki — na końcu pliku).

---

## A. Co właściciel robi przed „code bravo”

1. **Sprawdza nazwę** „ŻELAZO” w bazach znaków towarowych (UPRP: https://ewyszukiwarka.pue.uprp.gov.pl,
   EUIPO: https://euipo.europa.eu/eSearch) w klasach 9 (aplikacje), 41 (treningi) i 44 (dieta). Przy kolizji — najpierw zmiana nazwy.
2. **Kupuje domenę.** Domeny `.pl` nie da się kupić w Cloudflare — kup u polskiego rejestratora (np. OVH, nazwa.pl, home.pl, Cyber_Folks).
   Dobrze mieć też `.com` albo `.app`, jeśli wolne (ochrona marki). Zapisz: nazwę domeny i rejestratora.
3. **Zakłada darmowe konto Cloudflare** (https://dash.cloudflare.com/sign-up), najlepiej na adres projektu, nie prywatny.
   Włącza logowanie dwuskładnikowe.
4. **Dodaje domenę do Cloudflare** (Add a domain → plan Free) i u rejestratora **zmienia serwery DNS** na te dwa,
   które pokaże Cloudflare. Propagacja trwa od kilku minut do 24 h — Cloudflare wyśle e-mail, gdy domena będzie aktywna.
5. **Decyduje o adresie aplikacji.** Rekomendacja: aplikacja na **`app.<domena>`**, a sama `<domena>` zostaje na przyszłą
   stronę z ofertą i cennikiem (i polityką prywatności wymaganą przez Google Play).
6. Pisze **„code bravo”** i podaje: domenę, wybrany adres aplikacji (np. `app.zelazo.pl`) i nazwę konta Cloudflare.

Claude nie kupuje domeny, nie zakłada kont i nie wpisuje haseł — to robi właściciel. Logowanie narzędzia Cloudflare
(`wrangler login`) otwiera przeglądarkę i właściciel sam zatwierdza dostęp.

---

## B. Co robi Claude po „code bravo”

### B1. Sprawdzenie warunków
- Domena aktywna w Cloudflare (`dig NS <domena>` pokazuje serwery Cloudflare).
- `npm run check` i testy ekranów przechodzą na `main`; brak niezapisanych zmian.
- Ustalenie z właścicielem: czy przed przeprowadzką wydać stabilną z obecnej bety (zalecane: tak, żeby na nowy adres
  trafiła jedna, przetestowana wersja — patrz `docs/STAN.md`, krok „Wydanie stabilnej”).

### B2. Budowanie do katalogu strony zamiast do repozytorium
Dziś `tools/build.py` zapisuje zbudowane wersje do repozytorium (`index.html`, `assets/`, `beta/`, `early/`, `users/`),
bo GitHub Pages serwuje pliki z repo. Po zmianie:
- `tools/build.py` buduje wszystko do **`site/`** (ignorowane przez git): `site/index.html` + `site/assets/` (stabilna),
  `site/beta/`, `site/early/`, `site/users/`, `site/v1.0/`, `site/icons/`.
- Opcja `--from <commit>` dla stabilnej i Early Access zostaje (wydanie z przetestowanego stanu). Ponieważ `site/` składa
  się z wersji z różnych commitów, build trzyma ostatnio wydane stabilną/Early Access w `site/` i podmienia tylko budowane wersje
  (albo zapamiętuje commit wydania w `releases.json` i odtwarza je przy każdym budowaniu — wybrać prostsze).
- Zbudowane pliki usuwane z repozytorium (`git rm` wersji w katalogu głównym, `beta/`, `early/`, `users/`), `site/` w `.gitignore`.
- `site/_headers` (Cloudflare): `sw.js` i `index.html` bez cache (`Cache-Control: no-cache`), `assets/*` na rok
  (`immutable`, nazwy mają hash), nagłówki bezpieczeństwa: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (kamera i mikrofon tylko dla tej strony). CSP — najpierw w trybie raportowania (`Content-Security-Policy-Report-Only`),
  bo strona ładuje czcionki Google, ZXing i MediaPipe z CDN oraz łączy się z Apps Script i Open Food Facts.

### B3. Cloudflare Pages
- `npx wrangler login` (właściciel zatwierdza w przeglądarce; token zostaje w konfiguracji wranglera na Macu, nie w repo).
- Projekt Pages „zelazo”: `npx wrangler pages project create zelazo --production-branch main`.
- Wdrożenie: `npx wrangler pages deploy site --project-name zelazo` → dostajemy adres `zelazo.pages.dev`; testy ekranów przeciw niemu.
- Własna domena: w panelu Pages → Custom domains → `app.<domena>` (HTTPS automatycznie).
- Do `package.json`: `npm run deploy` = build + `wrangler pages deploy`. Wdrażanie bezpośrednie (bez podpinania GitHuba do Cloudflare) —
  prywatne repo nie musi być widoczne dla Cloudflare. Później można dodać GitHub Actions z tokenem API Cloudflare w sekretach repozytorium.

### B4. Przeprowadzka użytkowników ze starego adresu (najważniejsze)
**Uwaga:** dane w przeglądarce (`localStorage`) są przypisane do adresu. Na nowej domenie aplikacja startuje pusta.
Z serwera wrócą dane synchronizowane, ale **nie** wrócą: połączenie z serwerem (adres, konto, token — `zelazo_cloud`),
dane o cyklu trzymane tylko na telefonie (`zelazo_cycle`, domyślnie lokalne), trwający trening, ustawienia per urządzenie.
Dlatego stary adres nie może po prostu przekierować — musi **przekazać** te dane:
- Stara strona (ostatnie wydanie na `frantzmauer.github.io/ProPlan/`) dostaje ekran „Aplikacja ma nowy adres”: przycisk
  **„Przenieś się”** pakuje `zelazo_cloud`, `zelazo_cycle` (jeśli lokalne), `zelazo_v1` (na wypadek braku synchronizacji)
  i przekazuje je w **fragmencie adresu** (`https://app.<domena>/#move=<dane>` — fragment nie trafia do żadnego serwera).
- Nowa aplikacja przy starcie odczytuje `#move=`, scala dane (`mergeState`, nic nie nadpisuje), zapisuje, natychmiast czyści
  adres (`history.replaceState`) i pokazuje „Przeniesiono — zainstaluj aplikację z nowego adresu”.
- Linki zaproszeń (`#invite=…`) ze starego adresu przekierowują z zachowaniem fragmentu.
- Na starym adresie nowy `sw.js` (kill switch): czyści swoje pamięci podręczne i wyrejestrowuje się, żeby stara kopia offline
  nie działała w nieskończoność.
- Dla każdej wersji osobno: `/`, `/beta/`, `/early/`, `/users/` → odpowiedni adres na nowej domenie.
- Instrukcja dla użytkowników (komunikat w aplikacji + wiadomość od właściciela): usuń starą ikonę z ekranu głównego,
  otwórz nowy adres, „Dodaj do ekranu głównego”.
- Stary adres utrzymujemy z przekierowaniem co najmniej 3–6 miesięcy.

### B5. Prywatne repozytorium
- Obecne repo `Frantzmauer/ProPlan` → zmiana nazwy na **`Frantzmauer/zelazo`** i **prywatne** (`gh repo rename`, `gh repo edit --visibility private`).
  Uwaga: zmiana na prywatne na darmowym planie wyłącza GitHub Pages w tym repo — dlatego najpierw B3 i B4.
- Nowe, publiczne repo **`Frantzmauer/ProPlan`** zawiera **wyłącznie** strony przeprowadzki z B4 (bez kodu źródłowego,
  serwera, dokumentacji i prototypów) i ma włączone GitHub Pages — stary adres działa dalej.
- Lokalnie: `git remote set-url origin` na nowe repo; aktualizacja `CLAUDE.md`, `README.md`, `docs/STAN.md` (polecenia wdrożenia).
- Sprawdzić historię repo pod kątem sekretów przed czymkolwiek publicznym (nowe publiczne repo startuje od zera, bez historii).

### B6. Drobne poprawki przy okazji
- `inviteLink` (`app/screens/accounts.ts`) usuwa z adresu tylko `beta/`/`zeta/` — zaproszenie wysłane z USERS albo Early Access
  prowadzi do tej wersji zamiast do stabilnej. Poprawić na wszystkie wersje.
- Manifesty: `id` aplikacji na nowej domenie (instalacja z nowego adresu = nowa aplikacja na telefonie — to oczekiwane).
- **Supabase i Google OAuth** (konfiguracja z 13 listopada 2026 wskazuje jeszcze na `github.io`):
  - Supabase → Authentication → URL Configuration: Site URL na `https://app.sixmo.app` (Redirect URLs dla `sixmo.app` już są).
  - Google Auth Platform → Branding: strona główna `https://sixmo.app/`, polityka `https://sixmo.app/legal/polityka-prywatnosci.html`,
    regulamin `https://sixmo.app/legal/regulamin.html`; własność `sixmo.app` potwierdzona w Google Search Console (rekord TXT w DNS).
  - Clients → Authorized JavaScript origins: `https://app.sixmo.app`. Potem Audience: Testing → **Publish**.
  Ustawienia w panelach zmienia właściciel; Claude podaje dokładne wartości.

### B7. Sprawdzenie i raport
- Nowy adres: wszystkie wersje się ładują (375 px), logowanie z linku zaproszenia, synchronizacja z serwerem, Trener, skaner.
- Stary adres: przekierowanie z przekazaniem danych na prawdziwym telefonie właściciela (Android i, jeśli jest, iPhone).
- Repo `zelazo` prywatne, `ProPlan` zawiera tylko strony przeprowadzki.
- Raport dla właściciela: co działa, co sprawdzić na telefonie, tekst wiadomości do użytkowników o nowym adresie.

---

## C. Kolejne kroki po CODE BRAVO (osobne decyzje, nie część „code bravo”)
1. **Nowy serwer: Supabase (region UE, Frankfurt)** zamiast Google Apps Script + plików na Dysku: prawdziwe konta (e-mail, Google),
   dane w bazie z zabezpieczeniami per użytkownik (dane zdrowotne — RODO art. 9), Trener AI przez funkcję serwerową,
   przeniesienie danych obecnych kont, usuwanie konta (wymóg Google Play). Wymienia się tylko `app/lib/api.ts`, `app/lib/sync.ts` i serwer.
2. **Aplikacja Android (Capacitor)**: Android Studio + JDK 17+, konto Google Play Console (25 $), klucz podpisu poza repo,
   powiadomienia lokalne i push (FCM), testy wewnętrzne w Google Play.
3. **Płatności**: Google Play Billing w aplikacji (wymóg Google dla subskrypcji cyfrowych, prowizja 15%), Stripe na stronie
   (karty, BLIK), RevenueCat do połączenia obu; plan konta na serwerze bierze się z płatności.
4. **Formalności przed sprzedażą**: działalność, faktury i VAT (OSS dla klientów z UE), regulamin, polityka prywatności,
   zgoda na dane zdrowotne, umowy powierzenia (Anthropic, Supabase, Google), deklaracja aplikacji zdrowotnej w Google Play,
   brak obietnic medycznych. Zalecana konsultacja z prawnikiem/księgowym.
5. **App Store** po stabilnym Androidzie.

Szacowane koszty miesięczne na start: domena ~5–8 zł, Cloudflare Pages 0 zł, Supabase 0 zł (później ~25 $), RevenueCat 0 zł;
jednorazowo Google Play 25 $; do tego prowizje od płatności i rachunek za Claude API.
