# VCScout — praca w repo

## Stos

- `app.py` — backend na Python stdlib (`ThreadingHTTPServer`, 127.0.0.1:8765). Serwuje statyczne pliki z `web/dist/` oraz JSON API. Brak zależności poza `tools/cala_http.py`, `tools/probe_cala.py` i `tools/linkedin_lookup.py`.
- `web/` — frontend Vite + React + TypeScript (strict). Tailwind CSS v4 (`@tailwindcss/vite`), komponenty shadcn/ui (radix-nova, radix-ui, zmienne CSS) w `web/src/components/ui/`, fonty Geist z `@fontsource-variable` oraz szeryfowy Hedvig Letters Serif (`font-serif`) z `@fontsource`. Biało-niebiesko-zielony motyw atlasu relacji i tokeny są w `web/src/index.css`, a animacje Motion (`motion/react`) respektują `prefers-reduced-motion`. Ilustracja w `connection-atlas.tsx` jest wyłącznie przykładem, nie rzeczywistą ścieżką. Alias `@` → `web/src`.
- Struktura `web/src/`: `lib/` (typy, logika `paths.ts`, logika warstwy „Warm intros” w `network.ts`, `network-layout.ts`, `linkedin-csv.ts` i `intro.ts`, klient `api.ts`, `format.ts`, testy vitest), `hooks/` (orkiestracja zapytań), `components/` (po jednym komponencie na plik, kebab-case).

## Polecenia

