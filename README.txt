KSeF Checker Pro 2.5.1 — PDF + XML FA(3) + Toolbox + Gazeta + QA
Data wydania: 24.09.2026

URUCHOMIENIE (Windows)
1. Rozpakuj ZIP do zwykłego katalogu.
2. Uruchom START_CHECKER.bat.
3. Przy pierwszym uruchomieniu aplikacja automatycznie instaluje lokalny parser PDF (pdf-parse 1.1.4) przez npm.
4. Następnie uruchamia lokalny serwer Node i otwiera przeglądarkę.
5. Domyślnie próbuje portu 8787; jeżeli jest zajęty, automatycznie wybiera kolejny wolny port.

Wymaganie: Node.js 18 lub nowszy wraz z npm. Pierwsze uruchomienie trybu PDF wymaga internetu wyłącznie do instalacji paczki pdf-parse. Później parser działa lokalnie.
Nie otwieraj samego index.html przez file://, jeśli chcesz korzystać z PDF, rejestrów, Gazety, QA serwerowego lub XSD.

NAJWAŻNIEJSZE FUNKCJE 2.1

1. ANALIZA FAKTURY — PDF LUB XML
- jedno pole uploadu akceptuje PDF i XML;
- XML FA(3): pełny parser, kontrole KSeF, XSD, Biała Lista MF, VIES, NBP i podgląd FA(3);
- PDF z warstwą tekstową: lokalne wydobycie tekstu, rozpoznanie stron faktury, NIP, dat, numeru faktury, rachunku, kwot i VAT, a następnie te same kontrole rejestrowe i matematyczne tam, gdzie dane dają się wiarygodnie odczytać;
- przy PDF XSD jest oznaczone jako „nie dotyczy”, ponieważ PDF nie jest strukturą KSeF;
- PDF jest wyświetlany w podglądzie jako oryginalny dokument;
- użytkownik może poprawić odczytane dane i uruchomić kontrolę ponownie bez modyfikowania oryginalnego PDF;
- aplikacja pokazuje wskaźnik kompletności odczytu PDF oraz ograniczenia parsera.

WAŻNE: wersja 2.2 obsługuje PDF z warstwą tekstową (np. wygenerowany z programu księgowego). Skan będący wyłącznie obrazem wymaga OCR i jest w tej wersji wykrywany jako nieobsługiwany, zamiast generować przypadkowe dane.

2. XSD FA(3) — TYLKO XML
- przy pierwszej walidacji aplikacja próbuje pobrać oficjalne schemy FA(3) i zapisuje je lokalnie w schemas/fa3;
- po zapisaniu schem walidacja może działać offline;
- źródło główne: CRD/MF, źródło awaryjne: oficjalne repozytorium CIRFMF;
- Windows: walidacja .NET przez dołączony validate_xsd.ps1;
- inne systemy: walidacja przez Python/lxml, jeśli jest dostępny;
- jeżeli schematu lub silnika nie można uruchomić, aplikacja pokazuje ostrzeżenie techniczne zamiast uznawać fakturę za błędną.

3. BIBLIOTEKA TESTOWA
- 46 lokalnych XML-i do szybkiego sprawdzania bez uploadu z zewnątrz;
- 5 lokalnych referencji rzeczywistych, publicznych faktur z numerami KSeF;
- wyszukiwarka i podział na scenariusze poprawne/negatywne.

4. TOOLBOX KSIĘGOWEGO
16 narzędzi, m.in. kontrahent, rachunek, VIES, NBP, termin faktury, VAT, MPP, odsetki, leasing, polisa, różnice kursowe, kalendarz terminów, porównanie XML, podgląd XML, generator FA(3), zamknięcie miesiąca.
Każde narzędzie pokazuje link do źródła oraz informację „Stan prawny / źródła zweryfikowane: 24.09.2026”.

5. GAZETA KSIĘGOWEGO
- agregator informacji z MF, podatki.gov.pl, ZUS, Prawo.pl, INFOR, Poradnika Przedsiębiorcy, GOFIN i PIT.pl;
- kategorie tematyczne: ZUS, VAT/KSeF, PIT/CIT, rachunkowość, kadry i płace, inne podatki, podatki/prawo;
- filtry: temat, źródło, dziś/3 dni/7 dni oraz „tylko źródła urzędowe”;
- sekcja „Co nowego od ostatniej wizyty”;
- statusy materiałów: informacja / projekt-planowane / uchwalone-opublikowane / obowiązuje-wdrożenie.

