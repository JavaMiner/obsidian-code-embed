# Code Embed · Guida alla versione di sviluppo

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-CC_BY--NC_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Definire un frammento

Salva in `Szablony` l’istruzione finale comune a più prompt. Modificala una volta e la prossima copia di ogni prompt includerà la modifica.

1. Su una riga vuota digita esattamente `_xvar`. Lascia il cursore dopo la `r`, senza spazi o selezioni. `_xvarZMIENNA` non si espande.
2. Scegli **Espandi abbreviazione** nella tavolozza dei comandi. Inserisci `ZMIENNA` nel campo del nome, tocca OK e scrivi l’istruzione tra i tag.

```xml
<ZMIENNA>Podaj trzy przykłady.</ZMIENNA>
```

Inserisci il blocco seguente in un’altra nota. Tocca **Copy+** e incolla il risultato: `Podaj trzy przykłady.` (Fornisci tre esempi.)

```ce
![Szablony:<<ZMIENNA>>]
```

Nella tavolozza scegli **Inserisci tag XML** o **Inserisci sezione Markdown**. Inserisci un nome e tocca OK. Un nome vuoto crea una coppia `var` oppure seleziona `Nome del frammento` da sostituire. Il testo selezionato diventa il contenuto. Conferma `_xvar` o `_mvar` con **Espandi abbreviazione**.

Inserisci queste definizioni equivalenti in note separate oppure termina la sezione con un’altra intestazione dello stesso livello.

```markdown
## Instrukcje
Odpowiedz po $1. Ton: ${2:rzeczowy}.
```

```xml
<styl>Odpowiedz po $1. Ton: ${2:rzeczowy}.</styl>
```

## Incorporare il frammento

`![źródło:selektor(argumenty)]`

Ometti la sorgente per usare la nota corrente. I due punti separano solo la sorgente dal selettore.

- `![Szablony]` — Nota intera
- `![Szablony:3-8]` — Righe, estremi inclusi
- `![Szablony:#Styl]` — Sezione con intestazione
- `![Szablony:##Styl]` — Contenuto della sezione
- `![Szablony:##Rozdział#Styl]` — Contenuto della sottosezione
- `![Szablony:<styl>]` — Elemento con entrambi i tag
- `![Szablony:<<styl>>]` — Contenuto del tag
- `![#Styl]` · `![##Styl]` — Sezione locale
- `![<styl>]` · `![<<styl>>]` — Tag locale

## Passare gli argomenti

Entrambe le chiamate producono il risultato seguente. `$1`–`$9` selezionano un valore, `$*` unisce tutti i valori e `${2:rzeczowy}` sostituisce un valore mancante o vuoto. Racchiudi tra virgolette gli argomenti con virgole. Passa esplicitamente i valori alle importazioni annidate.

```ce
![##Instrukcje(polsku)]
![<<styl>>(polsku)]
```

```text
Odpowiedz po polsku. Ton: rzeczowy.
```

`![Wspólne:##Ton($1)]`

## Visualizzare e copiare

`ce` e `codeembed` mostrano la struttura. In `md` o `xml` tocca Anteprima. Copy+ copia il testo espanso. Il linguaggio del blocco controlla la presentazione.

## Limitare la ricerca a un pacchetto

Tocca **+ Radice** o **◆ Radice** accanto alla cartella, tieni premuto per il menu o scegli la cartella dalla tavolozza. Tocca il nome per espanderla. Il contrassegno crea il file indicato sotto. Conferma il percorso per rimuoverlo.

Code Embed usa la lingua dell’interfaccia di Obsidian. Le impostazioni mostrano la versione installata, il collegamento alla guida italiana e **Scegli la cartella del pacchetto**. Per contrassegnare una cartella manualmente, crea al suo interno una nota `_code-embed-root` (file `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Start.md
  Wspólne/
    Styl.md
```

`Prompts/Start.md` → `![Wspólne/Styl:##Ton]`

Il contrassegno più vicino delimita l’intera espansione. I nomi brevi devono essere univoci. In caso di duplicati scegli un percorso dal messaggio di errore. I percorsi con una barra partono dalla radice del pacchetto. I pacchetti annidati sono indipendenti. Sposta la cartella con il contrassegno per conservare i riferimenti.

## Compatibilità e migrazione

Nei blocchi di codice il parser legge tutte le forme precedenti riportate sotto. Fuori dai blocchi, Obsidian gestisce le incorporazioni native di note, intestazioni e immagini. Rename scrive i riferimenti modificati in forma canonica.

| Legacy | → |
| --- | --- |
| `![[Szablony:##Styl]]` | `![Szablony:##Styl]` |
| `$[##Styl]` | `![##Styl]` |
| `![.:<<styl>>]` | `![<<styl>>]` |
| `![Szablony##Styl]` | `![Szablony:##Styl]` |

## Installare la versione di sviluppo

```sh
npm run build
npm test
```

`dist/{main.js,manifest.json,styles.css}` → `.obsidian/plugins/code-embed/`

[Releases](../../releases) · [CC BY-NC 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)
