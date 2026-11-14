# VCScout

Lokalny prototyp wyszukujący podobne startupy na podstawie opisu pomysłu i pokazujący historię ich rund, inwestorów, osób i źródła.

## Uruchomienie

Potrzebne są Python 3, Node.js 20.19+ lub 22.12+, `curl` oraz klucz Cala zapisany lokalnie jako `CALA_API_KEY` w pliku `.env` (wzór: `.env.example`). Opcjonalny `OPENAI_API_KEY` włącza wyszukiwanie profili LinkedIn osób z funduszy; wyniki są zapisywane w `.cache/linkedin.json`. Frontend to aplikacja React + Vite w katalogu `web/` — jednorazowo zbuduj ją:

```sh
cd web && npm install && npm run build
```

Następnie uruchom w tym katalogu:

```sh
python3 app.py
```

Otwórz http://127.0.0.1:8765. Aplikacja nasłuchuje tylko lokalnie; klucz pozostaje po stronie serwera. Dla 12 wcześniej sprawdzonych startupów korzysta z zapisanych wyników z 14 listopada 2026. Pozostałe nazwy wysyła do Cala — odpowiedź może potrwać około minuty i wykorzystuje kredyty API. Po znalezieniu ścieżek aplikacja automatycznie wyszukuje osoby dla funduszy na mapie (maks. 16 par fundusz–spółka na wyszukiwanie, po 2 naraz); zapisane pary są natychmiastowe, pozostałe to zapytania do Cala. Można to zatrzymać przyciskiem „Zatrzymaj”. Wyniki są tymczasowo zapamiętywane podczas działania serwera; przy braku źródła pojawia się informacja o braku danych. Jeżeli połączenia sieciowe są blokowane, uruchomienie lub zapytania wymagają odpowiednich uprawnień sieciowych.

### Tryb deweloperski

W jednym terminalu `python3 app.py` (w tym katalogu), w drugim `cd web && npm run dev`, potem otwórz http://127.0.0.1:5173 — Vite przekazuje zapytania `/api` do serwera Pythona. Testy logiki: `cd web && npm test`; lint: `cd web && npm run lint`.

Tryb „Mam pomysł” wysyła opis do Cala, proponuje podobne spółki i pobiera ich historie finansowania. Mapa pokazuje inwestorów prowadzących rundy na wybranym etapie oraz inwestorów, którzy prowadzili późniejsze rundy **tej samej podobnej spółki**. Linie oznaczają obserwowaną chronologię, nie potwierdzoną relację lub intro. Kliknij fundusz, a następnie osobę, żeby zobaczyć źródło i edytowalny szkic wiadomości. Tryb „Znam startup” pozwala wyszukać konkretną firmę. Szkic pozostaje w przeglądarce i aplikacja niczego nie wysyła automatycznie. Sekcja „Inne startupy tych funduszy” pokazuje, gdzie trafiały inne startupy z portfela funduszy z mapy: te, które przeszły tę samą ścieżkę (fundusz na Twoim etapie → ten sam kolejny inwestor co podobne spółki) oraz alternatywne ścieżki do innych funduszy. Na mapie linia ciągła to nadal chronologia rund podobnych spółek, a linia przerywana to inne startupy z portfela — niekoniecznie podobne do Twojego pomysłu. Każde wyszukanie to jedno zapytanie do Cala na fundusz (około minuty, zużywa kredyty; przycisk zbiorczy wykonuje do 6 zapytań) i wyniki są zapamiętane do restartu serwera. Przykłady z Cala nie są pełnym portfelem ani statystyką przejść i żadna linia nie oznacza potwierdzonej relacji ani intro.

Widok „Graf powiązań” w zakładce „Mapa inwestorów” pokazuje interaktywny graf w stylu bizraport: węzły to spółki i osoby, a krawędzie to publicznie opisane rundy i powiązania. Trasa dla Twojego pomysłu pozostaje wyróżniona na stałe, a filtr „Tylko trasa” zawęża widok do niej. Pole „Znajdź w grafie” wyszukuje i centruje dowolny węzeł. Przycisk „Zobacz więcej” na funduszu, osobie lub odkrytym startupie wykonuje jedno zapytanie do Cala (około minuty, zużywa kredyty) i dokłada znalezione powiązania do grafu — dla osoby są to inne inwestycje, przy których jest publicznie powiązana z funduszem.

Sekcja „Do weryfikacji” wyszukuje w Cala możliwe konflikty portfela dla maksymalnie sześciu wczesnych inwestorów. Są to wskazówki wymagające sprawdzenia źródeł, a nie ustalona polityka funduszu ani kompletna analiza portfela. Brak wyników nie oznacza braku konfliktów. Ten sam inwestor może być jednocześnie propozycją opartą na historii rund i mieć sygnał możliwego konfliktu. Dopasowanie jest oparte na podobieństwie spółek i historii ich rund, bez potwierdzenia aktualnej aktywności lub polityki inwestycyjnej funduszu; dane i powiązania wymagają sprawdzenia. Opcjonalny cel rundy jest wyświetlany na mapie, ale nie jest porównywany z wielkością inwestycji funduszu.

Źródła i daty należy sprawdzać: [wyniki weryfikacji Cala](research/cala-feasibility.md) opisują znalezione nieścisłości. Wynik przedstawia historię rund, a nie potwierdzenie relacji osobistych czy poleceń.

Możliwą rozbudowę o import kontaktów LinkedIn i rekomendacje warm intro opisuje
[research kontaktów i ścieżek intro](research/linkedin-warm-intros.md), obejmujący eksport CSV, oficjalne API przenoszenia danych, dostawców historii zawodowych i wyniki dodatkowych prób Cala.
Aktualny kierunek to [podłączenie LinkedIna bez CSV](research/linkedin-without-csv.md): Unipile/UniLogin, synchronizacja The Swarm przez rozszerzenie lub oficjalne API DMA.
