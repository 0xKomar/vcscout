# VCScout: kontakty i warm intro bez CSV

Stan na **14 listopada 2026, Europe/Warsaw**. Wymaganie: użytkownik podłącza
konto albo rozszerzenie; nie pobiera i nie przesyła archiwum LinkedIna.

**Rekomendacja do sprawdzenia w VCScout: Unipile + UniLogin, z wyszukiwaniem
wspólnych kontaktów osobno dla wybranego partnera.** Do pierwszego wyniku nie
trzeba importować całej sieci. Alternatywa z gotowym mapowaniem relacji to
The Swarm i jego synchronizacja przez rozszerzenie. Oficjalnym wariantem bez
rozszerzenia jest LinkedIn Member Data Portability po uzyskaniu dostępu.

To wynik sprawdzenia dokumentacji i schematów API. Nie podłączono konta
LinkedIn i nie zweryfikowano jeszcze wyników tych usług na własnej sieci.

## 1. Unipile: przycisk podłączenia konta i wspólni znajomi dla partnera

Unipile udostępnia Hosted Auth oraz UniLogin. Użytkownik instaluje rozszerzenie
i zatwierdza połączenie konta już zalogowanego w przeglądarce. VCScout otrzymuje
`account_id`; według dokumentacji UniLogin aplikacja nie otrzymuje ciasteczek
sesji. Jest też wariant Custom Auth z kodem rozszerzenia i sprawdzaniem stanu
połączenia przez backend.
[Hosted Auth](https://developer.unipile.com/docs/hosted-auth),
[Custom Auth](https://developer.unipile.com/docs/native-auth).

Możliwy proces w naszym produkcie:

1. Jednorazowe podłączenie LinkedIna przez UniLogin.
2. Obecny VCScout znajduje partnera i ustala jego profil LinkedIn.
3. Po kliknięciu „Przez kogo dotrzeć” backend wyszukuje wspólne kontakty
   użytkownika i tej konkretnej osoby.
4. Panel pokazuje nazwiska i profile pośredników, źródło powiązania oraz szkic
   pytania o intro. Wynik trafia do cache z datą odczytu.

Dokumentacja wyszukiwania wprost wymienia listę wspólnych kontaktów jako
zastosowanie do warm intro. W schemacie Classic People są filtry
`connections_of` i `network_distance`. Ich połączenie z odległością `1` jest
podstawą proponowanego zapytania o pośredników należących do własnej sieci.
Należy użyć właściwego identyfikatora filtra LinkedIna, ustalonego przez API
parametrów wyszukiwania; sam slug profilu nie musi być takim identyfikatorem.
[Opis funkcji](https://developer.unipile.com/docs/linkedin-search),
[schemat wyszukiwania](https://developer.unipile.com/reference/linkedincontroller_search.md).

Przykład konstrukcji body, do sprawdzenia na podłączonym koncie:

```json
{
  "api": "classic",
  "category": "people",
  "network_distance": [1],
  "connections_of": ["TARGET_CONNECTION_FILTER_ID"]
}
```

Trasa v1: `POST /api/v1/linkedin/search?account_id=...`. Osobna trasa
`GET /api/v1/users/relations?account_id=...` zwraca własne kontakty z nazwiskiem,
headline, URL profilu i identyfikatorami. Można jej użyć później do pełniejszej
synchronizacji, ale nie musi być warunkiem pierwszego wyszukiwania intro.
[Lista kontaktów](https://developer.unipile.com/reference/userscontroller_getrelations).

Przy nowych implementacjach trzeba świadomie wybrać wersję: dokumentacja v2
zmienia trasy, m.in. listę relacji na `/v2/:account_id/users/:user_id/relations`.
Przykład wyżej dotyczy v1; nie należy mieszać go ze schematami v2.
[Migracja Users API](https://developer.unipile.com/v2.0/docs/migration-users-api).

**Koszt:** minimum **49 EUR netto/miesiąc za do 10 podłączonych kont**;
dostawca oferuje 7-dniowy trial bez karty. Abonament nie usuwa limitów LinkedIna.
[Cennik](https://www.unipile.com/pricing-api/).

Unipile nie jest oficjalnym partnerem LinkedIna i sam to stwierdza. Odczytuje
dane w kontekście podłączonego użytkownika; nie zapewnia dostępu do ukrytych
kontaktów ani niezależnej bazy wszystkich profili. Trzeba obsłużyć utratę sesji,
niepełne wyniki i ograniczenia konta.
[Status i zakres usługi](https://www.unipile.com/communication-api/messaging-api/linkedin-api/),
[zakres widocznych danych](https://www.unipile.com/data-extraction-and-enrichment/).

Dostawca opisuje odrębne ograniczenia dla odczytów profili, wyszukiwania i list
relacji. Liczniki oraz możliwości zależą też od abonamentu LinkedIna.
Wyszukiwanie na żądanie i cache ograniczą liczbę potrzebnych odczytów; brak
wyniku nie może być automatycznie opisany jako brak znajomych.
[Limity i ograniczenia](https://developer.unipile.com/docs/provider-limits-and-restrictions).

## 2. The Swarm: rozszerzenie synchronizuje sieć i dostarcza powiązania

The Swarm ma pełną ścieżkę bez plików: rozszerzenie Chrome odczytuje kontakty
z zalogowanego LinkedIna. Aktualny help podaje, że synchronizacja uruchamia się
po otwarciu LinkedIna, gdy od poprzedniej minęło ponad siedem dni. To nie jest
ciągła synchronizacja w czasie rzeczywistym.
[Dokładny sposób synchronizacji](https://help.theswarm.com/en/articles/6671534-import-your-linkedin-connections).

Następnie VCScout może odpytać `POST /v3/relationships` o docelową osobę lub
fundusz. Odpowiedź zawiera pośredników i typ źródła: połączenie LinkedIn,
wspólną pracę, e-mail, spotkanie lub wspólnego inwestora. To ułatwia także
szukanie historycznych powiązań z partnerami.
[API Relationships](https://docs.theswarm.com/docs/intelligence/relationships).

Cena Premium 50 według help center to **99 USD/miesiąc**, 50 connectorów
i 1000 kredytów API miesięcznie. Wyszukiwania relacji nie zużywają kredytów;
inne pobrania mogą je zużywać. Dostępne jest 14 dni trialu bez karty.
[Plany](https://help.theswarm.com/en/articles/14121950-plans-billing-connector-limits-and-api-credits).

Osoby udostępniające swoją sieć można kierować do portalu przez link;
również tam można użyć rozszerzenia. Sieć większego zespołu wymaga więc
podłączenia jego członków. Samo wklejenie czyjegoś profilu daje głównie
możliwości mapowania publicznych powiązań, a nie jego prywatną listę kontaktów.
[Portal connectorów](https://help.theswarm.com/en/articles/17663335-share-your-network-with-an-invite-link).

Przy produkcie obsługującym wiele organizacji nadal trzeba potwierdzić warunki
partnerskie. Network Mapper i samo Relationships mają różny zakres uprawnień.
[Network Mapper](https://docs.theswarm.com/docs/intelligence/network-mapper).

**Kiedy wybrać:** gdy priorytetem jest gotowy graf, historia zawodowa i szybkie
sprawdzenie użyteczności intro. Dochodzi konto w The Swarm, jego rozszerzenie
i zależność od zewnętrznego modelu relacji.

## 3. Oficjalne OAuth: Member Data Portability

W produkcie dla użytkowników EOG można wystąpić o Member Data Portability
3rd Party. Po zatwierdzeniu aplikacji końcowy użytkownik udziela zgody przez
OAuth. Nie musi instalować rozszerzenia ani obsługiwać eksportu. Weryfikacja
firmy, biznesowego adresu i aplikacji odbywa się po stronie twórcy produktu.
[Wymagania i OAuth](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-3rd-party/).

Snapshot zawiera domenę `CONNECTIONS`. Nadal dostajemy własne połączenia,
a nie pełną sieć znajomych kontaktów; wyszukiwanie dalszych powiązań wymaga
osobnych danych. Nie należy obiecywać, że oficjalne API zapewnia taki sam
zakres wyszukiwania wspólnych znajomych jak sesyjna integracja Unipile.
[Domeny Snapshot](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/snapshot-domain).

**Kiedy wybrać:** docelowa integracja dla produktu w EOG, jeśli akceptujemy
proces uzyskania dostępu oraz budowę własnej warstwy relacji. Osobisty tryb
Member jest użyteczny do próby własnego konta, ale jego ręczne generowanie
tokenu nie powinno być procesem podłączania kont przez klientów.

## 4. Wybór dla obecnego VCScout

| Wariant | Co robi użytkownik | Co budujemy |
| --- | --- | --- |
| **Unipile + UniLogin** | Instaluje rozszerzenie i podłącza konto | Panel wspólnych kontaktów przy partnerze; własne uzasadnienie i ranking |
| The Swarm | Instaluje rozszerzenie, synchronizuje sieć z kontem Swarm | Pobieranie gotowych relacji i ich prezentację |
| Oficjalne DMA 3rd Party | Wyraża zgodę OAuth po zatwierdzeniu naszej aplikacji | Synchronizację kontaktów oraz pozostałą warstwę danych o powiązaniach |

Własna aplikacja i wyszukiwanie wspólnych kontaktów na żądanie najlepiej
odpowiadają obecnemu wymaganiu. **Najpierw próba Unipile na kilku partnerach
już odnalezionych przez VCScout.** The Swarm pozostaje alternatywą, jeśli
potrzebujemy gotowych historycznych powiązań i chcemy mniej logiki budować sami.

Obecne Cala zachowuje rolę źródła osób przy inwestycjach i publicznego kontekstu.
Wyniki należy rozdzielić: „wspólny kontakt na LinkedIn”, „wspólna praca” oraz
„znajomy potwierdził możliwość przedstawienia”. Lista wspólnych kontaktów
nie dowodzi bliskości ani gotowości do intro.

Próba akceptacyjna powinna potwierdzić: podłączenie konta bez plików, nazwiska
wspólnych znajomych zgodne z widokiem LinkedIna, poprawne profile, aktualizację
danych, odłączenie konta oraz uczciwy komunikat przy braku dostępu lub błędzie.
Nie kupiono abonamentu, nie utworzono konta u dostawcy i nie wysłano kontaktów.
