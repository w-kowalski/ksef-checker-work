# KSeF Checker 2.6.3 — poprawka routingu Netlify

Wersja 2.6.3 naprawia globalny routing funkcji serverless.

W poprzedniej konfiguracji reguła `/api/* -> /.netlify/functions/api?route=:splat` była zawodna, ponieważ Netlify nie podstawia `:splat` do query stringu w ten sposób.

W 2.6.3 wszystkie używane trasy mają jawne reguły w `netlify.toml`, m.in.:
- /api/news
- /api/audit
- /api/toolbox/contractor
- /api/toolbox/bank
- /api/toolbox/vies
- /api/toolbox/nbp
- /api/toolbox/interest
- /api/legal/status
- /api/xsd/status
- /api/xsd/sync
- /api/xsd/validate
- /api/health
- /api/qa/server

Po deployu sprawdź najpierw `/api/health`, a potem `/api/news`.
