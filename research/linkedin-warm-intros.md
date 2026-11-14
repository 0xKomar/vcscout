# LinkedIn i warm intro w VCScout — research wykonalności

Stan na **14 listopada 2026, Europe/Warsaw**. Sprawdzono kod VCScout,
aktualną dokumentację dostawców i publiczne źródła oraz wykonano dwa zapytania
do Cala. To research i propozycja implementacji; funkcja nie została wdrożona.

**Aktualizacja wymagań: integracja ma działać bez CSV. Aktualna rekomendacja
to Unipile + UniLogin i wspólne kontakty wyszukiwane dla wybranego partnera;
alternatywnie The Swarm z synchronizacją przez rozszerzenie. Szczegóły i źródła:
[warianty bez CSV](linkedin-without-csv.md).** Poniższy dokument zachowuje
porównanie źródeł i wyniki prób Cala; pierwotny plan importu został zastąpiony.

## 1. Co już mamy i czego brakuje

W `app.py` endpoint `/api/partners` znajduje maksymalnie trzy osoby publicznie
powiązane z inwestycją konkretnego funduszu w konkretny startup. Zwraca nazwisko,
rolę, opis związku i źródło; część przykładów jest zapisana w `PARTNERS`.
`web/app.js` pokazuje osobę i edytowalny szkic wiadomości, a `web/paths.js`
wykorzystuje ten sam panel w mapie funduszy.

Nie mamy importu kontaktów, trwałej bazy osób, identyfikatorów profili LinkedIn,
historii zatrudnienia ani grafu osobistych relacji. Nazwy funduszy i osób są
głównie tekstem. Obecne linie między funduszami pokazują kolejne rundy tej samej
spółki; nie dowodzą osobistego kontaktu ani wykonania intro.

Rozbudowa powinna odpowiadać na trzy osobne pytania:

1. **Do kogo dotrzeć?** Aktualnie właściwy partner, jego profil i związek
   z inwestycją lub obszarem zainteresowań.
2. **Przez kogo?** Konkretna osoba z własnej sieci, z dowodem lub przesłanką
   związku z partnerem.
3. **Dlaczego właśnie przez tę osobę?** Wspólna praca w określonym okresie,
   inwestycja w jej spółkę, board, potwierdzony kontakt albo własna deklaracja.

## 2. Jak uzyskać własną sieć z LinkedIna

### A. Archiwum i Connections.csv — opcja wykluczona z obecnego zakresu

