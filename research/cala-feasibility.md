# Weryfikacja pomysłu: ścieżki między inwestorami

Stan na **14 listopada 2026, Europe/Warsaw**. Wykonano rzeczywiste zapytania
do API Cala i porównano wybrane odpowiedzi z ogłoszeniami spółek i funduszy.
**Wniosek: jest podstawa do MVP, ale wymagana jest własna normalizacja danych
i kontrola źródeł. Gotowy graf Cala nie zapewnił kompletnej historii inwestycji.**
Klucz zapisano w lokalnym `.env`, pomijanym przez `.gitignore`; odpowiedzi nie
zawierają nagłówków autoryzacji. Zbiorcze wyniki: `research/results-summary.json`.

## Co potwierdza dokumentacja

- `POST /v1/knowledge/query` zwraca wiersze JSON i encje. Pola wierszy zależą od
  zapytania; dokumentacja nie gwarantuje stałego schematu danych o rundach.
  [Query](https://docs.cala.ai/api-reference/query)
- Typy encji obejmują `Person`, `FundingRound` i `PrivateCompanyFundingRound`.
  Samo istnienie typu nie dowodzi pokrycia konkretnej firmy lub rundy.
  [Query](https://docs.cala.ai/api-reference/query)
- `POST /v1/knowledge/search` udostępnia odpowiedź, kontekst i wyjaśnienia.
  Przykład odpowiedzi zawiera odwołania przez identyfikatory. Trzeba sprawdzić,
  jak wyniki wiążą odwołania z dokumentami. Test potwierdził obecność adresów
  w `context[].origins[].document.url`; same wiersze query nie zawsze mają
  poprawne i wystarczająco szczegółowe linki.
  [Search](https://docs.cala.ai/api-reference/search)
- Introspekcja pozwala odkryć dostępne relacje konkretnej encji, a pobieranie encji
  obsługuje właściwości i relacje ze źródłami oraz stronicowanie relacji.
  [Introspection](https://docs.cala.ai/api-reference/entity-introspection),
  [Retrieve entity](https://docs.cala.ai/api-reference/entities)

## Przykłady kontrolne z publicznych źródeł

To wybrane przykłady dowodzące istnienia danych, nie reprezentatywna próba rynku.
Nie dowodzą też, że którykolwiek inwestor zapewnił intro do kolejnego funduszu.

| Spółka | Wcześniejsza runda | Późniejsza runda | Źródła |
| --- | --- | --- | --- |
| Qdrant | 19.04.2023: seed 7,5 mln USD, lead Unusual Ventures | 23.01.2024: Series A 28 mln USD, lead Spark Capital; udział dotychczasowych Unusual Ventures i 42CAP | [Seed](https://qdrant.tech/blog/seed-round/), [Series A](https://qdrant.tech/blog/series-a-funding-round/) |
| Attio | 11.2021: seed 7,7 mln USD, lead Point Nine; m.in. Balderton, Headline i dotychczasowy Passion Capital | 03.2023: Series A 23,5 mln USD, Redpoint jako nowy inwestor; udział dotychczasowych Balderton i Point Nine | [Seed](https://attio.com/blog/seed-round), [Series A](https://attio.com/blog/series-a-round) |
| Metaview | 01.12.2021: seed 6 mln USD, lead Vertex Ventures US; m.in. Fly Ventures, Seedcamp i Village Global | 28.03.2024: Series A 7 mln USD, lead Plural; m.in. Vertex Ventures US, Seedcamp i Village Global | [Seed](https://www.metaview.ai/resources/blog/weve-raised-a-6m-seed-to-power-people-decisions-with-truth), [Series A](https://www.metaview.ai/resources/blog/fresh-capital-announcement) |

Metaview daje dodatkowy krok: 25.06.2025 ogłosił Series B 35 mln USD prowadzoną
przez GV, z udziałem m.in. Plural, Vertex Ventures, Seedcamp i Coelius Capital.
[Ogłoszenie spółki](https://www.metaview.ai/resources/blog/series-b)

## Osoby: fakty i ograniczenia

- **Jonathan Heiliger, Vertex Ventures US**: ogłoszenie seed Metaview z 2021
  wprost wskazuje go jako osobę prowadzącą tę inwestycję. To historyczna rola;
  aktualne zatrudnienie wymaga osobnego sprawdzenia.
  [Źródło](https://www.metaview.ai/resources/blog/weve-raised-a-6m-seed-to-power-people-decisions-with-truth)
- **Khaled Helioui, Plural**: autor tekstu funduszu o inwestycji w Metaview,
  opublikowanego 28.03.2024. To udokumentowany związek z tezą inwestycyjną;
  samo autorstwo nie dowodzi prowadzenia transakcji ani aktualnej roli.
  [Źródło](https://www.pluralplatform.com/features/why-we-invested-in-metaview)
- **Ricardo Sequerra Amram**: autor ogłoszenia Point Nine o inwestycji w Attio
  z 24.11.2021. Nie należy automatycznie przedstawiać go jako aktualnego kontaktu
  w Point Nine bez sprawdzenia obecnej roli.
  [Źródło](https://writing.pointnine.com/p/the-business-built-crm)

## Procedura testowa

Skrypt `tools/probe_cala.py` wykonuje sześć wywołań: dla każdej z trzech spółek
jedno zapytanie o strukturalną historię rund oraz jedno o źródła i osoby.
Zapisuje odpowiedzi bez nagłówków autoryzacji. Sukces HTTP nie jest oceną
prawdziwości ani kompletności danych.

```sh
python3 tools/probe_cala.py --dry-run
python3 tools/probe_cala.py
```

Klucz: zmienna środowiskowa `CALA_API_KEY` albo wpis `CALA_API_KEY=...` w `.env`.
Plik `.gitignore` pomija lokalne pliki z kluczami.

Kryteria oceny:

1. Czy każdą z trzech ścieżek można odtworzyć z datami i inwestorami właściwymi
   dla danej rundy? Osobno ocenić liderów i pozostałych uczestników.
2. Czy źródło rzeczywiście potwierdza każdą krawędź? Sam link lub identyfikator
   źródła nie wystarcza.
3. Czy powtarzający się inwestor ma spójny identyfikator encji?
4. Czy osoby mają udokumentowaną rolę w inwestycji, a rekomendowane kontakty
   aktualne powiązanie z funduszem? Brak danych jest dopuszczalnym wynikiem.
5. Jaka jest latencja i czy wyniki pozwalają zbudować wygodny proces wyszukiwania?

Rozszerzony test objął Granolę, Lightdash, incident.io, Dust, Langfuse, n8n,
Sana Labs, ElevenLabs i Lovable, łącznie z trzema spółkami kontrolnymi 12 firm.
To celowo dobrana próba europejskiego ekosystemu software, w większości firm
dobrze opisanych. Nie stanowi reprezentatywnego testu pokrycia rynku.

## Wyniki rzeczywistych zapytań

Wykonano **15 wywołań knowledge API**. Wszystkie miały HTTP 200, ale **3 nie
odpowiedziały na pytanie**, zwracając komunikat o zbyt dużej złożoności.
Po rozbiciu pytań uzyskano dane o rundach **12/12 spółek**: 30 wierszy z datą
i jeden wiersz opisujący brak osobnej Series A Langfuse. To wynik pobrania danych,
**nie deklaracja ich stuprocentowej poprawności**. Nie zweryfikowano każdego
inwestora w każdej zwróconej rundzie.

Dla 11 spółek zwrócono wczesną rundę oraz Series A. Langfuse został przejęty
przez ClickHouse w styczniu 2026; brak osobnej Series A nie jest sam w sobie
błędem pokrycia. [Langfuse](https://langfuse.com/blog/joining-clickhouse),
[ogłoszenie przejęcia](https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability).

Główni inwestorzy oraz kolejność rund w trzech przypadkach kontrolnych były
zgodne z ogłoszeniami wskazanymi wyżej. Dodatkowo Cala zwróciła ścieżkę
**byFounders/Hummingbird → Lovable → Accel**, potwierdzoną historią inwestycji
samego byFounders. Inwestycja pre-seed miała miejsce w 2023, a została ogłoszona
w 2024; produkt musi rozróżniać te daty.
[Historia inwestycji](https://www.byfounders.vc/insights/lovable-a-photo-journey-of-day-0-to-year-2).

### Samodzielne odkrywanie powiązań funduszy

Zapytanie o maksymalnie pięć firm software, w których Seedcamp zainwestował
przed Accel, zwróciło UiPath, Synthesię i Itch:

- **UiPath**: wcześniejsze wejście Seedcamp w 2015 i Series A Accel w 2017
  potwierdzają [Seedcamp](https://seedcamp.com/views/another-european-unicorn-uipath-raises-153m-eclipses-1-1bn-valuation/)
  i [Accel](https://www.accel.com/companies/uipath).
- **Synthesia**: Seedcamp w 2019 i Accel w 2023 potwierdzają
  [Seedcamp](https://seedcamp.com/views/synthesia-raises-3-1-million-to-deliver-the-first-ai-video-synthesis-platform-to-customers/)
  i [Accel](https://www.accel.com/news/ai-generated-video-for-the-enterprise-our-investment-in-synthesia).
  Cala dopisała jednak do nazwy wcześniejszej rundy kwotę 3,8 mln USD, podczas
  gdy źródło Seedcamp podaje **3,1 mln USD**.
- **Itch** nie spełnia filtra software: Seedcamp opisuje go jako markę produktów
  dla zwierząt. Nie zweryfikowano wejścia Accel; tego wyniku nie należy pokazywać
  jako potwierdzonej ścieżki.
  [Opis portfolio](https://seedcamp.com/views/the-year-that-was-seedcamp-2019-year-in-review/).
- Pominięto **Hopin**, choć Seedcamp wprost opisuje swój pre-seed z 2019 i kolejną
  rundę prowadzoną przez Accel.
  [Źródło](https://seedcamp.com/views/hop-in-to-the-future-of-events-as-hopin-raises-6-5m/).

Mechanizm odnajdywania ścieżek działa na części przykładów. Liczba znalezionych
firm nie może być traktowana jako rzeczywista częstość przejść między funduszami.

### Kontakty

Rozbudowane pytania łączące historię rund, źródła, osoby i aktualne zatrudnienie
zakończyły się odmową dla Attio i Metaview. Osobne krótkie pytania o konkretny
fundusz i inwestycję zakończyły się odpowiedziami:

- **Ricardo Sequerra / Ricardo Sequerra Amram, Point Nine**. Cala wskazała cytat
  w ogłoszeniu Attio. Związek z inwestycją potwierdza też
  [ogłoszenie Attio z 2024](https://attio.com/blog/attio-raises-33-million-in-funding),
  a aktualną rolę — [zespół Point Nine](https://www.pointnine.com/team).
- **Khaled Helioui, Plural**. Cala wskazała komentarz przy inwestycji Metaview.
  Potwierdzenie: [jego tekst funduszu](https://www.pluralplatform.com/features/why-we-invested-in-metaview)
  i [profil zespołu](https://www.pluralplatform.com/team/khaled-helioui).
- **Pierre-Dimitri Gore-Coty, Plural**. Cala wskazała rolę w boardzie Metaview
  na podstawie SEC i dołączenie do Plural w 2025. Metaview pojawia się też w
  [jego profilu Plural](https://www.pluralplatform.com/team/pierre-dimitri-gore-coty).

Cala zwróciła także Yasmin Razavi ze Spark jako osobę cytowaną przy Series A
Qdrant oraz Amra Awadallaha jako anioła. Cytat lub autorstwo tekstu nie dowodzą
prowadzenia transakcji. Nie badano dostarczalności maili ani nie wysyłano wiadomości.

### Ograniczenia wymagające obsługi w produkcie

1. **Błędne daty i kwoty.** Cala podała 17 maja 2023 jako ogłoszenie Series A
   ElevenLabs. [Ogłoszenie spółki](https://elevenlabs.io/blog/elevenlabs-launches-new-generative-voice-ai-products-and-announces-19m-series-a-round-led-by-nat-friedman-daniel-gross-and-andreessen-horowitz)
   jest datowane na **20 czerwca 2023**. Osobno potwierdzono wspomniany błąd
   kwoty rundy Synthesii.
2. **Niepełne relacje grafu.** Trzy sprawdzone encje Qdrant — spółka, organizacja
   i produkt — nie miały relacji rund/inwestorów, mimo dostępnej historii przez
   knowledge API. Attio miało siedem relacji do rund, ale sprawdzona Series A
   zawierała wśród inwestorów tylko Balderton, pomijając Redpoint i Point Nine.
   Dane Metaview były rozdzielone między brytyjską i amerykańską spółkę.
3. **Różne znaczenia dat.** Encja Series A Attio ma `event_date` 02.02.2023,
   a knowledge API podaje ogłoszenie 02.03.2023. Daty zamknięcia, zdarzenia
   i publicznego ogłoszenia wymagają oddzielnej interpretacji.
4. **Struktura wymaga normalizacji.** Inwestorzy i źródła występują jako tekst
   rozdzielany przecinkami lub średnikami; daty mają różną precyzję i format.
   W niektórych wierszach lista inwestorów zawiera lidera, a w innych go pomija.
   Wiersz o braku Series A Langfuse ma opis zamiast linku w `source_urls`.
5. **Źródła nie są automatycznym potwierdzeniem.** Trafiają się agregatory,
   ogólne strony serwisów i niepełne dane. Każda pokazywana krawędź powinna
   prowadzić do dokumentu rzeczywiście potwierdzającego twierdzenie.
6. **HTTP 200 nie oznacza odpowiedzi.** Odmowa wystąpiła także jako
   `results[0].error`. Skrypty rozpoznają teraz taki stan oddzielnie od sukcesu HTTP.

### Czas odpowiedzi

- Odczyty grafu przez curl: **0,4–2 s**, mediana około **0,74 s**.
- Knowledge API przez curl: **14–86 s**, mediana około **45 s**, uwzględniając odmowy.
- Wystąpił jeden HTTP 429 przy serii szybkich odczytów. To nie wyznacza dokładnego
  limitu usługi; implementacja potrzebuje cache, kolejki i obsługi ponowień.
- Pierwsze odczyty przez urllib trwały dłużej przez sposób zestawiania połączenia
  w tym środowisku i zostały wyłączone z powyższego porównania.

### Zalecany zakres MVP

Pobrać i cache'ować rundy dla jednego profilu foundera, sektora i geografii.
Budować własny graf `fundusz → runda → spółka → następna runda → fundusz`
z ujednoliconych odpowiedzi Cala. Pokazywać kilka ścieżek z dowodami oraz
aktualnym kontaktem wyszukanym osobnym pytaniem. Najpierw oceniać dopasowanie
funduszu do obecnej rundy, dopiero potem jego historię kolejnych inwestorów.
Duże fundusze również inwestują wcześnie: n8n miało seed prowadzony przez
Sequoię, a Series A przez Felicis. [Źródło n8n](https://n8n.io/press/).

**Warto budować ograniczone MVP.** Nie potwierdzono kompletności całego rynku,
przyczynowego wpływu inwestora na kolejną rundę ani gotowości founderów do płacenia.
Nie ma podstaw do obiecywania intro lub wyświetlania niekalibrowanych procentów szans.

Surowe dane: `research/cala-runs/`. Metryki i wiersze rund:
`research/results-summary.json`. Plany dodatkowych testów:
`research/focused-checks.json` i `research/single-company-checks.json`.
