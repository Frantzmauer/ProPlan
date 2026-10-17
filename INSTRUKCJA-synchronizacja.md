# ŻELAZO — synchronizacja w chmurze (Google Apps Script)

Ta instrukcja pozwala włączyć **automatyczną synchronizację** między telefonem a laptopem,
bez ręcznego eksportu plików. Konfigurujesz raz, na swoim koncie Google.

---

## Krok po kroku (robisz raz)

1. Wejdź na **script.google.com** i kliknij **Nowy projekt**.
2. Skasuj cały domyślny kod w edytorze.
3. Otwórz plik **ZELAZO-AppsScript.gs** (obok aplikacji), skopiuj całość i wklej do edytora.
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

## Jak udostępnić bratu (żeby widział tylko swoje dane)

Nie musisz robić nic więcej po swojej stronie. Wystarczy, że dasz bratu:

1. **Plik aplikacji** (`index.html`) — otworzy go u siebie.
2. **Ten sam URL skryptu** i **ten sam token**.
3. Instrukcję: w „Więcej → Synchronizacja w chmurze" niech wpisze **inną nazwę konta**,
   np. `brat`.

Ponieważ dane są zapisywane pod nazwą konta, brat wpisując `brat` widzi wyłącznie swoje dane,
a Ty ze swoim `marek` — swoje. Ten sam skrypt obsługuje Was obu, każdy osobno.

> Uwaga o prywatności: przy wspólnym tokenie technicznie moglibyście odczytać nawzajem swoje
> dane, gdybyście znali swoją nazwę konta. Dla dziennika treningowego dwóch braci to bez znaczenia.
> Jeśli chcecie pełną izolację — brat może założyć **własny** skrypt (te same kroki 1–10 na jego
> koncie Google) i użyć swojego URL. Wtedy dane w ogóle się nie stykają.

---

## Rozwiązywanie problemów

- **„Zła odpowiedź serwera"** — sprawdź, czy URL kończy się na `/exec` (a nie `/dev`),
  i czy wdrożenie ma dostęp „Wszyscy".
- **„Zły token"** — token w aplikacji musi być identyczny jak właściwość `SECRET` w skrypcie.
- **„Brak SECRET we Właściwościach skryptu"** — dodaj właściwość `SECRET` (krok 4).
- **Nie działa z pliku otwartego z dysku (file://)** — niektóre przeglądarki blokują wtedy
  połączenia sieciowe. Na laptopie w Chrome zwykle działa; jeśli nie, otwórz aplikację przez
  lokalny serwer lub hosting. Na telefonie dodaj stronę do ekranu głównego.
- **Zmieniłeś kod skryptu** — musisz zrobić **Wdróż → Zarządzaj wdrożeniami → edytuj →
  Nowa wersja**, inaczej URL serwuje starą wersję.