6. HISTORIA KONTROLI
- lokalna historia maks. 100 ostatnich analiz PDF i XML;
- zapisuje metadane i wynik kontroli, nie przechowuje całego PDF ani XML;
- wyszukiwanie i filtrowanie po statusie;
- historia znajduje się w localStorage konkretnej przeglądarki/profilu.

7. RAPORT KONTROLI / PDF
- po sprawdzeniu faktury przycisk „Raport kontroli / PDF” tworzy osobny widok raportu;
- raport rozróżnia kontrolę PDF od kontroli XML FA(3);
- dla PDF XSD jest oznaczone jako N/D;
- standardowe okno drukowania pozwala zapisać raport do PDF.

8. TESTY / QA
- zakładka „Testy / QA” uruchamia zestaw testów regresyjnych;
- obejmuje bibliotekę XML, reguły Checkera, kalkulatory, elementy UI, XSD oraz testy parsera tekstu PDF;
- QA pokazuje również, czy lokalna zależność pdf-parse jest zainstalowana;
- opcjonalnie można włączyć testy usług internetowych (NBP, Gazeta, Biała Lista);
- wynik można wyeksportować do JSON.

PRYWATNOŚĆ
XML jest parsowany lokalnie w przeglądarce. PDF jest przesyłany wyłącznie do lokalnego server.js działającego na 127.0.0.1 i tam odczytywany przez lokalny parser. Sam plik PDF nie jest wysyłany do zewnętrznej usługi OCR ani chmury. Do MF/VIES/NBP trafiają wyłącznie dane potrzebne do konkretnej weryfikacji (np. NIP, rachunek, data, waluta).

WAŻNE OGRANICZENIA TRYBU PDF
- odczyt PDF jest heurystyczny: układ faktur różni się pomiędzy programami;
- przy niskiej pewności użytkownik powinien porównać odczytane pola z oryginalnym podglądem;
- skan bez warstwy tekstowej nie jest jeszcze OCR-owany;
- PDF nie pozwala potwierdzić XSD, KodFormularza, WariantFormularza ani konkretnych pól FA(3);
- jeżeli potrzebna jest pełna kontrola KSeF, właściwym źródłem pozostaje XML FA(3).

POZOSTAŁE OGRANICZENIA
- aplikacja jest narzędziem roboczym i nie zastępuje oceny pełnego stanu faktycznego;
- dostępność Białej Listy, VIES, NBP i źródeł Gazety zależy od zewnętrznych usług;
- bezpośrednia wysyłka do KSeF, uwierzytelnianie i obsługa UPO nie są jeszcze zaimplementowane;
- klasyfikacja informacji w Gazecie jest automatyczną heurystyką;
- „Stan prawny / źródła zweryfikowane” jest datą ostatniego przeglądu reguł w tej wersji, a nie gwarancją braku późniejszych zmian.

ŹRÓDŁA XSD / KSeF
- https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/struktura-logiczna-fa-3/
- https://ksef.podatki.gov.pl/pliki-do-pobrania-ksef-20/
- https://crd.gov.pl/wzor/2025/06/25/13775/
- https://github.com/CIRFMF/ksef-api/tree/main/faktury/schemy/FA

Szczegółowe źródła Toolboxa: TOOLBOX_SOURCES.txt

2.4.1 — poprawa parsera PDF
- daty są wybierane na podstawie kontekstu etykiet (data wystawienia / sprzedaży / termin płatności), także gdy wszystkie są w jednym wierszu;
- kwoty netto, VAT i brutto są oceniane wspólnie i uzgadniane matematycznie (netto + VAT = brutto);
- parser rozpoznaje podsumowania tabeli VAT oraz polski i anglosaski zapis kwot (np. 1.234,56 i 1,234.56);
- lokalny parser próbuje dodatkowej ekstrakcji zachowującej układ wierszy/kolumn PDF;
- przy dacie i kwotach wyświetlana jest pewność konkretnego pola, a ogólny wskaźnik nazwano „Kompletność”, aby nie mylić kompletności z gwarancją poprawności.