```sh
python3 app.py                 # serwer produkcyjny (serwuje web/dist + API)
cd web && npm install          # zależności
cd web && npm run build        # build do web/dist (tsc -b && vite build)
cd web && npm run dev          # dev server 127.0.0.1:5173, proxy /api → :8765
cd web && npm test             # vitest
cd web && npm run lint         # eslint .
python3 tools/save_dossiers.py # odświeża research/saved-dossiers.json — żywe zapytania Cala, tylko ręcznie
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
- `/api/me` — jedno zapytanie Cala na profil „Ty” (ok. 30–60 s), chyba że identyczny prompt (to samo imię i nazwisko, pracodawcy, uczelnie i URL LinkedIn) jest już w `.cache/people.json`. Brak danych to pusta lista, nie błąd. Wywoływany przy każdym zapisie profilu.
- `/api/dossier` — bez Cala dla 6 partnerów z `research/saved-dossiers.json` (`origin: 'saved'`): Magnus Hambleton (byFounders), Ricardo Sequerra Amram (Point Nine), Khaled Helioui i Pierre-Dimitri Gore-Coty (Plural), Jonathan Heiliger (Vertex Ventures US), Yasmin Razavi (Spark Capital). Pozostali wymagają czterech zapytań Cala; każda część trafia do `.cache/people.json`. W Warm intros dossier jest pobierane tylko dla wybranego partnera, nie całej mapy.
- `/api/network` — łączy graf encji Cala (`entities`, introspekcja i szczegóły) oraz `knowledge/query` z wyszukiwaniem OpenAI (`gpt-6-luna` + web search). `counterpart`, `focus` i `focus_people` opisują przeciwną stronę; `identity_orgs` i `profile_url` identyfikują badaną osobę. Encja Cala wymaga zgodnego kontekstu/organizacji lub profilu, a bez danych identyfikujących osoba nie jest wyszukiwana. `enhance` na obu końcach i dla wybranego kontaktu oraz `deep` wymuszają web search; awaria Cala nie blokuje fallbacku. `include_adjacent` dla badanego kontaktu dopuszcza do dwóch dodatkowych, źródłowych pierwszych sąsiadów (wspólne wystąpienie nie dowodzi znajomości); odpowiedni prompt ma odrębny klucz cache. Wyniki AI muszą mieć URL obecny w cytowaniach web search i są oznaczone `inferred` — samo cytowanie nie dowodzi prawdziwości roli. Poszczególne fakty i źródła zachowują `origin`; cache uwzględnia kontekst, przeciwległy cel i focus. W testach automatycznych zawsze mock.
- `/api/rank` — OpenAI (`gpt-6-luna`, bez web search) porządkuje tylko kandydatów z dopuszczonej głębokości względem wybranego celu; przy błędzie działa kolejność lokalna. Cache obejmuje także pełny kontekst kandydatów. W testach zawsze mock.
- Warm intros startuje po wyborze osoby B. Najpierw wzbogaca osobę A i B; dalej `bridgeFrontier` przeszukuje z obu stron, maks. 12 automatycznych rozwinięć po 2 naraz. Początkowy limit to 3 krawędzie; każdy następny poziom wymaga osobnego kliknięcia „Search deeper”. Znaleziona ścieżka z potwierdzonym kontaktem i faktami zatrzymuje automat. Inwestycje między funduszami/spółkami nie rozszerzają kolejki. Wspólna nazwa i organizacja to tylko możliwe dopasowanie tożsamości (`inferred`); samą nazwą ani luźnym dopasowaniem nie wolno scalać osób. „I know this person” wiąże potwierdzenie z konkretnym węzłem; pracodawca jest opcjonalny i musi być wpisany świadomie. Szkoły o rozpoznanym wspólnym mieście mogą mieć krawędź `same-city` (`inferred`); to nie dowód znajomości.
- Wyszukiwanie przyjmuje wyłącznie opis startupu (brak osobnego trybu wyszukiwania cudzej spółki po nazwie). Po zatwierdzeniu wyszukiwania uruchamia się 6-krokowy interaktywny przewodnik (`results-tutorial.tsx` + `tutorial.ts`), który wygasza resztę ekranu maską SVG i podświetla aktualnie omawianą sekcję wraz z wnioskami (m.in. unikanie ślepych zaułków fundowania i funduszy o małej siatce bez mostów do kolejnych rund). Wyniki pomysłu otwierają się domyślnie na Warm intros; pełny graf pojawia się po wyborze celu. Na telefonie wybrana ścieżka jest układana pionowo (`layoutPathVertical`), a pełna sieć zachowuje osobny układ. `tools/e2e-redesign.mjs` sprawdza desktop i mobile, sekcję unikania ślepych zaułków, przewodnik spotlight, profil, import, wybór celu i źródła. `tools/e2e-motion.mjs` sprawdza animacje, interaktywne kroki i ograniczony ruch; wszystkie API są mockowane.
- Wszystkie kontakty LinkedIn pozostają lokalnie w przeglądarce. Po zbadaniu obu końców algorytm ocenia kontakty spoza mapy lokalnie względem celu i wybiera maks. 3 z istotnym sygnałem do dalszego researchu. Lista pozwala wyszukać konkretną osobę lub uruchomić następną trójkę; do Cala/OpenAI trafiają wybrane osoby, nie cały eksport. Każda trójka ma osobny budżet, ale nie zwiększa limitu głębokości. Podobieństwo nazw/firm/stanowisk służy tylko do kolejności, nie jest dowodem. Wyniki ekspansji są wiązane z tożsamością osoby, nie wyłącznie z nietrwałym ID węzła.
- W Warm intros przycisk „Add person” zapisuje ręcznie dodane profile LinkedIn w lokalnym profilu (`manual_people`). Sam URL dodaje odizolowany węzeł, nie potwierdza znajomości ani zatrudnienia; można później dopisać nazwę, oznaczyć osobę jako cel albo jawnie potwierdzić znajomość. URL jest walidowany i służy do dezambiguacji; nazwa jest wymagana przed researchem. Badanie po wyborze celu albo przyciskiem „Search connections” przekazuje wybrany profil do Cala/AI i może zużyć kredyty. `tools/e2e-manual-person.mjs` sprawdza dodawanie, badanie i trwałość na mockach.
- Parser inwestorów (`leadNames`) odrzuca opisy zbiorowe, np. „experts from OpenAI, Anthropic, and DeepMind”: wymienione firmy nie są automatycznie inwestorami ani dowodem udziału każdego pracownika. Niejednoznaczny dalszy fragment listy też jest pomijany. W imporcie LinkedIn podobna, lecz nieidentyczna nazwa organizacji tworzy osobny węzeł i pozbawioną źródła, wnioskowaną relację `possible-org-match`, a nie krawędź zatrudnienia do innej firmy; ten domysł nie rozszerza automatycznego wyszukiwania.
- `.cache/entities.json` — trwały cache grafu encji i wyników OpenAI (klucze `resolve|…`, `graph|…`, `openai|…`, zapis atomowy). Usunięcie pliku wymusza nowe wywołania.
- `/api/me`, `/api/dossier` nie wołają OpenAI; `/api/me`, `/api/dossier`, `/api/network` i `/api/rank` mają limit body 16 KB (pozostałe endpointy 4 KB). W testach automatycznych zawsze je mockuj; `/api/dossier` wolno przepuścić tylko dla 6 zapisanych partnerów.
- `.cache/people.json` — trwały cache surowych wierszy Cala dla trzech powyższych endpointów (zapis atomowy, wpis ważny tylko dla identycznego promptu; w `/api/network` lista `known` nie wchodzi w skład promptu bazowego). Usunięcie pliku wymusza nowe zapytania.
- `tools/save_dossiers.py` — odświeża `research/saved-dossiers.json`: 4 żywe zapytania Cala na partnera, o ile nie ma ich w `.cache/people.json`. Uruchamiaj tylko ręcznie, nigdy w testach. Lista `EXCLUDED` w skrypcie to ręczna kuracja wierszy bez pokrycia w źródle.
- `/api/linkedin` — nie woła Cala, ale przy braku wpisu w `.cache/linkedin.json` woła OpenAI (`gpt-6-luna` + web search, ok. 1 cent za osobę; klucz `OPENAI_API_KEY` w `.env`). Przyjmuje `{name, fund}` (inwestor) albo `{name, company}` (founder). Dla znalezionego profilu serwer pobiera też jego publiczną stronę LinkedIn (jedno żądanie, nagłówek `VCScout/0.1 (link preview)`) i zapisuje zdjęcie z `og:image`. Graf wywołuje endpoint automatycznie dla każdej osoby widocznej na mapie (po 3 naraz) — w testach automatycznych zawsze mockuj.
- `/api/examples` i statyczne pliki — zawsze bezpieczne.

## Wiek zależności npm

Instaluj tylko wersje opublikowane ≥7 dni temu. Każde `npm install`/`npx` uruchamiaj z `npm_config_before=<data odcięcia>`; dla narzędzi npx przypinaj wersję (`npx pkg@x.y.z`), nigdy `@latest`. W `package.json` bez zakresów `latest`/`*`. Trzymaj `web/package-lock.json`.