Oficjalny eksport zawiera imię, nazwisko, publiczny adres profilu, firmę,
stanowisko, datę połączenia i czasem e-mail. Adresy e-mail zależą od ustawień
kontaktów. Eksport obejmuje kontakty pierwszego stopnia. Aktualna instrukcja
eksportu kontaktów prowadzi przez pobranie większego archiwum konta.
[Eksport kontaktów](https://www.linkedin.com/help/linkedin/answer/a566336/exporting-connections-from-linkedin),
[zakres plików archiwum](https://www.linkedin.com/help/linkedin/answer/a1339364/downloading-your-account-data?lang=en).

Do VCScout wystarczy wybrać z archiwum sam `Connections.csv`. Pozwala to
od razu znaleźć partnerów będących już kontaktami, znajomych pracujących w
docelowym funduszu i znajomych founderów spółek z jego portfela. Jest to stan
danych z eksportu, więc aktualną rolę rekomendowanego kontaktu trzeba sprawdzić.

**Eksport nie zawiera sieci znajomych Twoich znajomych ani pełnej historii ich
zatrudnienia.** Plik `Positions` opisuje historię właściciela konta. Data
połączenia nie oznacza daty ostatniej rozmowy ani bliskiej znajomości.

### B. Member Data Portability API — realna oficjalna opcja dla EOG

Nie należy kończyć researchu na stwierdzeniu „LinkedIn nie ma API kontaktów”.
LinkedIn udostępnia odrębny program przenoszenia danych. Dokumentacja domen
Snapshot zawiera `CONNECTIONS`: nazwę osoby, stanowisko, firmę i datę połączenia
pierwszego stopnia. `POSITIONS` nadal dotyczy właściciela konta, a `CONTACTS`
oznacza kontakty zaimportowane do LinkedIna.
[Program](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/),
[domeny danych](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/snapshot-domain).

Istnieją dwa różne tryby:

| Tryb | Zastosowanie | Warunki z dokumentacji |
| --- | --- | --- |
| Member | Własne konto, dobry kandydat do lokalnego VCScout | Konto w EOG lub Szwajcarii; aplikacja z dedykowaną domyślną Company Page; akceptacja warunków i wygenerowanie tokenu |
| 3rd Party | Produkt, w którym inni użytkownicy podłączają swoje konta | Zweryfikowana Company Page, dane firmy, biznesowy e-mail, witryna i polityka prywatności; przegląd wniosku przez LinkedIn i zgoda użytkownika; dokumentacja techniczna wskazuje użytkowników EOG |

Źródła: [Member](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-member/),
[3rd Party](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-3rd-party/).

Dla profilu z lokalizacją w Polsce warunek regionalny powinien być spełniony;
nie sprawdzono ustawień ani uprawnień Twojego konta. Ogólny help wymienia także
Szwajcarię, podczas gdy opis zgody w wariancie 3rd Party mówi o EOG. Przy
rozszerzaniu produktu poza EOG trzeba potwierdzić faktyczny zakres.
[Help programu](https://www.linkedin.com/help/lms/answer/a6214075).

Technicznie Snapshot używa `GET /rest/memberSnapshotData?q=criteria&domain=CONNECTIONS`.
Dokumentacja wymaga nagłówka `Linkedin-Version: 202312`, mimo nowszych dat
aktualizacji stron. Dane powstają asynchronicznie i wymagają stronicowania.
[Member Snapshot API](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-snapshot-api).

W dokumentacji występuje rozbieżność nazw scope dla trybu osobistego:
instrukcja konfiguracji wskazuje `r_dma_portability_self_serve`, a tabela
Snapshot — `r_dma_portability_member`. W próbie integracji trzeba zweryfikować
scope przyznany rzeczywistej aplikacji. Nie zakładamy też, że wszystkie pola
z CSV, w szczególności URL profilu, będą identycznie dostępne w odpowiedzi API.

Changelog udostępnia zdarzenia od chwili zgody i z ostatnich 28 dni. Nie jest
pełną historyczną bazą relacji ani automatycznym dowodem pokrycia zmian kontaktów.
[Member Changelog API](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-changelog-api).

### C. Standardowe API i Sales Navigator

Zwykły „Sign in with LinkedIn” daje dane logującego się użytkownika, bez jego
sieci. Osobne Connections API wymaga zatwierdzenia LinkedIna i nie pozwala
pobierać kontaktów drugiego stopnia. Integracje Sales Navigator wymagają
programu SNAP; zakup abonamentu nie przyznaje dowolnego dostępu API.
[Otwarte uprawnienia i SNAP](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access),
[Connections API](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/connections-api).

Sam Sales Navigator jest użyteczny do ręcznej weryfikacji. TeamLink pokazuje
powiązania zespołu i wymaga Advanced lub Advanced Plus. LinkedIn opisuje też
nowe rekomendacje ścieżek z uzasadnieniem w wydaniu z lipca–września 2026.
To gotowy punkt odniesienia do oceny jakości naszych wyników, bez zakładania
możliwości eksportu tego grafu do VCScout.
[TeamLink](https://www.linkedin.com/help/sales-navigator/answer/a101027/teamlink-overview?lang=en),
[release notes 2026](https://www.linkedin.com/help/sales-navigator/answer/a16010005).

Nie rekomenduję oparcia integracji na ciasteczku sesji i scraperze konta.
LinkedIn zabrania takich automatycznych odczytów i wskazuje ryzyko ograniczenia
lub zamknięcia konta oraz nagłego wyłączenia narzędzia.
[Oficjalna informacja](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions).

## 3. Skąd wziąć historyczne powiązania

### Cala i publiczne źródła

Cala już zasila VCScout. Query obsługuje pytania o ludzi i strukturalne wyniki,
ale schemat zależy od pytania. Introspekcja pozwala sprawdzić dostępne relacje
konkretnej encji; sama dokumentacja nie gwarantuje kompletnej historii osób.
[Query](https://docs.cala.ai/api-reference/query),
[Introspekcja](https://docs.cala.ai/api-reference/entity-introspection).

**Wykonany test:** dwa zapytania osiągnęły API, oba HTTP 200 i odpowiedź z danymi:

| Próba | Wynik | Znaczenie dla produktu |
| --- | --- | --- |
| Profil Ricardo Sequerra Amrama | Point Nine, Partner; `linkedin_url: null`; ok. 30,7 s | Cala nie dostarczyła adresu profilu w tym przykładzie; potrzebne osobne ustalanie tożsamości |
| Historia Khaleda Heliouiego | Pięć wierszy, m.in. Plural, Bigpoint i TA Associates; ok. 32,9 s | Są kandydaci do wyszukiwania wspólnej historii; daty, podmioty i źródła wymagają weryfikacji |

Surowe odpowiedzi:
[profil partnera](cala-runs/warm-intro-20261114T002425Z/partner-profile.json),
[historia zawodowa](cala-runs/warm-intro-20261114T002425Z/partner-career.json).
Wcześniejsza próba w ograniczonym środowisku zakończyła się błędem DNS i nie
jest pomiarem jakości Cala.

Aktualną rolę Ricardo potwierdza oficjalny zespół Point Nine. Biografia Khaleda
w Plural potwierdza rozpoczęcie pracy w Bigpoint w 2012 i późniejszą rolę CEO;
nie potwierdza wszystkich dokładnych dat zwróconych przez Cala. Wiersza
„Plural France” ani pozostałych niezweryfikowanych szczegółów nie należy
automatycznie przyjmować do grafu.
[Point Nine](https://www.pointnine.com/team),
[biografia Plural](https://www.pluralplatform.com/team/khaled-helioui).

Publiczne wyszukiwanie znalazło też konkretne profile osób już obecnych w appce:

| Osoba | Profil LinkedIn | Dowód związku z inwestycją |
| --- | --- | --- |
| Ricardo Sequerra Amram | [Profil](https://de.linkedin.com/in/ricardosequerra) | [Attio wskazuje Ricardo przy ponownej inwestycji Point Nine](https://attio.com/blog/attio-raises-33-million-in-funding) |
| Khaled Helioui | [Profil](https://uk.linkedin.com/in/khaledhelioui) | [Autor tekstu Plural o inwestycji w Metaview](https://www.pluralplatform.com/features/why-we-invested-in-metaview) |

Są to osoby docelowe, a nie ustalone kontakty w Twojej sieci. Autorstwo tekstu
jest dowodem związku z inwestycją, bez automatycznego dowodu prowadzenia rundy.

### The Swarm — najbardziej dopasowany dostawca do pilotażu

The Swarm przyjmuje import kontaktów LinkedIn i dokłada wspólną historię pracy,
edukacji oraz sygnały inwestorskie. Dokumentacja endpointu
`POST https://bee.theswarm.com/v3/relationships` opisuje zwracanie kontaktów
powiązanych z własnym zespołem, nazw pośredników i źródeł takich jak
`linkedin_connection`, `work_overlap`, `email_contact` i `shared_investor`.
Można rozdzielić potwierdzone połączenie od wnioskowania na podstawie pracy.
[Importy](https://www.theswarm.com/pricing),
[Relationships](https://docs.theswarm.com/docs/intelligence/relationships).

Według help center Premium 50 kosztuje **99 USD/miesiąc**, obejmuje
**50 connectors i 1000 kredytów API/miesiąc**; Free nie ma API. Wywołania
Relationships nie zużywają kredytów, ale pobieranie profili i odświeżanie danych
mogą je zużywać. Strona marketingowa pokazuje w tym samym obszarze 12 000
kredytów; help wskazuje 1000 miesięcznie i pulę roczną przy planie rocznym.
Do kalkulacji przyjmuję ostrożniejszą wartość z help, do potwierdzenia przy zakupie.
[Plany i rozliczenia](https://help.theswarm.com/en/articles/14121950-plans-billing-connector-limits-and-api-credits).

„Connector” to osoba, przez którą szukamy dojścia, a nie każdy wynik w jej sieci.
Dodawanie setek własnych znajomych jako osobnych connectorów może wymagać
wyższego planu. Dodanie adresu profilu nie oznacza uzyskania prywatnej sieci tej
osoby: mapowanie z biografii trzeba odróżnić od kontaktów udostępnionych przez nią.
[Definicja planów](https://help.theswarm.com/en/articles/14121950-plans-billing-connector-limits-and-api-credits),
[warstwy danych](https://docs.theswarm.com/docs/getting-started/introduction).

Ważne rozróżnienie: zwykłe Relationships odpytuje własny zespół. Osobny
**Network Mapper** dla mapowania firm oraz zarządzanie wieloma zespołami
wymagają uprawnień partnerskich. Nie należy zakładać, że abonament za 99 USD
obejmuje wieloużytkownikowy produkt VCScout z dowolnym mapowaniem klientów.
[Network Mapper](https://docs.theswarm.com/docs/intelligence/network-mapper),
[zarządzanie connectorami](https://docs.theswarm.com/docs/team-management/connector).

Ocena dopasowania jest wnioskiem z dokumentacji, nie wynikiem testu pokrycia
Twojej sieci. Nie założono konta ani nie wysłano danych kontaktów do The Swarm.

### Alternatywy

| Opcja | Co wnosi | Ocena dla obecnego VCScout |
| --- | --- | --- |
| People Data Labs | Ustalanie profilu z URL lub danych identyfikujących; historia pracy, firmy i daty | Rozsądny komponent, jeśli chcemy sami liczyć pokrywanie się zatrudnienia; nie traktować go jako źródła prywatnego grafu LinkedIna |
| Affinity | Gotowe ścieżki i siła relacji z korespondencji i kalendarza zespołu | Bardziej rozbudowany CRM; sensowniejszy, jeśli organizacja już go ma |
| Sales Navigator | Widoczne w LinkedIn ścieżki do osób i TeamLink | Przydatny do ręcznej kontroli rekomendacji; integracja API jest osobnym programem |

PDL opisuje `experience` z datami i firmą; obsługuje dopasowanie po adresie
profilu oraz próg jakości identyfikacji. To jakość dopasowania tożsamości,
nie prawdopodobieństwo udanego intro. Nie testowano jego pokrycia ani ceny
dla wymaganego pakietu pól.
[PDL: parametry](https://docs.peopledatalabs.com/docs/input-parameters-person-enrichment-api),
[PDL: historia pracy](https://docs.peopledatalabs.com/docs/fields#experience).

Affinity wykorzystuje m.in. świeżość i częstotliwość kontaktów. Cennik zaczyna
się od **2000 USD/użytkownika/rok**, a dostęp API i integracje należy dobrać
do konkretnego planu. To większy zakup niż sam moduł kontaktów.
[Relacje w Affinity](https://www.affinity.co/product/relationship-intelligence),
[cennik](https://www.affinity.co/product/affinity-pricing).

## 4. Jak powinien wyglądać wynik dla użytkownika

Po wybraniu partnera panel „Jak dotrzeć” powinien pokazać:

- osobę docelową, aktualny fundusz i profil LinkedIn;
- konkretnego znajomego, do którego można napisać;
- podstawę: np. „pracowali w Bigpoint w pokrywającym się okresie”;
- źródła, daty i informację, co pozostaje do potwierdzenia;
- edytowalny szkic prośby o intro i własną ocenę „znam dobrze / słabo / nie znam”.

Przykład warunkowy: **Ty → znajomy z Bigpoint → Khaled Helioui → Plural**.
Publiczna biografia potwierdza związek Khaleda z Bigpoint. Jeśli Twój znajomy
pracował tam w odpowiednim czasie, mamy przesłankę do pytania „czy znasz
Khaleda i czy mógłbyś nas przedstawić?”. Nie mamy dowodu znajomości, dopóki
nie potwierdzi jej osoba lub inne właściwe źródło.

Należy rozróżnić:

| Sytuacja | Uczciwa etykieta |
| --- | --- |
| Partner znajduje się w Twoim eksporcie | „Masz go w kontaktach” |
| Znajomy potwierdził, że zna partnera i może przedstawić | „Potwierdzona możliwość intro” |
| Dwie osoby pracowały w tej samej firmie w tym samym okresie | „Możliwa wspólna praca — zapytaj” |
| Twój znajomy jest founderem spółki, w którą inwestował dany partner | „Udokumentowany związek inwestycyjny — zapytaj o intro” |
| Dwa fundusze inwestowały w tę samą spółkę | „Historia inwestycji”, bez automatycznego wniosku o relacji osób |

Wspólna firma bez pokrywających się dat, sam udział w dużym wydarzeniu lub
ta sama branża nie wystarczają do stwierdzenia znajomości. Nie pokazywać
procentów „szans na intro” na podstawie samego score dostawcy.

## 5. Pierwotny zakres implementacji — zastąpiony wariantem bez CSV

To archiwalna propozycja techniczna, a nie funkcje już istniejące.
Obecny kierunek opisuje [plan bez CSV](linkedin-without-csv.md):

1. **Import i dopasowanie lokalne.** Parser `Connections.csv`, podgląd liczby
   rekordów, aktualizacja po kolejnym imporcie, usunięcie importu. Obsłużyć BOM,
   notatki przed nagłówkiem, puste maile i brakujące pola. Nowy upload wymaga
   własnego limitu; obecny limit POST 4096 bajtów nie wystarczy na CSV.
2. **Tożsamość partnerów.** Rozszerzyć `/api/partners` o stabilne ID, URL
   LinkedIn, osobne źródło aktualnej roli i datę weryfikacji. Łączyć rekordy
   przede wszystkim po profilu/ID; sama zgodność nazwiska jest kandydatem,
   nie automatycznym scaleniem. Normalizować także aliasy funduszy i domeny.
3. **Dane historyczne.** Osobno zapisywać role i okresy zatrudnienia. W pierwszym
   pilocie wzbogacić tylko wybranych znajomych oraz partnerów, zamiast od razu
   całego eksportu. Publiczne dane partnerów mogą pochodzić z Cala i biografii;
   dane znajomych wymagają własnego źródła lub wybranego dostawcy.
4. **Ścieżki i panel.** Nowy endpoint, np. `/api/intros`, zwraca listę
   pośredników, powody, źródła i stan weryfikacji. Początkowo najwyżej jeden
   pośrednik między Tobą a partnerem; wspólna praca jest przesłanką, a nie
   krawędzią „znają się”. Panel można dołożyć do istniejącego `showPerson`.
5. **Ranking.** Oddzielić pewność tożsamości od siły relacji. Uwzględnić
   zadeklarowaną znajomość z pośrednikiem, jakość jego związku z partnerem,
   świeżość dowodów, pokrywanie się okresów i aktualną rolę partnera.

SQLite z tabelami osób, organizacji, afiliacji, kontaktów i dowodów wystarczy
do pierwszego lokalnego MVP. Dane własnej sieci powinny pozostawać poza
`research/` i repozytorium; nie trzeba wysyłać całego CSV do Cala. Jeśli później
potrzebne będzie mierzenie świeżości relacji, można dodać osobny import lub
integrację metadanych rozmów. Sam LinkedIn connection tego nie mierzy.

## 6. Decyzja i próba akceptacyjna

**Pierwsza wersja bez CSV:** podłączenie konta przez Unipile/UniLogin,
istniejący wybór partnerów i lista wspólnych kontaktów pobierana na żądanie.
Alternatywa: The Swarm z rozszerzeniem i API gotowych relacji.

**Kolejny krok:** próba na kilku partnerach już obecnych w VCScout oraz
porównanie zwróconych kontaktów z widokiem LinkedIna. Wariant oficjalnego
Member Data Portability pozostaje osobną możliwością dla EOG.

Ocenić ręcznie: poprawność tożsamości, aktualność ról, dostępność źródeł,
potwierdzone przez Ciebie użyteczne dojścia, fałszywe powiązania, czas i koszt.
Raportować osobno brak danych oraz negatywny wynik. Przy nieznanej relacji
szkic wiadomości powinien pytać o znajomość, a nie twierdzić, że ona istnieje.

Nie podłączono Twojego konta LinkedIn. Nie zidentyfikowano zatem jeszcze
konkretnych pośredników z Twojej sieci. Dostęp DMA, pokrycie komercyjnych API
i gotowość znajomych do przedstawienia pozostają do sprawdzenia w pilocie.
