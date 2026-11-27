# Akcje bloków i notatki

Otwórz kopię tej notatki w Obsidianie z włączonym Code Embed. Przełącz się między edycją a czytaniem. Na górze notatki są ⧉, 👁️, 🔒 i ⚙️. Przy bloku są ⧉, 👁️ i ⚙️.

| Adres | Co wpisać lub kliknąć | Oczekiwany efekt |
| --- | --- | --- |
| [[#BA-01]] | W pustym bloku wpisz `![##Fragment]` i kliknij Copy+ | Po wklejeniu zobaczysz `**Gotowe**`. |
| [[#BA-02]] | Kliknij Podgląd przy bloku Markdown między czterema tyldami | Pojawi się pogrubiony napis **Gotowe** lub drzewo importu z treścią fragmentu, zgodnie z ustawieniem drzewa. |
| [[#BA-03]] | W bloku XML kliknij Kopiuj | W schowku pojawią się dwa wiersze `**Gotowe**`. |
| [[#BA-04]] | Dodaj `java` w ustawieniach dodatkowych języków | Przy bloku Java pojawią się trzy przyciski. |
| [[#BA-05]] | Kliknij Podgląd na górze notatki dwukrotnie | Na komputerze edytor i widok czytania pokazują tę samą notatkę. Kolejne kliknięcie wykorzystuje istniejący panel. |
| [[#BA-06]] | Kliknij 🔒 u góry notatki | Otworzy się nowa kopia z datą i numerem wersji. Oryginał zachowa odwołania. |
| [[#BA-07]] | Kliknij ⚙️ przy bloku XML | Otworzą się ustawienia XML. |
| [[#BA-08]] | Wpisz selektor tagu między apostrofami i między znakami kodu śródliniowego. | W obu miejscach pojawi się tekst „Gotowe”. |
| [[#BA-09]] | W pakiecie otwórz 📝 Edytuj i wyświetl podgląd nowego opisu. | W nagłówku i w bloku pojawi się nazwa folderu pakietu. |
| [[#BA-10]] | W długiej notatce z połączonym podglądem przewiń blisko końca i wpisz odnośnik oraz tag. | Kursor i widoczny fragment pozostaną przy wpisywanym tekście po zapisie. |

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

Kliknij ⚙️, aby otworzyć ustawienia XML.

## Fragment

**Gotowe**

## BA-08

<result>Gotowe</result>

'![<<result>>]' i `![<<result>>]`

## BA-09

Pakiet `![<<sys:package>>]`, notatka `![<<sys:note>>]`.

## BA-10

Wpisz `![##Fragment]`, a potem nowy tag, np. `<nowy>tekst</nowy>`.
