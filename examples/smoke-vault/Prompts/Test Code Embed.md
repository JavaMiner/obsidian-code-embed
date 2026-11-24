# Test Code Embed · 0.2.3

> [!tip] Start
> Skopiuj cały katalog `smoke-vault` do skarbca testowego albo otwórz go jako skarbiec. Włącz testową wersję Code Embed. Ta notatka jest ekranem testowym. W trybie czytania porównaj wynik z opisem. Do prób edycji przejdź do Live Preview.

## Argumenty i Copy+

> [!success] Oczekiwany wynik
> W każdym z trzech wierszy pojawia się **Odpowiedz po polsku. Ton: rzeczowy.** Stuknij Copy+ i wklej do pustej notatki. Porównaj znaki i liczbę wierszy.

```ce
![Wspólne/Styl:##Ton(polsku)]
![Wspólne/Styl:<<styl>>(polsku)]
![Łańcuch:##Start(polsku)]
```

## Selektory

> [!example] Podgląd
> Stuknij View. Kolejno zobaczysz nagłówek i treść, samą pierwszą linię oraz wiersz z obydwoma znacznikami XML.

```md
![Wspólne/Styl:#Ton(polsku)]
![Wspólne/Styl:1-1]
![Wspólne/Styl:<styl>(polsku)]
```

## Izolacja

> [!warning] Cztery oczekiwane błędy
> Pierwszy wymienia tylko dwa pliki Styl w Prompts. Pozostałe wskazują brak celu w Prompts. Panel błędów ma pokazać ten sam korzeń.

```xml
![Styl:##Ton]
![Osobny/Sekret]
![../Archiwum/TylkoArchiwum]
![_code-embed-root]
```

## Odwołania lokalne

```ce
![##Wzorzec lokalny(krótko)]
![<<lokalny>>(krótko)]
```

> [!success] Oczekiwany wynik
> Dwa razy „Pisz krótko.”.

## Próby dotykowe

| Scenariusz w Obsidianie na Androidzie | Wynik oczekiwany | Wynik próby |
| --- | --- | --- |
| Zaznacz słowo „próba”, wywołaj Wstaw tag XML, wpisz styl i stuknij OK | Słowo między zgodnymi tagami | NIE URUCHOMIONO |
| Zaznacz słowo, wstaw sekcję bez nazwy | Zaznaczony tytuł, słowo poniżej | NIE URUCHOMIONO |
| Podaj tytuł przy wstawianiu sekcji | Kursor w treści | NIE URUCHOMIONO |
| Wpisz `_xvar` lub `_mvar`, dodaj spację, cofnij spację i wybierz Rozwiń skrót | Rozwinięcie dopiero po poleceniu | NIE URUCHOMIONO |
| W wierszu edycji wpisz początek osadzenia i stuknij podpowiedź | Kanoniczne osadzenie, cele z pakietu | NIE URUCHOMIONO |
| W trybie czytania otwórz podgląd i skopiuj trzy wiersze | Wynik zgodny z pierwszym przykładem | NIE URUCHOMIONO |
| Stuknij nazwę katalogu, potem przycisk + Korzeń lub ◆ Korzeń, sprawdź też długie przytrzymanie i paletę | Nazwa zwija katalog, akcje oferują zmianę oznaczenia | NIE URUCHOMIONO |
| Anuluj usunięcie znacznika, potem potwierdź ścieżkę | Anulowanie zachowuje plik, potwierdzenie usuwa tylko znacznik | NIE URUCHOMIONO |
| Ponownie oznacz Prompts, zmień kolor i przenieś cały katalog | Etykieta i kolor widoczne, pierwszy blok działa po przeniesieniu | NIE URUCHOMIONO |
| Wykonaj Rename sekcji Ton w Wspólne/Styl | Importy do tego celu zaktualizowane, Inne/Styl bez zmian | NIE URUCHOMIONO |

Po wykonaniu wpisz **PASS** albo **FAIL** w ostatniej kolumnie. Obok FAIL zapisz wersję Obsidiana, Androida i uzyskany wynik.

## Miejsce na edycję

próba

## Wzorzec lokalny
Pisz $1.
## Definicja XML
<lokalny>Pisz $1.</lokalny>
