# Code Embed · Guida alla versione di sviluppo

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Versione](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![Licenza](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Definire un frammento

Salva l’istruzione finale comune a più prompt in una nota chiamata `Modelli`. Se la modifichi, la prossima copia di ciascun prompt includerà la modifica.

```xml
<VARIABILE>Fornisci tre esempi.</VARIABILE>
```

Inserisci il blocco seguente in un’altra nota. Premi **⧉ Copy+** e incolla il risultato: `Fornisci tre esempi.`

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

### Variabili e tag in linea

I selettori di tag funzionano anche tra apici e nel codice in linea. Usa `\![<<sys:package>>]` per mantenere il testo letterale.

```md
Pacchetto `![<<sys:package>>]`, nota `![<<sys:note>>]`
```

[Variabili e regole di espansione](SYSTEM-VARIABLES.md)

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

⧉ copia il testo espanso. 👁️ mostra il blocco o apre un pannello di lettura collegato alla nota. ⚙️ apre le impostazioni del linguaggio o della nota. Per impostazione predefinita sono selezionati i blocchi senza linguaggio, Markdown, XML e CE.

In cima alla nota, 🔒 crea e apre una copia nella stessa cartella con i riferimenti espansi nel testo e in tutti i blocchi. Conserva le proprietà e la nota originale.

In ⚙️ puoi eliminare un formato o aggiungerne uno in fondo alla lista. La barra del blocco ha un’opacità iniziale del 20 %, regolabile da ⚙️. Diventa opaca al passaggio del puntatore sul blocco. 📝 Modifica apre la descrizione del pacchetto in una scheda dell’editor. Anche questa etichetta può essere nascosta. I marcatori precedenti con trattino basso restano validi.

⚙️ → `[name].perm.[date].v[version].md` → `test.perm.20261206.v1.md` I marcatori precedenti con trattino basso restano validi.

## Limitare la ricerca a un pacchetto

Apri il menu della cartella con un clic destro o una pressione prolungata, oppure scegli una cartella dalla tavolozza dei comandi. Conferma il percorso del marcatore prima di rimuoverlo. Ogni cartella contrassegnata mostra il suo colore e **📝 Modifica**. L’opzione, disattivata per impostazione predefinita, mostra **+ Radice** sulle altre cartelle.

**Mostra le azioni su tutte le cartelle** — Mostra «+ Radice» sulle cartelle senza marcatore e «📝 Modifica» su tutte le radici dei pacchetti.

Code Embed usa la lingua dell’interfaccia di Obsidian. Le impostazioni mostrano la versione installata, il collegamento alla guida italiana e **Scegli la cartella del pacchetto**. Per contrassegnare una cartella manualmente, crea al suo interno una nota `.code-embed-root` (file `.code-embed-root.md`).

```text
Prompt/
  .code-embed-root.md
  Inizio.md
  Condivisi/
    Stile.md
```

`Prompt/Inizio.md` → `![Condivisi/Stile:##Tono]`

Il marcatore più vicino delimita l’intera espansione. I nomi brevi devono essere univoci. In caso di duplicati, scegli un percorso indicato nel messaggio di errore. I percorsi con una barra partono dalla radice del pacchetto. I pacchetti annidati sono indipendenti. Sposta la cartella insieme al marcatore per conservare i riferimenti.

## Installare la versione di sviluppo

```sh
npm run build
npm test
```

Copia `dist/{main.js,manifest.json,styles.css}` in `.obsidian/plugins/code-embed/`.

L’uso commerciale è consentito. Se distribuisci una versione modificata, includi la licenza, conserva l’attribuzione a Jakub Wajda (JavaMiner) riportata in NOTICE per il codice riutilizzato e indica i file modificati.

> ⚠️ **Fase iniziale di sviluppo.** Code Embed è ancora in costruzione e l’interfaccia può ancora cambiare. La sintassi dovrebbe restare in gran parte invariata, ma sono ancora possibili piccoli aggiustamenti. Ogni modifica di questo tipo sarà indicata chiaramente nella documentazione.

[Versioni](../../releases) · [Apache 2.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6) · [Ko-fi](https://ko-fi.com/x480447)
