# Code Embed · Przewodnik po wersji rozwojowej

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Zdefiniuj fragment

Piszesz kilka promptów, które mają kończyć się takim samym poleceniem. Zapisz je raz w notatce `Szablony`. Gdy zmienisz tekst w tej notatce, kolejne użycie Copy+ w każdym z promptów uwzględni poprawkę.

```xml
<ZMIENNA>Podaj trzy przykłady.</ZMIENNA>
```

W innej notatce wstaw poniższy blok. Stuknij **⧉ Copy+** i wklej wynik. Otrzymasz `Podaj trzy przykłady.`

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

### Zmienne i odwołania w kodzie śródliniowym

Selektory tagów działają również między apostrofami i wewnątrz kodu śródliniowego. Użyj `\![<<sys:package>>]`, żeby zachować przykład dosłownie.

```md
Pakiet `![<<sys:package>>]`, notatka `![<<sys:note>>]`
```

[Pełna lista zmiennych i zasady rozwijania](SYSTEM-VARIABLES.md)

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

⧉ kopiuje rozwinięty tekst. 👁️ pokazuje podgląd bloku, a dla notatki otwiera powiązany widok czytania. ⚙️ otwiera ustawienia danego typu bloku lub całej notatki. Domyślnie wybrane są bloki bez oznaczenia, Markdown, XML i CE.

Na górze notatki 🔒 tworzy w tym samym folderze nową notatkę i ją otwiera. Rozwija odwołania w tekście i we wszystkich blokach. Zachowuje właściwości notatki i przykłady poprzedzone ukośnikiem odwrotnym. Oryginał pozostaje do dalszej edycji.

W ⚙️ możesz usunąć format lub dodać go na końcu listy. Pasek bloku ma domyślnie 20% krycia. Możesz to zmienić w ⚙️. Po najechaniu na blok pasek jest w pełni widoczny. 📝 Edytuj otwiera opis pakietu w karcie edytora. Przełącznik Etykiety obejmuje również ten przycisk. Wtyczka nadal rozpoznaje wcześniejsze znaczniki z podkreśleniem.

⚙️ → `[name].perm.[date].v[version].md` → `test.perm.20261206.v1.md` Wtyczka nadal rozpoznaje wcześniejsze znaczniki z podkreśleniem.

## Ogranicz wyszukiwanie do pakietu

Otwórz menu folderu prawym kliknięciem lub długim przytrzymaniem albo wybierz folder z palety poleceń. Przy zdejmowaniu oznaczenia potwierdź ścieżkę znacznika. Każdy oznaczony folder zawsze ma kolor i **📝 Edytuj**. Przełącznik pokazuje **+ Korzeń** przy pozostałych folderach. Domyślnie jest wyłączony.

**Pokaż akcje przy wszystkich folderach** — Wyświetla „+ Korzeń” przy nieoznaczonych folderach i „📝 Edytuj” przy wszystkich korzeniach.

Wtyczka używa języka interfejsu Obsidiana. W ustawieniach Code Embed znajdziesz numer wersji, odnośnik do polskiego przewodnika i przycisk **Wybierz katalog pakietu**. Aby ręcznie oznaczyć katalog, utwórz w nim notatkę `.code-embed-root` (pełna nazwa pliku to `.code-embed-root.md`).

```text
Prompts/
  .code-embed-root.md
  Start.md
  Wspólne/
    Styl.md
```

`Prompts/Start.md` → `![Wspólne/Styl:##Ton]`

Najbliższy znacznik wyznacza granicę całego rozwinięcia. Krótka nazwa musi być jednoznaczna. Przy duplikacie wybierz ścieżkę podaną w błędzie. Ścieżki z ukośnikiem zaczynają się w korzeniu. Zagnieżdżone pakiety są odrębne. Przenieś katalog razem ze znacznikiem, aby zachować odwołania.

## Instalacja

Pobierz `main.js`, `manifest.json` i `styles.css` z [najnowszego wydania](../../releases/latest) i skopiuj je do `.obsidian/plugins/code-embed/` w swoim vaulcie. Następnie włącz **Code Embed** w Ustawienia → Wtyczki społeczności. Te same trzy pliki działają w systemach Windows, macOS, Linux, iOS i Android; wtyczka nie jest ograniczona do komputerów. Na telefonie skopiuj folder przez usługę synchronizacji lub aplikację Pliki.

Pliki wydań od wersji 0.3.5 mają atesty kompilacji GitHub. Aby je zweryfikować, uruchom:

```sh
gh attestation verify main.js -R JavaMiner/obsidian-code-embed
```

Budowanie ze źródeł:

```sh
npm ci
npm run build
npm test
```

Następnie skopiuj `dist/{main.js,manifest.json,styles.css}` do tego samego folderu.

## Prywatność

Code Embed działa lokalnie. Odczytuje ścieżki plików w vaulcie, żeby znaleźć znaczniki pakietów, a notatki czyta tylko po to, by rozwinąć odwołania. Do schowka zapisuje wyłącznie po uruchomieniu Copy+ i nigdy go nie odczytuje. Szczegóły: [PRIVACY.md](PRIVACY.md).


> ⚠️ **Wczesny etap rozwoju.** Code Embed jest w trakcie budowy, a jego interfejs może się jeszcze zmieniać. Składnia powinna pozostać w większości bez zmian, ale możliwe są jeszcze drobne poprawki. Każda taka zmiana zostanie wyraźnie opisana w dokumentacji.

[Support](https://github.com/JavaMiner/obsidian-code-embed/issues/new) · [Releases](../../releases) · [Apache 2.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6) · [Ko-fi](https://ko-fi.com/x480447)