2.4.1 — analiza zbiorcza PDF
- przycisk „Wybierz wiele PDF” pozwala wskazać wiele faktur jednocześnie,
- dokumenty są analizowane kolejno, bez sztywnego limitu liczby plików w interfejsie,
- tabela zbiorcza pokazuje: pozycję, numer/pliki, sprzedawcę, datę, brutto, wynik kontroli oraz liczbę błędów/ostrzeżeń,
- kliknięcie wiersza rozwija dane odczytane z PDF i wszystkie kontrole,
- z rozwiniętego wiersza można otworzyć fakturę w pełnym widoku Checkera bez ponownej ekstrakcji tekstu,
- przy większych pakietach (>30 plików) aplikacja wyświetla ostrzeżenie o czasie kontroli rejestrowej,
- Biała Lista, VIES i NBP są odpytywane kolejno, aby ograniczyć ryzyko przeciążenia usług.


2.4.1 — poprawa parsera rzeczywistych PDF
- numer faktury nie może być już przypadkowym słowem po wyrazie „Faktura” (np. „wystawionaw”); wymagany jest wiarygodny identyfikator zawierający cyfry;
- rozszerzono wykrywanie daty wystawienia (m.in. „wystawiona w dniu”, „wystawiono w”, warianty PL/EN i data w sąsiednich liniach);
- pola Nazwa/Adres/NIP są rozcinane z jednego wiersza i czyszczone z etykiet;
- strony bez nagłówków Sprzedawca/Nabywca są rozdzielane według najbliższego NIP, bez mieszania sąsiedniej firmy;
- komunikaty techniczne parsera nie są liczone jako osobne ostrzeżenia księgowe w analizie zbiorczej;
- przy niepewnej nazwie w tabeli zbiorczej można użyć nazwy z Białej Listy MF jako bezpiecznego opisu pomocniczego;
- niepewnego adresu PDF nie klasyfikujemy automatycznie jako różnicy księgowej względem rejestru.


2.4.1 — poprawki dla wizualizacji PDF z KSeF
- link weryfikacyjny QR typu pl/invoice/... nie jest już nigdy traktowany jako numer faktury P_2,
- data wystawienia może być potwierdzona z linku weryfikacyjnego KSeF (kod zawiera P_1),
- NIP sprzedawcy z linku QR jest używany jako mocny sygnał do przypisania stron,
- pola Nazwa/Adres/NIP w jednej linii są rozdzielane bez doklejania kolejnych etykiet do nazwy,
- w tabeli zbiorczej nazwa z Białej Listy MF ma pierwszeństwo przed niepewną nazwą z PDF,
- brak pola wynikający z ekstrakcji PDF jest klasyfikowany jako problem odczytu, a nie automatyczny błąd księgowy.

2.4.1 — poprawa numerów faktur w analizie zbiorczej PDF
- odrzucanie rachunków 26-cyfrowych i PL+26 cyfr jako numeru faktury
- odrzucanie NIP/REGON/numerów technicznych
- dokumenty WZ/PZ itp. nie są brane z luźnego fallbacku
- większy priorytet dla numeru bezpośrednio przy etykiecie Numer faktury
- maksymalnie 2 kolejne linie przeszukiwane po etykiecie zamiast 5
- tabela zbiorcza ponownie waliduje numer przed pokazaniem


2.4.1 — stabilny podgląd PDF
- oryginalny PDF jest udostępniany do podglądu przez tymczasowy lokalny adres /api/pdf/view/<id> zamiast polegać wyłącznie na blob: URL;
- endpoint obsługuje HTTP Range wymagane przez przeglądarkowe czytniki PDF;
- działa również po otwarciu dokumentu z analizy zbiorczej;
- dodano „Otwórz PDF” i „Odśwież podgląd” jako bezpieczny fallback.


2.4.1 — podgląd PDF bez pluginu przeglądarki
- oryginalny PDF jest renderowany lokalnie strona po stronie na canvas przez PDF.js dostarczany razem z pdf-parse;
- podgląd nie zależy już od wbudowanego czytnika PDF Chrome/Edge w iframe;
- dodano zoom i diagnostykę obecności renderera w Testy / QA;
- przycisk „Otwórz PDF” nadal udostępnia dokładny oryginalny plik.

NOWOŚĆ 2.4.1 — KALKULATOR FORMY OPODATKOWANIA
- nowa zakładka „Kalkulator podatkowy”,
- porównanie: skala podatkowa / podatek liniowy / ryczałt,
- parametry 2026: skala 12%/32%, liniowy 19%, zdrowotna 9%/4,9%, progi zdrowotnej ryczałtu,
- obsługa kilku stawek ryczałtu jednocześnie,
- opcjonalne wspólne rozliczenie małżonków w wariancie skali,
- ręczne korekty składki zdrowotnej do dokładnej symulacji klienta,
- wykres porównawczy i analiza wrażliwości na przychód,
- ostrzeżenia o limicie ryczałtu i usługach dla pracodawcy,
- raport PDF dla klienta przez okno drukowania / „Zapisz jako PDF”,
- komplet linków do podatki.gov.pl, ZUS, ELI i EUREKA KIS.

