# ŻELAZO — synchronizacja w chmurze (Google Apps Script)

Ta instrukcja pozwala włączyć **automatyczną synchronizację** między telefonem a laptopem,
bez ręcznego eksportu plików. Konfigurujesz raz, na swoim koncie Google.

---

## Krok po kroku (robisz raz)

1. Wejdź na **script.google.com** i kliknij **Nowy projekt**.
2. Skasuj cały domyślny kod w edytorze.
3. Otwórz plik **apps-script/Kod.js** z repozytorium, skopiuj całość i wklej do edytora.
4. **Nie wpisuj haseł ani kluczy w kod.** Kliknij **Ustawienia projektu** (koło zębate) →
   **Właściwości skryptu** → **Dodaj właściwość**:
   - `SECRET` — własne, długie hasło (np. wygenerowane w menedżerze haseł).
     Zapamiętaj je — to będzie „Token dostępu" w aplikacji.
5. (Opcjonalnie — szacowanie kalorii z opisu posiłku) Dodaj drugą właściwość:
   - `CLAUDE_API_KEY` — Twój klucz z Claude Platform (zaczyna się od `sk-ant-`).

   Klucz zostaje w ustawieniach skryptu — nigdy nie trafia do kodu, repozytorium, aplikacji
   ani przeglądarki. Koszt każdego
   oszacowania (ułamek grosza) obciąża Twój klucz — również gdy korzysta z niego brat na tym
   samym skrypcie. Zostaw pusty, jeśli nie chcesz tej funkcji.
6. Zapisz projekt (ikona dyskietki).
7. Kliknij **Wdróż → Nowe wdrożenie**.
8. Przy „Wybierz typ" kliknij koło zębate i wybierz **Aplikacja internetowa**.
9. Ustaw:
   - **Wykonaj jako:** Ja (Twój adres)
   - **Kto ma dostęp:** Wszyscy
10. Kliknij **Wdróż**. Google poprosi o autoryzację — zezwól
   (może pojawić się ekran „aplikacja niezweryfikowana" → Zaawansowane → Przejdź do projektu).
11. Skopiuj **URL aplikacji internetowej** — kończy się na `/exec`.

---

## W aplikacji ŻELAZO (na każdym urządzeniu)

Otwórz **Więcej → Synchronizacja w chmurze** i wpisz:

- **URL skryptu** — ten skopiowany adres kończący się na `/exec`
- **Token dostępu** — to samo hasło, które ustawiłeś jako `SECRET`
- **Nazwa konta** — Twoja własna, np. `marek`

Włącz przełącznik i kliknij **Test połączenia**. Jeśli zobaczysz „Połączenie działa" — gotowe.
Od teraz każda zmiana zapisuje się automatycznie, a przy starcie aplikacja pobiera najnowsze dane.

Zrób to samo na drugim urządzeniu (ten sam URL, token i **ta sama nazwa konta** `marek`) —
oba będą trzymać się w synchronie.

---

## Nowe osoby — zaproszenia (Ty zarządzasz kontami)

Twój token (`SECRET`) jest tokenem **administratora**. Z nim w **Więcej → Synchronizacja**
pojawia się sekcja **„Konta i zaproszenia”**:

1. Wpisz nazwę konta (np. `tomek`) albo zostaw pustą i kliknij **Zaproś**.
2. Wyślij tej osobie link (**Kopiuj link** / **Wyślij…**). Link działa **raz** i wygasa po **7 dniach**.
3. Osoba otwiera link na telefonie → **Dołącz** — aplikacja sama ustawia URL, konto i **jej własny token**.

Każdy zaproszony widzi **wyłącznie swoje dane** — jego token nie otwiera cudzych kont.
Serwer przechowuje tylko skrót (SHA-256) tokenu, nigdy sam token.

W panelu możesz też: **Zablokuj / Odblokuj**, **Nowy link** (gdy ktoś zgubi telefon — stary token
przestaje działać od razu, dane zostają) i **Usuń** (plik danych trafia do kosza Dysku na 30 dni).

Szacowanie kalorii przez Claude jest dostępne dla wszystkich kont i idzie z **Twojego** klucza API —
limit to 40 szacowań na konto dziennie (`ESTIMATE_PER_DAY` w skrypcie).

Dane kont leżą w folderze **„ZELAZO — dane kont (nie usuwaj)”** na Twoim Dysku Google, po jednym
pliku `<konto>.json`. Skrypt ma dostęp **tylko do plików, które sam utworzył**.

---

## Rozwiązywanie problemów

- **„Zła odpowiedź serwera"** — sprawdź, czy URL kończy się na `/exec` (a nie `/dev`),
  i czy wdrożenie ma dostęp „Wszyscy".
- **„Zły token"** — administrator: token musi być identyczny jak `SECRET`. Zaproszona osoba:
  token mógł zostać zresetowany albo konto zablokowane — wygeneruj jej **Nowy link** w panelu.
- **„Brak SECRET we Właściwościach skryptu"** — dodaj właściwość `SECRET` (krok 4).
- **Nie działa z pliku otwartego z dysku (file://)** — niektóre przeglądarki blokują wtedy
  połączenia sieciowe. Na laptopie w Chrome zwykle działa; jeśli nie, otwórz aplikację przez
  lokalny serwer lub hosting. Na telefonie dodaj stronę do ekranu głównego.
- **Po aktualizacji skryptu do wersji z kontami** — uruchom raz w edytorze funkcję `przygotujDane`
  (zgoda na Dysk: tylko pliki tworzone przez skrypt).
- **Zmieniłeś kod skryptu** — musisz zrobić **Wdróż → Zarządzaj wdrożeniami → edytuj →
  Nowa wersja**, inaczej URL serwuje starą wersję.
