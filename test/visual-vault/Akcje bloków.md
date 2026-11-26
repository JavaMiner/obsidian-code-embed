# Akcje bloków i notatki

Otwórz kopię tej notatki w Obsidianie z włączonym Code Embed. Przełącz się między edycją a czytaniem. Na górze notatki i przy wybranych blokach powinny być widoczne 📋, 👁️, 🔒 i ⚙️.

| Adres | Co wpisać lub kliknąć | Oczekiwany efekt |
| --- | --- | --- |
| [[#BA-01]] | W pustym bloku wpisz `![##Fragment]` i kliknij Copy+ | Po wklejeniu zobaczysz `**Gotowe**`. |
| [[#BA-02]] | Kliknij Podgląd przy bloku Markdown między czterema tyldami | Pojawi się pogrubiony napis **Gotowe** lub drzewo importu z treścią fragmentu, zgodnie z ustawieniem drzewa. |
| [[#BA-03]] | W bloku XML kliknij 🔒 | Oba odwołania w bloku zmieniają się w `**Gotowe**`. |
| [[#BA-04]] | Dodaj `java` w ustawieniach dodatkowych języków | Przy bloku Java pojawią się cztery przyciski. |
| [[#BA-05]] | Kliknij Podgląd na górze notatki dwukrotnie | Na komputerze edytor i widok czytania pokazują tę samą notatkę. Kolejne kliknięcie wykorzystuje istniejący panel. |
| [[#BA-06]] | Kliknij 🔒 u góry notatki | Otworzy się nowa kopia z datą i numerem wersji. Oryginał zachowa odwołania. |
| [[#BA-07]] | Kliknij ⚙️ przy bloku XML | Otworzą się ustawienia XML. |

## BA-01

````
![##Fragment]
````

## BA-02

~~~~markdown
![##Fragment]
~~~~

## BA-03

```xml
![##Fragment]
![##Fragment]
```

## BA-04

```java
// ![##Fragment]
```

## BA-05

Odwołanie w tekście notatki: ![##Fragment]

## BA-06

Zawartość kopii: ![##Fragment]

## BA-07

~~~xml
<example />
~~~

Tutaj 🔒 jest wyszarzona.

## Fragment

**Gotowe**
