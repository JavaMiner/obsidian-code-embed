# Code Embed · Anleitung zur Entwicklungsversion

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-CC_BY--NC_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Fragment definieren

Speichere die gemeinsame Schlussanweisung mehrerer Prompts in `Szablony`. Eine Änderung gilt beim nächsten Kopieren mit Copy+ für alle.

1. Tippe in einer leeren Zeile genau `_xvar`. Lass den Cursor hinter dem `r`, ohne Leerzeichen oder Auswahl. `_xvarZMIENNA` löst nichts aus.
2. Wähle **Kürzel erweitern** in der Befehlspalette. Gib erst im Namensfeld `ZMIENNA` ein, tippe auf OK und schreibe die Anweisung zwischen die Tags.

```xml
<ZMIENNA>Podaj trzy przykłady.</ZMIENNA>
```

Füge den folgenden Block in eine andere Notiz ein. Mit **Copy+** erhältst du `Podaj trzy przykłady.` (Nenne drei Beispiele.)

```ce
![Szablony:<<ZMIENNA>>]
```

Über die Befehlspalette **XML-Tag einfügen** oder **Markdown-Abschnitt einfügen** wählen. Namen eingeben und auf OK tippen. Ein leerer Name erzeugt ein `var`-Paar oder markiert `Fragmentname` zum Ersetzen. Markierter Text wird zum Inhalt. `_xvar` und `_mvar` mit **Kürzel erweitern** bestätigen.

Diese gleichwertigen Definitionen in getrennten Notizen anlegen oder den Abschnitt mit einer weiteren Überschrift derselben Ebene abschließen.

```markdown
## Instrukcje
Odpowiedz po $1. Ton: ${2:rzeczowy}.
```

```xml
<styl>Odpowiedz po $1. Ton: ${2:rzeczowy}.</styl>
```

## Fragment einbetten

`![źródło:selektor(argumenty)]`

Für die aktuelle Notiz die Quelle weglassen. Der Doppelpunkt steht nur zwischen Quelle und Selektor.

- `![Szablony]` — Ganze Notiz
- `![Szablony:3-8]` — Zeilen einschließlich beider Grenzen
- `![Szablony:#Styl]` — Abschnitt mit Überschrift
- `![Szablony:##Styl]` — Abschnittsinhalt
- `![Szablony:##Rozdział#Styl]` — Inhalt des Unterabschnitts
- `![Szablony:<styl>]` — Tag mit Begrenzern
- `![Szablony:<<styl>>]` — Tag-Inhalt
- `![#Styl]` · `![##Styl]` — Lokaler Abschnitt
- `![<styl>]` · `![<<styl>>]` — Lokales Tag

## Argumente übergeben

Beide Aufrufe liefern das folgende Ergebnis. `$1`–`$9` wählen einen Wert, `$*` verbindet alle Werte und `${2:rzeczowy}` ersetzt einen fehlenden oder leeren Wert. Argumente mit Komma in Anführungszeichen setzen. Werte ausdrücklich an weitere Importe übergeben.

```ce
![##Instrukcje(polsku)]
![<<styl>>(polsku)]
```

```text
Odpowiedz po polsku. Ton: rzeczowy.
```

`![Wspólne:##Ton($1)]`

## Vorschau und Kopieren

`ce` und `codeembed` öffnen die Strukturansicht. Bei `md` und `xml` auf Ansicht tippen. Copy+ kopiert den aufgelösten Text. Die Blocksprache bestimmt die Darstellung.

## Suche auf ein Paket begrenzen

Auf **+ Wurzel** oder **◆ Wurzel** neben dem Ordner tippen, das Kontextmenü durch langes Drücken öffnen oder den Ordner über die Befehlspalette wählen. Ein Tipp auf den Namen klappt den Ordner auf. Die Markierung erzeugt die unten genannte Datei. Zum Entfernen den Pfad bestätigen.

Code Embed verwendet die Oberflächensprache von Obsidian. Die Einstellungen zeigen die installierte Version, den Link zur deutschen Anleitung und **Paketordner auswählen**. Zum manuellen Markieren im Ordner eine Notiz namens `_code-embed-root` anlegen (Dateiname `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Start.md
  Wspólne/
    Styl.md
```

`Prompts/Start.md` → `![Wspólne/Styl:##Ton]`

Die nächste Markierungsdatei begrenzt die gesamte Auflösung. Kurznamen müssen eindeutig sein. Bei Mehrdeutigkeit einen Pfad aus der Fehlermeldung verwenden. Pfade mit Schrägstrich beginnen an der Paketwurzel. Verschachtelte Pakete sind eigenständig. Beim Verschieben die Markierung im Ordner belassen.

## Kompatibilität und Migration

In Codeblöcken liest der Parser alle folgenden älteren Formen. Außerhalb übernimmt Obsidian native Einbettungen von Notizen, Überschriften und Bildern. Rename schreibt geänderte Einbettungen in kanonischer Form.

| Legacy | → |
| --- | --- |
| `![[Szablony:##Styl]]` | `![Szablony:##Styl]` |
| `$[##Styl]` | `![##Styl]` |
| `![.:<<styl>>]` | `![<<styl>>]` |
| `![Szablony##Styl]` | `![Szablony:##Styl]` |

## Entwicklungsversion installieren

```sh
npm run build
npm test
```

`dist/{main.js,manifest.json,styles.css}` → `.obsidian/plugins/code-embed/`

[Releases](../../releases) · [CC BY-NC 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)