Szczegółowe źródła: TAX_SIMULATOR_SOURCES.txt

NOWOŚĆ 2.4.1 — SKŁADKA ZDROWOTNA ZUS
- osobna zakładka z rocznym arkuszem 2026 dla skali, liniowego i ryczałtu,
- wiele profili klientów zapisywanych lokalnie w przeglądarce,
- miesięczne przychody/koszty/dochody/składki społeczne i należna zdrowotna,
- skala/liniowy: powiązanie dochodu miesiąca poprzedniego ze składką bieżącego miesiąca i dodatkowy styczeń 2027 do rozliczenia 2026,
- ryczałt: narastający przychód i progi 60 000 / 300 000 zł oraz roczne wyrównanie,
- podsumowanie roczne: podstawa, składka roczna, suma miesięcznych składek należnych, dopłata/zwrot,
- eksport raportu PDF i pliku Excel,
- źródła: HEALTH_CALC_SOURCES.txt.

FORMATOWANIE LICZB 2.4.1
Pola kwotowe w kalkulatorach są prezentowane z separatorami tysięcy, np. 60 000 zamiast 60000. Podczas obliczeń separatory są ignorowane.


NOWOŚĆ 2.4.2 — SKŁADKA ZDROWOTNA / SPRZEDAŻ ŚRODKÓW TRWAŁYCH
- osobne kolumny przychodu i kosztu sprzedaży ŚT/WNiP,
- automatyczne wyłączenie sprzedaży ŚT z miesięcznej podstawy zdrowotnej,
- dla skali/liniowego opcja dobrowolnego uwzględnienia sprzedaży ŚT w rozliczeniu rocznym,
- informacja o oświadczeniu w rocznym ZUS DRA/RCA,
- dla ryczałtu sprzedaż ŚT pozostaje wyłączona,
- pole „Do wykazania w DRA” jest wyliczane automatycznie i zablokowane,
- odrębne kolory: skala — niebieski, liniowy — fioletowy, ryczałt — zielony,
- wyrównany układ kolumn i pól tabeli.


NOWOŚĆ 2.5.1 — PULPIT I KARTOTEKA KLIENTA
- Pulpit z alertami, kontrolami faktur, klientami i stanem źródeł.
- Kartoteka klienta: NIP, forma opodatkowania, VAT, rachunek, notatki.
- Powiązanie z kalkulatorem zdrowotnej i automatyczna historia faktur po NIP.
- Prognoza roczna PIT/zdrowotnej i orientacyjna rezerwa do końca roku.
- Rejestr pomocniczy środków trwałych.
- Raport / pakiet PDF dla klienta.
- Porównanie PDF z XML FA(3) tej samej faktury.
- Import klientów CSV/XLSX i pełna lokalna kopia zapasowa JSON.

NOWOŚĆ 2.5.1 — REGUŁY I ŹRÓDŁA
- Wersjonowana lista kluczowych reguł z datą obowiązywania i źródłem urzędowym.
- Kontrola dostępności źródeł online przez lokalny serwer.
- Filtry analizy zbiorczej PDF: wynik, rodzaj problemu, wyszukiwanie.


NOWOŚĆ 2.5.1 — AUTOMATYCZNE DANE KLIENTA PO NIP
- Po wpisaniu poprawnego 10-cyfrowego NIP kartoteka automatycznie odpytuje oficjalny Wykaz podatników VAT MF.
- Uzupełniane automatycznie: nazwa, status VAT, REGON, KRS, adres oraz rachunki z Białej Listy.
- Przy wielu rachunkach użytkownik wybiera, który zapisać w kartotece.
- Wyniki są buforowane lokalnie dla NIP + dnia sprawdzenia, aby ograniczyć liczbę zapytań do API MF.
- Forma opodatkowania, stawka ryczałtu, e-mail i dane wewnętrzne klienta pozostają ręczne — nie są wiarygodnie dostępne w publicznym Wykazie VAT.
- Źródło: https://www.gov.pl/web/kas/api-wykazu-podatnikow-vat
