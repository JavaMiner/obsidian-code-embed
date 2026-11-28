# CSS variables

Code Embed styles itself in `styles.css`. The variables below can be overridden in a CSS snippet (`body { --ce-indent: 2em; }`) or, for the values marked "settings", in **Settings → Code Embed → Advanced appearance**. A value set in the settings takes precedence over a snippet; set it back to 0 (or use Reset) to let the stylesheet or your snippet apply again.

## Set from the settings

| Variable | Meaning | Default |
|---|---|---|
| `--ce-block-opacity` | Opacity of the block toolbar at rest | `.2` |
| `--ce-panel-max` | Maximum height of the scrollable sidebar sections | `55vh` |
| `--ce-package-color` | Colour of the package folder marker | `#498b78` |
| `--ce-widget-border`, `--ce-widget-bg` | Border and background of an expanded reference in the editor | theme |
| `--ce-err-border`, `--ce-err-bg`, `--ce-err-text` | Border, background and text of errors | `--text-error` for the text |
| `--ce-tag`, `--ce-import` | Colours of tags and imports in the View tree | theme |
| `--ce-chip` | Colour of the line markers (such as L12) in the sidebars | theme |

## Advanced appearance (hidden by default; 0 = default)

| Variable | Meaning | Default |
|---|---|---|
| `--ce-gutter` | Gap between the toolbar and Obsidian's copy button | `max(44px, 3em)` |
| `--ce-action-font` | Font size of the toolbar buttons | `--font-ui-smaller` |
| `--ce-action-gap` | Gap between toolbar buttons | `.3em` (block), `.35em` (note) |
| `--ce-indent` | Indent of nested fragments | `1em` |
| `--ce-touch` | Minimum touch target of the folder action on phones | `44px` |
| `--ce-mobile-gap` | Gap between buttons on phones | `--size-2-2` |
| `--ce-mobile-top` | Extra top offset of the note actions on phones, added to the safe area and the header | `0px` |

# Zmienne CSS (po polsku)

Code Embed stylizuje się w `styles.css`. Poniższe zmienne można nadpisać w snippecie CSS (`body { --ce-indent: 2em; }`) albo, dla wartości oznaczonych jako ustawienia, w **Ustawienia → Code Embed → Zaawansowany wygląd**. Wartość z ustawień ma pierwszeństwo przed snippetem. Ustaw 0 (albo użyj przycisku Przywróć), żeby znowu działał arkusz lub Twój snippet.

## Ustawiane z ustawień

| Zmienna | Znaczenie | Domyślnie |
|---|---|---|
| `--ce-block-opacity` | Przezroczystość paska bloku w spoczynku | `.2` |
| `--ce-panel-max` | Maksymalna wysokość przewijanych sekcji w panelach bocznych | `55vh` |
| `--ce-package-color` | Kolor oznaczenia katalogu pakietu | `#498b78` |
| `--ce-widget-border`, `--ce-widget-bg` | Ramka i tło rozwiniętego odwołania w edytorze | z motywu |
| `--ce-err-border`, `--ce-err-bg`, `--ce-err-text` | Ramka, tło i tekst błędów | tekst: `--text-error` |
| `--ce-tag`, `--ce-import` | Kolory tagów i importów w drzewie View | z motywu |
| `--ce-chip` | Kolor znaczników linii (np. L12) w panelach bocznych | z motywu |

## Zaawansowany wygląd (domyślnie ukryty; 0 = wartość domyślna)

| Zmienna | Znaczenie | Domyślnie |
|---|---|---|
| `--ce-gutter` | Odstęp paska od przycisku kopiowania Obsidiana | `max(44px, 3em)` |
| `--ce-action-font` | Rozmiar czcionki przycisków paska | `--font-ui-smaller` |
| `--ce-action-gap` | Odstęp między przyciskami paska | `.3em` (blok), `.35em` (notatka) |
| `--ce-indent` | Wcięcie zagnieżdżony fragmentów | `1em` |
| `--ce-touch` | Minimalny cel dotyku przycisku akcji przy folderze na telefonie | `44px` |
| `--ce-mobile-gap` | Odstęp między przyciskami na telefonie | `--size-2-2` |
| `--ce-mobile-top` | Dodatkowe odsunięcie od góry paska akcji notatki na telefonie, ponad bezpieczny obszar i nagłówek | `0px` |
