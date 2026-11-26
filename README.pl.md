# Code Embed · Przewodnik po wersji rozwojowej

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Zdefiniuj fragment

Piszesz kilka promptów, które mają kończyć się takim samym poleceniem. Zapisz je raz w notatce `Szablony`. Gdy zmienisz tekst w tej notatce, kolejne użycie Copy+ w każdym z promptów uwzględni poprawkę.

```xml
<ZMIENNA>Podaj trzy przykłady.</ZMIENNA>
```

W innej notatce wstaw poniższy blok. Stuknij **📋 Copy+** i wklej wynik. Otrzymasz `Podaj trzy przykłady.`

```ce
![Szablony:<<ZMIENNA>>]
```

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

📋 kopiuje rozwinięty tekst. 👁️ pokazuje podgląd bloku, a dla notatki otwiera powiązany widok czytania. ⚙️ otwiera ustawienia danego typu bloku lub całej notatki. Domyślnie wybrane są bloki bez oznaczenia, Markdown, XML i CE.

W bloku 🔒 zastępuje odwołania takie jak `![Szablony]` ich treścią. Na górze notatki 🔒 tworzy w tym samym folderze nową notatkę i ją otwiera. Rozwija odwołania w tekście i we wszystkich blokach. Zachowuje właściwości notatki i przykłady w kodzie śródliniowym. Oryginał pozostaje do dalszej edycji.

⚙️ → `[name].perm.[date].v[version].md` → `test.perm.20261206.v1.md`

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

## Instalacja wersji rozwojowej

```sh
npm run build
npm test
```

`dist/{main.js,manifest.json,styles.css}` → `.obsidian/plugins/code-embed/`

Licencja zezwala na użycie komercyjne. Rozpowszechniając przeróbkę, dołącz licencję, zachowaj informację z pliku NOTICE o autorze wykorzystanego kodu (Jakub Wajda, JavaMiner) i oznacz zmienione pliki.

[Releases](../../releases) · [Apache 2.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)

## Wsparcie

Rozwój wtyczki możesz wesprzeć przez [Ko-fi](https://ko-fi.com/x480447). [Support](SUPPORT.pl.md)
