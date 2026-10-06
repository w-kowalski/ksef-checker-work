# KSeF Checker Pro 2.5.1 — WORK / WEB

Ta paczka jest przygotowana do uruchamiania jako statyczna strona WWW bez Node.js.

## Najprościej: GitHub Pages
1. Załóż prywatne lub publiczne repozytorium na GitHubie, np. `ksef-checker-work`.
2. Rozpakuj tę paczkę i wrzuć **zawartość folderu** do głównego katalogu repozytorium. `index.html` ma być w katalogu głównym.
3. GitHub: **Settings → Pages**.
4. W `Build and deployment` wybierz **Deploy from a branch**.
5. Branch: `main`, folder: `/ (root)`, kliknij **Save**.
6. Po opublikowaniu GitHub pokaże adres strony. Otwierasz go w pracy zwykłą przeglądarką — bez Node i bez instalacji.

## Ważne o prywatności
- XML jest analizowany w przeglądarce.
- PDF z warstwą tekstową jest analizowany w przeglądarce przy pomocy PDF.js; sam plik PDF nie jest wysyłany do KSeF Checkera ani na własny backend.
- Sprawdzenia Białej Listy / NBP, jeśli przeglądarka na to pozwoli, wysyłają do oficjalnych API tylko parametry potrzebne do weryfikacji (np. NIP, rachunek, data, waluta).
- VIES może być blokowany przez CORS i wtedy należy użyć oficjalnej strony VIES ręcznie.
- Pełna walidacja XSD FA(3) jest w tej wersji wyłączona.
- Biblioteki PDF.js i ExcelJS są ładowane z CDN. Jeśli firmowy firewall blokuje CDN, PDF lub eksport XLSX mogą nie działać.

## Co działa bez Node
- analiza i wizualizacja XML FA(3),
- lokalne reguły księgowo-podatkowe,
- analiza PDF z warstwą tekstową (bez OCR),
- podgląd PDF,
- historia kontroli w przeglądarce,
- kalkulator podatkowy,
- kalkulator składki zdrowotnej,
- większość Toolboxa,
- NBP i próba Białej Listy bezpośrednio z oficjalnych API,
- statyczna „Gazeta księgowego” z danymi dołączonymi do paczki.

## Ograniczenia wersji statycznej
- brak pełnej walidacji XSD,
- brak OCR skanów PDF,
- brak własnego proxy do MF/VIES — firmowa sieć lub CORS może zablokować zapytanie,
- wiadomości nie są automatycznie odświeżane z internetu,
- brak produkcyjnej komunikacji z API KSeF/UPO.

## Alternatywa dla GitHub Pages
Paczka jest czysto statyczna, więc można ją również wdrożyć na Cloudflare Pages, Netlify, Vercel Static albo wewnętrzny firmowy serwer WWW.
