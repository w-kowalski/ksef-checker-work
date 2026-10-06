# Poprawka Gazety księgowego — 2.6.2

- źródła są pobierane równolegle zamiast sekwencyjnie;
- timeout pojedynczego źródła został ograniczony, aby funkcja Netlify nie blokowała całej Gazety;
- awaria jednego serwisu nie przerywa pozostałych;
- jeśli funkcja Netlify zwróci błąd albo brak artykułów, frontend automatycznie używa `news_seed.json`;
- wyniki live i zapisany seed są scalane bez duplikatów;
- komunikaty błędów odnoszą się do hostingu Netlify, a nie do lokalnego `START_CHECKER.bat`.

Po podmianie plików w repo GitHub Netlify powinno automatycznie wykonać nowy deploy.
