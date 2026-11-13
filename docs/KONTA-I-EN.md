# Konta, logowanie, strona startowa i wersja angielska — plan

Ustalone z właścicielem 10 listopada 2026.

## Decyzje
- **Logowanie:** „Kontynuuj z Google” albo **kod z e-maila** (6 cyfr, ważny 10 min), **bez haseł**. Kod tylko na nowym
  urządzeniu — potem sesja odnawia się sama (krótki token dostępu + token odświeżania). Kilka urządzeń naraz.
- **Usługa kont:** **Supabase Auth, region UE (Frankfurt).** Nie piszemy własnego logowania ani przechowywania sekretów.
  Apps Script zostaje (na razie) dla Trenera AI, synchronizacji i limitów — sprawdza token Supabase zamiast obecnego tokenu konta.
- **Adresy:** `sixmo.app` — strona startowa, cennik, polityka prywatności, regulamin; `app.sixmo.app` — aplikacja.
  Wymaga „code bravo” (Cloudflare Pages), uruchamianego przez właściciela.
- **Język:** wykrywany z telefonu (polski → PL, inny → EN), wybór przy pierwszym uruchomieniu i w Koncie, zapisany w koncie
  (Trener, e-maile i komunikaty serwera w tym samym języku).
- **Zgody przy pierwszym logowaniu:** regulamin + polityka prywatności (wymagane), osobna wyraźna zgoda na dane o zdrowiu
  (RODO art. 9, wymagana), nowości e-mailem (opcjonalnie). Zapis daty i wersji dokumentu.
- **Wymagane przez Google Play i RODO:** „Pobierz moje dane” i „Usuń konto” w aplikacji (+ strona usuwania konta w sieci).

Prototypy: `docs/prototypes/sixmo-konta.html` (logowanie, język i zgody, konto z zaproszenia, Konto),
`docs/prototypes/sixmo-landing.html` (strona startowa). Oba z przełącznikiem PL/EN.

## Etapy
1. **Wersja angielska (niezależna od logowania — można zacząć od razu).**
   Słownik `t('klucz')` z plikami pl/en i testem pilnującym braków; ekrany i komunikaty; dane planu (ćwiczenia, opisy
   techniki, jadłospis, składniki i lista zakupów, fazy); daty i liczby (`Intl`); komunikaty serwera; opis aplikacji dla Trenera.
   Teksty angielskie przejrzy osoba anglojęzyczna przed publikacją.
2. **Konta w Supabase** (po założeniu projektu przez właściciela):
   logowanie Google + kod e-mail w aplikacji, sesje, ekran Konto (urządzenia, wyloguj wszędzie, język, zgody, pobierz dane,
   usuń konto); serwer Apps Script weryfikuje token Supabase; przeniesienie obecnych kont z zaproszeń (dane na telefonie →
   nowe konto, jednorazowo); plany i limity przypięte do konta Supabase.
3. **Strona startowa** na `sixmo.app` (po „code bravo”), polityka prywatności i regulamin (szkic — do przejrzenia przez prawnika
   przed otwarciem rejestracji dla wszystkich), strona usuwania konta.
4. **Otwarcie rejestracji** — dopiero po etapach 1–3 i przeglądzie dokumentów; linki z zaproszeniami wyłączone.

## Stan etapu 2 (13 listopada 2026)
Zrobione — **Więcej → Konto** we wszystkich wersjach:
- Logowanie „Kontynuuj z Google” (przekierowanie z PKCE) i kodem z e-maila — `app/lib/sbauth.ts` (bez supabase-js, z testami),
  sesja w `localStorage` (`sixmo_sb`), odświeżana przed wygaśnięciem (`app/core/sb.ts`), ekran `app/screens/account.ts`.
- **Konto z zaproszenia → logowanie:** zalogowanie na urządzeniu ze starym kontem łączy je z adresem e-mail (`sbLink`);
  dane zostają na tym samym koncie, token z urządzenia znika. Stary token działa dalej na innych urządzeniach, dopóki
  się na nich nie zalogujesz.
- Serwer (`Kod.js`): token Supabase sprawdzany przez `/auth/v1/user` (pamięć podręczna ≤ 5 min), połączenie
  `sbu_<id>` ↔ `user_<konto>.sb`; konto administratora łączy się tak samo (zalogowane starym tokenem SECRET).
- Logowanie bez konta SixMo → komunikat „rejestracja ruszy wkrótce” (otwarcie rejestracji to etap 4).
  `sbJoin` (zaproszenie dla zalogowanego) jest na serwerze, w aplikacji jeszcze nieużywany.
- Wyloguj (dane zapisane na koncie, potem usunięte z urządzenia) i „Wyloguj ze wszystkich innych urządzeń” (`scope=others`).
- Usunięcie konta usuwa też połączenie; z `SB_SECRET` we Właściwościach skryptu także użytkownika w Supabase (nieprzetestowane).

Do zrobienia: lista urządzeń (Supabase nie udostępnia jej bez klucza administratora — przez serwer z `SB_SECRET`),
dołączanie z zaproszenia przez logowanie, własne e-maile (Resend + domena), język e-maili, logowanie w aplikacji Android
(Capacitor: przekierowanie do aplikacji zamiast strony).

## Co robi właściciel (Claude nie zakłada kont i nie wpisuje haseł ani kluczy)
- Konto **Supabase** (https://supabase.com), projekt w regionie **Frankfurt (eu-central-1)**, logowanie dwuskładnikowe.
  Do aplikacji trafiają tylko **adres projektu i klucz publiczny (anon/publishable)** — są jawne z założenia.
  Klucz `service_role`/secret **nigdy** do repo ani czatu; jeśli serwer go potrzebuje — tylko do Właściwości skryptu.
- **Google Cloud Console:** ekran zgody OAuth (nazwa SixMo, domena sixmo.app, polityka prywatności) i klient OAuth
  „Aplikacja internetowa” — identyfikator i sekret wpisuje właściciel bezpośrednio w panelu Supabase (Authentication → Providers → Google).
- **Wysyłka e-maili:** konto w serwisie pocztowym (np. Resend, darmowe 3000/mies.), weryfikacja domeny sixmo.app w DNS;
  dane SMTP wpisuje właściciel w panelu Supabase. Wbudowana poczta Supabase wysyła tylko kilka wiadomości na godzinę.
- „**code bravo**” — domena w Cloudflare (część A w `docs/CODE-BRAVO.md`).
