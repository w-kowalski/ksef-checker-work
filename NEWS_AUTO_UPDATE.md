# Automatyczna aktualizacja Gazety księgowego

Wersja WORK 2.5.2 odświeża `news_seed.json` przez GitHub Actions co 3 godziny.

Po pierwszym wgraniu plików do repozytorium:
1. Otwórz **Actions**.
2. Wybierz workflow **Aktualizuj Gazete Ksiegowego**.
3. Kliknij **Run workflow** -> **Run workflow**, aby wykonać pierwsze odświeżenie od razu.
4. Po około 1-2 minutach odśwież GitHub Pages (Ctrl+F5).

Później GitHub będzie próbował aktualizować wiadomości automatycznie co 3 godziny.

Jeżeli workflow nie może wykonać `git push`, wejdź w:
**Settings -> Actions -> General -> Workflow permissions**
i ustaw **Read and write permissions**.
