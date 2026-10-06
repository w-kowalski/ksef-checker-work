# KSeF Checker 2.6.0 WORK ONLINE — uruchomienie bez Node na komputerze

Ta wersja została przygotowana tak, aby wszystkie funkcje wymagające pobierania danych z Internetu miały wspólną warstwę serverless.

## Co działa przez Internet
- Biała Lista MF — status podatnika po NIP.
- Biała Lista MF — sprawdzenie rachunku bankowego dla NIP i daty.
- VIES / VAT UE.
- Kursy NBP.
- Automatyczna weryfikacja danych faktury (MF + VIES + rachunek + NBP).
- Gazeta księgowego / najnowsze wiadomości.
- Kontrola dostępności źródeł prawnych i oficjalnych serwisów.
- Kontrola dostępności oficjalnych plików XSD FA(3).
- Kalkulator odsetek ma możliwość potwierdzenia dostępności źródeł stawek online.

PDF i XML są nadal analizowane w przeglądarce — nie trzeba instalować Node na komputerze w pracy.

## Zalecany hosting: Netlify z repozytorium GitHub
GitHub Pages nie uruchamia funkcji serwerowych. Dlatego dla pełnej wersji online użyj Netlify, podłączając to samo repozytorium GitHub.

1. Wgraj zawartość tej paczki do repozytorium `ksef-checker-work` na GitHubie.
2. Wejdź na https://app.netlify.com/ i zaloguj się kontem GitHub.
3. Wybierz `Add new project` -> `Import an existing project` -> GitHub.
4. Wskaż repozytorium `ksef-checker-work`.
5. Netlify powinien wykryć plik `netlify.toml` automatycznie.
6. Build command: zostaw puste.
7. Publish directory: `.`
8. Kliknij Deploy.

Po wdrożeniu dostaniesz adres w rodzaju:
`https://nazwa-projektu.netlify.app`

Korzystaj w pracy z adresu Netlify, nie z adresu `github.io`, jeżeli chcesz mieć pełne kontrole MF/VIES/NBP i dane pobierane przez Internet.

## Bezpieczeństwo
Do usług zewnętrznych wysyłane są tylko dane wymagane do konkretnego sprawdzenia, np. NIP, numer rachunku, data, kod kraju VAT UE lub waluta. PDF/XML nie są wysyłane do Netlify w celu ekstrakcji — ich odczyt odbywa się lokalnie w przeglądarce.

## GitHub Pages
Strona nadal może działać na GitHub Pages jako tryb awaryjny. Część oficjalnych API może działać bezpośrednio z przeglądarki, ale VIES i niektóre źródła mogą być blokowane przez CORS. Dlatego pełny tryb WORK ONLINE wymaga Netlify Functions albo innego kompatybilnego API serverless.
