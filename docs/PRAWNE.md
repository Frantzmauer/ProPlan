# Dokumenty prawne SixMo — analiza i lista zadań

Przygotowane 10 listopada 2026. **To nie jest porada prawna.** Dokumenty są wersją roboczą — przed otwarciem
rejestracji dla obcych osób i przed uruchomieniem płatności powinien je przejrzeć prawnik (najlepiej z doświadczeniem
w RODO i prawie konsumenckim).

Pliki: `legal/regulamin.html`, `legal/polityka-prywatnosci.html` (PL) oraz `legal/terms.html`, `legal/privacy.html` (EN),
wspólny wygląd `legal/legal.css`. W aplikacji: Więcej → Regulamin i polityka prywatności (otwiera wersję w języku konta).
Adres w sieci: `/legal/…` (np. `https://frantzmauer.github.io/ProPlan/legal/regulamin.html`, po „code bravo” `https://sixmo.app/legal/…`).

## Co wymaga prawo i gdzie to jest

| Wymóg | Źródło | Gdzie |
|---|---|---|
| Regulamin usługi elektronicznej: rodzaj usług, wymagania techniczne, zakaz treści bezprawnych, reklamacje, zawarcie i rozwiązanie umowy | ustawa o świadczeniu usług drogą elektroniczną, art. 8 | Regulamin §2–§4, §6, §10–§11 |
| Informacja o przetwarzaniu danych: administrator, cele, podstawy, odbiorcy, transfer poza EOG, okres, prawa, skarga do PUODO | RODO art. 13 | Polityka 1–7 |
| Dane o zdrowiu tylko za wyraźną zgodą | RODO art. 9 ust. 2 lit. a | Polityka 4 — **zgody w aplikacji jeszcze brak (niżej)** |
| Informacja, że rozmawiasz z AI | AI Act art. 50 | Regulamin §2 ust. 2, notka w Więcej, opis w oknie Trenera |
| Prawa konsumenta przy usługach cyfrowych: zgodność z umową, reklamacja, odstąpienie 14 dni | ustawa o prawach konsumenta (rozdz. 4 i 5b) | Regulamin §5, §9, §10 |
| Przechowywanie na urządzeniu bez zgody tylko, gdy niezbędne | Prawo komunikacji elektronicznej, art. 399 | Polityka 8 (tylko localStorage niezbędny do działania, bez analityki) |
| Polityka prywatności pod stałym adresem i usuwanie konta z aplikacji i ze strony | Google Play (Data safety, Account deletion) | Polityka ma adres; **usuwanie konta w aplikacji — do zrobienia z kontami** |

## Czy dane muszą być na serwerze?

Tak — i jest to uzasadnione: bez serwera użytkownik traci wszystko przy zmianie lub utracie telefonu, nie korzysta
z kilku urządzeń, a Trener AI nie widzi historii. Płacący użytkownik ma prawo do swoich danych i do ich przeniesienia
(RODO art. 20 — już działa „Pobierz moje dane”, plik JSON). Podstawy: zwykłe dane — wykonanie umowy (art. 6 ust. 1 lit. b);
dane o zdrowiu — wyraźna zgoda (art. 9 ust. 2 lit. a). Cykl domyślnie zostaje tylko na telefonie.

Jednocześnie Regulamin §7 uczciwie mówi: bez synchronizacji dane są tylko na urządzeniu i mogą przepaść; nie odpowiadamy
za utratę danych trzymanych wyłącznie lokalnie. To jest dopuszczalne, ale nie zwalnia z odpowiedzialności za serwer.

## Do zrobienia (w tej kolejności)

1. **Dane administratora** w obu dokumentach (pola na pomarańczowo): imię i nazwisko albo firma, adres, NIP (jeśli
   działalność), adres e-mail do spraw danych i reklamacji. Przy sprzedaży Premium potrzebna jest forma prowadzenia
   sprzedaży (działalność gospodarcza / działalność nierejestrowana do limitu przychodu) — do decyzji z księgową.
2. **Zgody przy rejestracji** (prototyp `docs/prototypes/sixmo-konta.html`): akceptacja Regulaminu i Polityki +
   osobna wyraźna zgoda na dane o zdrowiu, z zapisem daty i wersji dokumentu; możliwość wycofania zgody w Koncie.
   Obecni użytkownicy z zaproszeń — poprosić o zgody przy najbliższym otwarciu aplikacji.
3. **Umowy powierzenia z dostawcami (ważne).** Dziś serwer to Google Apps Script i Dysk na prywatnym koncie Gmail —
   warunki konta prywatnego **nie są umową powierzenia przetwarzania** w rozumieniu RODO (art. 28), a przechowujemy tam
   dane o zdrowiu. Rozwiązanie: przeprowadzka kont i danych do dostawcy z umową powierzenia i serwerami w UE (plan:
   Supabase, Frankfurt) — albo Google Workspace z podpisaną umową przetwarzania. Anthropic: warunki komercyjne API
   zawierają umowę przetwarzania danych (DPA) — sprawdzić i zaakceptować w panelu Anthropic.
4. **Czcionki i biblioteki z zewnątrz** (Google Fonts, jsDelivr): przenieść pliki do aplikacji — mniej odbiorców danych
   (adres IP) i działanie bez internetu. Potem usunąć te pozycje z Polityki.
5. **Usuwanie konta w aplikacji** (Więcej → Konto → Usuń konto) i strona usuwania konta w sieci — wymóg Google Play;
   do zrobienia razem z nowymi kontami. Do tego czasu — na prośbę e-mailem.
6. **Płatności:** uzupełnić Regulamin §5 (operator, odnowienie, rezygnacja, odstąpienie, faktury) i Politykę
   (operator płatności) — przed uruchomieniem Premium; przejrzeć z prawnikiem.
7. **Wersje dokumentów:** przy każdej zmianie nowa data „obowiązuje od”, informacja w aplikacji 14 dni wcześniej;
   przy zmianie zakresu zgód — ponowna zgoda.
8. **Tłumaczenie angielskie** przejrzy osoba anglojęzyczna; w dokumentach EN zapis, że wiąże wersja polska.

## Uwagi do treści

- Wiek: 18+ (prościej niż zgoda rodzica dla 16–17 lat; aplikacja dotyczy diety i zdrowia).
- Okresy przechowywania (30 dni po usunięciu konta, 90 dni kopie, 24 miesiące nieaktywności) — propozycja; trzeba je
  potem faktycznie realizować (automatyczne czyszczenie na serwerze — do zrobienia przy przeprowadzce serwera).
- Zakaz nadużyć AI (§6): obchodzenie limitów, boty, współdzielenie konta, próby obejścia zabezpieczeń modelu,
  zdjęcia innych osób bez zgody — z możliwością ograniczenia funkcji po wezwaniu.
