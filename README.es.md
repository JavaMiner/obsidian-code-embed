# Code Embed · Guía de la versión de desarrollo

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-CC_BY--NC_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Definir un fragmento

En la paleta, elige **Insert XML tag** o **Insert Markdown section**. Escribe un nombre y toca OK. Si lo dejas vacío, se crea un par `var` o se selecciona `Nazwa fragmentu` para sustituirlo. La selección previa pasa al cuerpo. Confirma `_xvar` o `_mvar` con **Expand shortcut**.

Coloca estas definiciones equivalentes en notas distintas o termina la sección con otro encabezado del mismo nivel.

```markdown
## Instrukcje
Odpowiedz po $1. Ton: ${2:rzeczowy}.
```

```xml
<styl>Odpowiedz po $1. Ton: ${2:rzeczowy}.</styl>
```

## Insertar el fragmento

`![źródło:selektor(argumenty)]`

Omite el origen para usar la nota actual. Los dos puntos solo separan el origen del selector.

- `![Szablony]` — Nota completa
- `![Szablony:3-8]` — Líneas, extremos incluidos
- `![Szablony:#Styl]` — Sección con encabezado
- `![Szablony:##Styl]` — Contenido de la sección
- `![Szablony:##Rozdział#Styl]` — Contenido de la subsección
- `![Szablony:<styl>]` — Elemento con etiquetas
- `![Szablony:<<styl>>]` — Contenido del elemento
- `![#Styl]` · `![##Styl]` — Sección local
- `![<styl>]` · `![<<styl>>]` — Etiqueta local

## Pasar argumentos

Ambas llamadas producen el resultado siguiente. `$1`–`$9` seleccionan un valor, `$*` los une y `${2:rzeczowy}` sustituye un valor ausente o vacío. Pon entre comillas los argumentos con comas. Pasa los valores explícitamente a las importaciones anidadas.

```ce
![##Instrukcje(polsku)]
![<<styl>>(polsku)]
```

```text
Odpowiedz po polsku. Ton: rzeczowy.
```

`![Wspólne:##Ton($1)]`

## Previsualizar y copiar

`ce` y `codeembed` muestran la estructura. En `md` o `xml`, toca View. Copy+ copia el texto expandido. El lenguaje del bloque controla la presentación.

## Limitar la búsqueda a un paquete

Toca **+ Root** o **◆ Root** junto a la carpeta, mantén pulsado para abrir el menú o elige la carpeta en la paleta. Toca su nombre para desplegarla. Al marcarla se crea el archivo indicado abajo. Confirma su ruta para eliminar el marcador.

```text
Prompts/
  _code-embed-root.md
  Start.md
  Wspólne/
    Styl.md
```

`Prompts/Start.md` → `![Wspólne/Styl:##Ton]`

El marcador más cercano delimita toda la expansión. Los nombres cortos deben ser únicos. Si hay duplicados, utiliza una ruta del diagnóstico. Las rutas con barra parten de la raíz del paquete. Los paquetes anidados son independientes. Mueve la carpeta con su marcador para conservar las referencias.

## Compatibilidad y migración

Dentro de un bloque de código se reconocen todas las formas antiguas siguientes. Fuera del bloque, Obsidian gestiona las inserciones nativas de notas, encabezados e imágenes. Rename guarda las referencias modificadas en forma canónica.

| Legacy | → |
| --- | --- |
| `![[Szablony:##Styl]]` | `![Szablony:##Styl]` |
| `$[##Styl]` | `![##Styl]` |
| `![.:<<styl>>]` | `![<<styl>>]` |
| `![Szablony##Styl]` | `![Szablony:##Styl]` |

## Instalar la versión de desarrollo

```sh
npm run build
npm test
```

`dist/{main.js,manifest.json,styles.css}` → `.obsidian/plugins/code-embed/`

[Releases](../../releases) · [CC BY-NC 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363)
