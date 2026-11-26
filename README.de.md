# Code Embed · Anleitung zur Entwicklungsversion

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Version](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![Lizenz](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Fragment definieren

Speichere die gemeinsame Schlussanweisung mehrerer Prompts in einer Notiz namens `Vorlagen`. Wenn du sie änderst, übernimmt Copy+ beim nächsten Kopieren den neuen Text.

```xml
<VARIABLE>Nenne drei Beispiele.</VARIABLE>
```

Füge den folgenden Block in eine andere Notiz ein. Wähle **📋 Copy+** und füge das Ergebnis ein: `Nenne drei Beispiele.`

```ce
![Vorlagen:<<VARIABLE>>]
```

Lege diese gleichwertigen Definitionen in getrennten Notizen an oder schließe den Abschnitt mit einer weiteren Überschrift derselben Ebene ab.

```markdown
## Anweisungen
Antworte auf $1. Ton: ${2:sachlich}.
```

```xml
<stil>Antworte auf $1. Ton: ${2:sachlich}.</stil>
```

## Fragment einbetten

`![Quelle:Selektor(Argumente)]`

Lass die Quelle weg, um die aktuelle Notiz zu verwenden. Der Doppelpunkt steht nur zwischen Quelle und Selektor.

- `![Vorlagen]` — Ganze Notiz
- `![Vorlagen:3-8]` — Zeilen einschließlich beider Grenzen
- `![Vorlagen:#Stil]` — Abschnitt mit Überschrift
- `![Vorlagen:##Stil]` — Abschnittsinhalt
- `![Vorlagen:##Kapitel#Stil]` — Inhalt des Unterabschnitts
- `![Vorlagen:<stil>]` — Element mit seinen Tags
- `![Vorlagen:<<stil>>]` — Inhalt des Elements
- `![#Stil]` · `![##Stil]` — Lokaler Abschnitt
- `![<stil>]` · `![<<stil>>]` — Lokales Tag

## Argumente übergeben

Beide Aufrufe liefern das folgende Ergebnis. `$1`–`$9` wählen ein Argument aus, `$*` verbindet alle Argumente und `${2:sachlich}` liefert einen Standardwert, wenn das zweite Argument fehlt oder leer ist. Setze Argumente mit Kommas in Anführungszeichen. Übergib Argumente ausdrücklich an verschachtelte Einbettungen.

```ce
![##Anweisungen(Deutsch)]
![<<stil>>(Deutsch)]
```

```text
Antworte auf Deutsch. Ton: sachlich.
```

`![Gemeinsam:##Ton($1)]`

## Vorschau und Kopieren

📋 kopiert den aufgelösten Text. 👁️ zeigt den Block oder öffnet eine verknüpfte Leseansicht der Notiz. ⚙️ öffnet die Einstellungen der Blocksprache oder der Notiz. Standardmäßig sind Blöcke ohne Sprache, Markdown, XML und CE ausgewählt.

Im Block ersetzt 🔒 Verweise wie `![Vorlagen]` durch ihren Inhalt. Oben in der Notiz erstellt und öffnet 🔒 eine neue Notiz im selben Ordner. Sie enthält aufgelöste Verweise im Text und in allen Codeblöcken. Eigenschaften, Inline-Code und Original bleiben erhalten.

⚙️ → `[name].perm.[date].v[version].md` → `test.perm.20261206.v1.md`

## Suche auf ein Paket begrenzen

Öffne das Ordnermenü per Rechtsklick oder langem Drücken oder wähle einen Ordner über die Befehlspalette. Bestätige beim Entfernen den Pfad der Markierung. Jeder markierte Ordner zeigt seine Farbe und **◆ Wurzel**. Aktiviere **Aktionen bei allen Ordnern anzeigen**, um bei unmarkierten Ordnern auch **+ Wurzel** anzuzeigen. Die Option ist standardmäßig deaktiviert.

Code Embed verwendet die Oberflächensprache von Obsidian. Die Einstellungen zeigen die installierte Version, einen Link zur deutschen Anleitung und **Paketordner auswählen**. Lege zum manuellen Markieren im Ordner eine Notiz namens `_code-embed-root` an (Dateiname `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Start.md
  Gemeinsam/
    Stil.md
```

`Prompts/Start.md` → `![Gemeinsam/Stil:##Ton]`

Die nächstgelegene Markierungsdatei begrenzt die gesamte Auflösung. Kurznamen müssen eindeutig sein. Wähle bei Mehrdeutigkeit einen Pfad aus der Fehlermeldung. Pfade mit Schrägstrich beginnen an der Paketwurzel. Verschachtelte Pakete sind eigenständig. Verschiebe den Ordner zusammen mit seiner Markierung, damit Verweise erhalten bleiben.

## Entwicklungsversion installieren

```sh
npm run build
npm test
```

Kopiere `dist/{main.js,manifest.json,styles.css}` nach `.obsidian/plugins/code-embed/`.

Kommerzielle Nutzung ist erlaubt. Wenn du eine bearbeitete Fassung weitergibst, lege die Lizenz bei, behalte den zutreffenden Urheberhinweis auf Jakub Wajda (JavaMiner) aus NOTICE bei und kennzeichne geänderte Dateien.

[Versionen](../../releases) · [Apache 2.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)

## Unterstützung

Unterstütze die Entwicklung über [Ko-fi](https://ko-fi.com/x480447). [Support](SUPPORT.md)
