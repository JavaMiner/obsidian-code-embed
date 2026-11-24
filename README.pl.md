# Code Embed · Przewodnik po wersji rozwojowej

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-CC_BY--NC_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Zdefiniuj fragment

Piszesz kilka promptów, które mają kończyć się takim samym poleceniem. Zapisz je raz w notatce `Szablony`. Gdy zmienisz tekst w tej notatce, kolejne użycie Copy+ w każdym z promptów uwzględni poprawkę.

1. Wpisz `_xvarZMIENNA` i zostaw kursor za ostatnią literą, bez spacji.
2. Wybierz **Rozwiń skrót**. Polecenie wstawi oba tagi i ustawi kursor między nimi. Wpisz tam instrukcję.

```xml
<ZMIENNA>Podaj trzy przykłady.</ZMIENNA>
```

W innej notatce wstaw poniższy blok. Stuknij **Copy+** i wklej wynik. Otrzymasz `Podaj trzy przykłady.`

```ce
![Szablony:<<ZMIENNA>>]
```

W palecie poleceń wybierz **Wstaw tag XML** lub **Wstaw sekcję Markdown**. Wpisz nazwę i stuknij OK. Pusta nazwa daje parę `var` albo zaznaczony tytuł `Nazwa fragmentu`. Zaznaczony wcześniej tekst trafia do środka. Skróty `_xvar` i `_mvar` zatwierdza polecenie **Rozwiń skrót**.

Umieść te równoważne definicje w oddzielnych notatkach lub zakończ sekcję kolejnym nagłówkiem tego samego poziomu.

```markdown
## Instrukcje
Odpowiedz po $1. Ton: ${2:rzeczowy}.
```

```xml
<styl>Odpowiedz po $1. Ton: ${2:rzeczowy}.</styl>
```

## Osadź fragment

`![źródło:selektor(argumenty)]`

Pomiń źródło dla bieżącej notatki. Dwukropek wpisz tylko między źródłem a selektorem.

- `![Szablony]` — Cała notatka
- `![Szablony:3-8]` — Linie włącznie
- `![Szablony:#Styl]` — Sekcja z nagłówkiem
- `![Szablony:##Styl]` — Treść sekcji
- `![Szablony:##Rozdział#Styl]` — Treść podsekcji
- `![Szablony:<styl>]` — Zewnętrzny tag z treścią
- `![Szablony:<<styl>>]` — Wnętrze tagu
- `![#Styl]` · `![##Styl]` — Sekcja lokalna
- `![<styl>]` · `![<<styl>>]` — Tag lokalny

## Przekaż argumenty

Oba wywołania dają poniższy wynik. `$1`–`$9` wybierają argument, `$*` łączy wszystkie, a `${2:rzeczowy}` zastępuje brakującą lub pustą wartość. Argument zawierający przecinek ujmij w cudzysłów. Do kolejnego importu przekaż wartość jawnie.

```ce
![##Instrukcje(polsku)]
![<<styl>>(polsku)]
```

```text
Odpowiedz po polsku. Ton: rzeczowy.
```

`![Wspólne:##Ton($1)]`

## Podejrzyj i skopiuj

W bloku `ce` lub `codeembed` otwiera się widok struktury. W `md` lub `xml` stuknij Podgląd. Copy+ kopiuje rozwinięty tekst. Język bloku zmienia prezentację.

## Ogranicz wyszukiwanie do pakietu

Otwórz menu folderu prawym kliknięciem lub długim przytrzymaniem albo wybierz folder z palety poleceń. Przy zdejmowaniu oznaczenia potwierdź ścieżkę znacznika. Każdy oznaczony folder zawsze ma kolor i **◆ Korzeń**. Przełącznik pokazuje **+ Korzeń** przy pozostałych folderach. Domyślnie jest wyłączony.

**Pokaż akcje przy wszystkich folderach** — Wyświetla „+ Korzeń” przy nieoznaczonych folderach i „◆ Korzeń” przy wszystkich korzeniach.

Wtyczka używa języka interfejsu Obsidiana. W ustawieniach Code Embed znajdziesz numer wersji, odnośnik do polskiego przewodnika i przycisk **Wybierz katalog pakietu**. Aby ręcznie oznaczyć katalog, utwórz w nim notatkę `_code-embed-root` (pełna nazwa pliku to `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Start.md
  Wspólne/
    Styl.md
```

`Prompts/Start.md` → `![Wspólne/Styl:##Ton]`

Najbliższy znacznik wyznacza granicę całego rozwinięcia. Krótka nazwa musi być jednoznaczna. Przy duplikacie wybierz ścieżkę podaną w błędzie. Ścieżki z ukośnikiem zaczynają się w korzeniu. Zagnieżdżone pakiety są odrębne. Przenieś katalog razem ze znacznikiem, aby zachować odwołania.

## Zgodność i migracja

W bloku kodu parser czyta wszystkie poniższe starsze zapisy. Poza blokiem natywne osadzenia notatek, nagłówków i obrazów obsługuje Obsidian. Rename zapisuje zmieniane osadzenia w formie kanonicznej.

| Legacy | → |
| --- | --- |
| `![[Szablony:##Styl]]` | `![Szablony:##Styl]` |
| `$[##Styl]` | `![##Styl]` |
| `![.:<<styl>>]` | `![<<styl>>]` |
| `![Szablony##Styl]` | `![Szablony:##Styl]` |

## Instalacja wersji rozwojowej

```sh
npm run build
npm test
```

`dist/{main.js,manifest.json,styles.css}` → `.obsidian/plugins/code-embed/`

[Releases](../../releases) · [CC BY-NC 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)
