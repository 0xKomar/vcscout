# VCScout

Lokalny prototyp wyszukujący podobne startupy na podstawie opisu pomysłu i pokazujący historię ich rund, inwestorów, osób i źródła.

## Uruchomienie

Potrzebne są Python 3, `curl` oraz klucz Cala zapisany lokalnie jako `CALA_API_KEY` w pliku `.env` (wzór: `.env.example`). Uruchom w tym katalogu:

```sh
python3 app.py
```

Otwórz http://127.0.0.1:8765. Aplikacja nasłuchuje tylko lokalnie; klucz pozostaje po stronie serwera. Dla 12 wcześniej sprawdzonych startupów korzysta z zapisanych wyników z 14 listopada 2026. Pozostałe nazwy wysyła do Cala — odpowiedź może potrwać około minuty i wykorzystuje kredyty API. Przy każdym inwestorze prowadzącym aplikacja pokazuje powiązane osoby: korzysta ze sprawdzonych przykładów albo wykonuje dodatkowe zapytanie do Cala dla każdej pary startup–fundusz. Wyniki są tymczasowo zapamiętywane podczas działania serwera; przy braku źródła pojawia się informacja o braku danych. Jeżeli połączenia sieciowe są blokowane, uruchomienie lub zapytania wymagają odpowiednich uprawnień sieciowych.

Tryb „Mam pomysł” wysyła opis do Cala, proponuje podobne spółki i pobiera ich historie finansowania. Mapa pokazuje inwestorów prowadzących rundy na wybranym etapie oraz inwestorów, którzy prowadzili późniejsze rundy **tej samej podobnej spółki**. Linie oznaczają obserwowaną chronologię, nie potwierdzoną relację lub intro. Kliknij fundusz, a następnie osobę, żeby zobaczyć źródło i edytowalny szkic wiadomości. Tryb „Znam startup” pozwala wyszukać konkretną firmę. Szkic pozostaje w przeglądarce i aplikacja niczego nie wysyła automatycznie.

Sekcja „Do weryfikacji” wyszukuje w Cala możliwe konflikty portfela dla maksymalnie sześciu wczesnych inwestorów. Są to wskazówki wymagające sprawdzenia źródeł, a nie ustalona polityka funduszu ani kompletna analiza portfela. Brak wyników nie oznacza braku konfliktów. Ten sam inwestor może być jednocześnie propozycją opartą na historii rund i mieć sygnał możliwego konfliktu. Dopasowanie jest oparte na podobieństwie spółek i historii ich rund, bez potwierdzenia aktualnej aktywności lub polityki inwestycyjnej funduszu; dane i powiązania wymagają sprawdzenia. Opcjonalny cel rundy jest wyświetlany na mapie, ale nie jest porównywany z wielkością inwestycji funduszu.

Źródła i daty należy sprawdzać: [wyniki weryfikacji Cala](research/cala-feasibility.md) opisują znalezione nieścisłości. Wynik przedstawia historię rund, a nie potwierdzenie relacji osobistych czy poleceń.

Możliwą rozbudowę o import kontaktów LinkedIn i rekomendacje warm intro opisuje
[research kontaktów i ścieżek intro](research/linkedin-warm-intros.md), obejmujący eksport CSV, oficjalne API przenoszenia danych, dostawców historii zawodowych i wyniki dodatkowych prób Cala.
