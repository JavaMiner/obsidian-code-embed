# Akcje bloków i notatki

Otwórz kopię tej notatki w Obsidianie z włączonym Code Embed. Przełącz się między edycją a czytaniem. Na górze notatki i przy wybranych blokach powinny być widoczne **Copy+**, **Podgląd** i **Permanent**.

| Adres | Co wpisać lub kliknąć | Oczekiwany efekt |
| --- | --- | --- |
| [[#BA-01]] | W pustym bloku wpisz `$[##Fragment]` i kliknij Copy+ | Po wklejeniu zobaczysz `**Gotowe**`. |
| [[#BA-02]] | Kliknij Podgląd przy bloku Markdown między czterema tyldami | Pojawi się pogrubiony napis **Gotowe** lub drzewo importu z treścią fragmentu, zgodnie z ustawieniem drzewa. |
| [[#BA-03]] | W bloku XML kliknij Permanent | W źródle dolne odwołanie pozostaje dynamiczne, górne zmienia się w `**Gotowe**`. |
| [[#BA-04]] | Dodaj `java` w ustawieniach dodatkowych języków | Przy bloku Java pojawią się trzy przyciski. |
| [[#BA-05]] | Kliknij Podgląd na górze notatki dwukrotnie | Na komputerze edytor i widok czytania pokazują tę samą notatkę. Kolejne kliknięcie wykorzystuje istniejący panel. |

## BA-01

````
$[##Fragment]
````

## BA-02

~~~~markdown
$[##Fragment]
~~~~

## BA-03

```xml
$[##Fragment]
![##Fragment]
```

## BA-04

```java
// $[##Fragment]
```

## BA-05

Odwołanie w tekście notatki: $[##Fragment]

## Fragment

**Gotowe**
