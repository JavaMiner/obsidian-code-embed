# Code Embed · Guida alla versione di sviluppo

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Versione](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![Licenza](https://img.shields.io/badge/license-CC_BY--NC_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Definire un frammento

Salva l’istruzione finale comune a più prompt in una nota chiamata `Modelli`. Se la modifichi, la prossima copia di ciascun prompt includerà la modifica.

```xml
<VARIABILE>Fornisci tre esempi.</VARIABILE>
```

Inserisci il blocco seguente in un’altra nota. Premi **Copy+** e incolla il risultato: `Fornisci tre esempi.`

```ce
![Modelli:<<VARIABILE>>]
```

Inserisci queste definizioni equivalenti in note separate oppure termina la sezione con un’altra intestazione dello stesso livello.

```markdown
## Istruzioni
Rispondi in $1. Tono: ${2:diretto}.
```

```xml
<stile>Rispondi in $1. Tono: ${2:diretto}.</stile>
```

## Incorporare il frammento

`![sorgente:selettore(argomenti)]`

Ometti la sorgente per usare la nota corrente. I due punti separano solo la sorgente dal selettore.

- `![Modelli]` — Nota intera
- `![Modelli:3-8]` — Righe, estremi inclusi
- `![Modelli:#Stile]` — Sezione con intestazione
- `![Modelli:##Stile]` — Contenuto della sezione
- `![Modelli:##Capitolo#Stile]` — Contenuto della sottosezione
- `![Modelli:<stile>]` — Elemento con entrambi i tag
- `![Modelli:<<stile>>]` — Contenuto dell’elemento
- `![#Stile]` · `![##Stile]` — Sezione locale
- `![<stile>]` · `![<<stile>>]` — Tag locale

## Passare gli argomenti

Entrambe le chiamate producono il risultato seguente. `$1`–`$9` selezionano un valore, `$*` unisce tutti i valori e `${2:diretto}` sostituisce un valore mancante o vuoto. Racchiudi tra virgolette gli argomenti che contengono virgole. Passa esplicitamente i valori alle incorporazioni annidate.

```ce
![##Istruzioni(italiano)]
![<<stile>>(italiano)]
```

```text
Rispondi in italiano. Tono: diretto.
```

`![Condivisi:##Tono($1)]`

## Visualizzare e copiare

`ce` e `codeembed` mostrano la struttura. In `md` o `xml`, premi Anteprima. Copy+ copia il testo espanso. Il linguaggio del blocco controlla la presentazione.

## Limitare la ricerca a un pacchetto

Apri il menu della cartella con un clic destro o una pressione prolungata, oppure scegli una cartella dalla tavolozza dei comandi. Conferma il percorso del marcatore prima di rimuoverlo. Ogni cartella contrassegnata mostra il suo colore e **◆ Radice**. L’opzione, disattivata per impostazione predefinita, mostra **+ Radice** sulle altre cartelle.

**Mostra le azioni su tutte le cartelle** — Mostra «+ Radice» sulle cartelle senza marcatore e «◆ Radice» su tutte le radici dei pacchetti.

Code Embed usa la lingua dell’interfaccia di Obsidian. Le impostazioni mostrano la versione installata, il collegamento alla guida italiana e **Scegli la cartella del pacchetto**. Per contrassegnare una cartella manualmente, crea al suo interno una nota `_code-embed-root` (file `_code-embed-root.md`).

```text
Prompt/
  _code-embed-root.md
  Inizio.md
  Condivisi/
    Stile.md
```

`Prompt/Inizio.md` → `![Condivisi/Stile:##Tono]`

Il marcatore più vicino delimita l’intera espansione. I nomi brevi devono essere univoci. In caso di duplicati, scegli un percorso indicato nel messaggio di errore. I percorsi con una barra partono dalla radice del pacchetto. I pacchetti annidati sono indipendenti. Sposta la cartella insieme al marcatore per conservare i riferimenti.

## Compatibilità e migrazione

Nei blocchi di codice il parser riconosce le forme precedenti riportate nella tabella. Fuori dai blocchi, Obsidian gestisce le incorporazioni native di note, intestazioni e immagini. Quando cambi un nome, Code Embed salva in forma canonica i riferimenti che aggiorna.

| Sintassi precedente | Sintassi canonica |
| --- | --- |
| `![[Modelli:##Stile]]` | `![Modelli:##Stile]` |
| `$[##Stile]` | `![##Stile]` |
| `![.:<<stile>>]` | `![<<stile>>]` |
| `![Modelli##Stile]` | `![Modelli:##Stile]` |

## Installare la versione di sviluppo

```sh
npm run build
npm test
```

Copia `dist/{main.js,manifest.json,styles.css}` in `.obsidian/plugins/code-embed/`.

[Versioni](../../releases) · [CC BY-NC 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)
