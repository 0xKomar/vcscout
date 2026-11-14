# VCScout — praca w repo

## Stos

- `app.py` — backend na Python stdlib (`ThreadingHTTPServer`, 127.0.0.1:8765). Serwuje statyczne pliki z `web/dist/` oraz JSON API. Brak zależności poza `tools/cala_http.py`, `tools/probe_cala.py` i `tools/linkedin_lookup.py`.
- `web/` — frontend Vite + React + TypeScript (strict). Tailwind CSS v4 (`@tailwindcss/vite`), komponenty shadcn/ui (radix-nova, radix-ui, neutral, zmienne CSS) w `web/src/components/ui/`, fonty Geist z `@fontsource-variable` oraz szeryfowy Hedvig Letters Serif (`font-serif`, nagłówki landingu) z `@fontsource`. Motyw (tokeny kolorów wzorowane na useminerva.com, animacje wejścia) w `web/src/index.css`. Alias `@` → `web/src`.
- Struktura `web/src/`: `lib/` (typy, logika `paths.ts`, klient `api.ts`, `format.ts`, testy vitest), `hooks/` (orkiestracja zapytań), `components/` (po jednym komponencie na plik, kebab-case).

## Polecenia

```sh
python3 app.py                 # serwer produkcyjny (serwuje web/dist + API)
cd web && npm install          # zależności
cd web && npm run build        # build do web/dist (tsc -b && vite build)
cd web && npm run dev          # dev server 127.0.0.1:5173, proxy /api → :8765
cd web && npm test             # vitest
cd web && npm run lint         # eslint .
```

## Zasada kredytów Cala

Cala kosztuje kredyty — w testach automatycznych (np. Playwright) **nie wolno** wywoływać żywych zapytań Cala. Mock przez route interception:

- `/api/similar` — zawsze woła Cala.
- `/api/risks` — woła Cala dla każdej niepustej listy funduszy.
- `/api/partners` — woła Cala poza zapisanymi parami: `lovable/byfounders`, `attio/point nine`, `metaview/plural`, `metaview/vertex ventures us`, `qdrant/spark capital`. Tryb „Mam pomysł” wywołuje go automatycznie po zakończeniu historii rund (maks. 16 par, po 2 naraz).
- `/api/search` — woła Cala poza 12 zapisanymi spółkami (Attio, Dust, ElevenLabs, Granola, Langfuse, Lightdash, Lovable, Metaview, Qdrant, Sana Labs, incident.io, n8n) z `research/results-summary.json`.
- `/api/fund-paths` — przy braku wyniku w pamięci zawsze woła Cala; nigdy nie wywołuj na żywo w testach automatycznych. Obsługuje etapy `seed`, `series-a` i `series-b`.
- `/api/person-investments` — przy braku wyniku w pamięci zawsze woła Cala; nigdy nie wywołuj na żywo w testach automatycznych.
- `/api/founders` — woła Cala poza zapisaną spółką `lovable`; wynik trzymany w pamięci. Tryb „Mam pomysł” wywołuje go automatycznie dla każdego podobnego startupu (maks. 4).
- `/api/linkedin` — nie woła Cala, ale przy braku wpisu w `.cache/linkedin.json` woła OpenAI (`gpt-6-luna` + web search, ok. 1 cent za osobę; klucz `OPENAI_API_KEY` w `.env`). Przyjmuje `{name, fund}` (inwestor) albo `{name, company}` (founder). Dla znalezionego profilu serwer pobiera też jego publiczną stronę LinkedIn (jedno żądanie, nagłówek `VCScout/0.1 (link preview)`) i zapisuje zdjęcie z `og:image`. Graf wywołuje endpoint automatycznie dla każdej osoby widocznej na mapie (po 3 naraz) — w testach automatycznych zawsze mockuj.
- `/api/examples` i statyczne pliki — zawsze bezpieczne.

## Wiek zależności npm

Instaluj tylko wersje opublikowane ≥7 dni temu. Każde `npm install`/`npx` uruchamiaj z `npm_config_before=<data odcięcia>`; dla narzędzi npx przypinaj wersję (`npx pkg@x.y.z`), nigdy `@latest`. W `package.json` bez zakresów `latest`/`*`. Trzymaj `web/package-lock.json`.
