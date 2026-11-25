# Code Embed · Guía de la versión de desarrollo

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Versión](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![Licencia](https://img.shields.io/badge/license-CC_BY_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Definir un fragmento

Guarda la instrucción final de varios prompts en una nota llamada `Plantillas`. Si la editas, la próxima copia de cada prompt incluirá el cambio.

```xml
<VARIABLE>Da tres ejemplos.</VARIABLE>
```

Inserta el siguiente bloque en otra nota. Pulsa **Copy+** y pega el resultado: `Da tres ejemplos.`

```ce
![Plantillas:<<VARIABLE>>]
```

Coloca estas definiciones equivalentes en notas distintas o termina la sección con otro encabezado del mismo nivel.

```markdown
## Instrucciones
Responde en $1. Tono: ${2:directo}.
```

```xml
<estilo>Responde en $1. Tono: ${2:directo}.</estilo>
```

## Insertar el fragmento

`![origen:selector(argumentos)]`

Omite el origen para usar la nota actual. Los dos puntos solo separan el origen del selector.

- `![Plantillas]` — Nota completa
- `![Plantillas:3-8]` — Líneas, extremos incluidos
- `![Plantillas:#Estilo]` — Sección con encabezado
- `![Plantillas:##Estilo]` — Contenido de la sección
- `![Plantillas:##Capitulo#Estilo]` — Contenido de la subsección
- `![Plantillas:<estilo>]` — Elemento con sus etiquetas
- `![Plantillas:<<estilo>>]` — Contenido del elemento
- `![#Estilo]` · `![##Estilo]` — Sección local
- `![<estilo>]` · `![<<estilo>>]` — Etiqueta local

## Pasar argumentos

Ambas llamadas producen el resultado siguiente. `$1`–`$9` seleccionan un valor, `$*` los une y `${2:directo}` sustituye un valor ausente o vacío. Pon entre comillas los argumentos que contengan comas. Pasa los valores explícitamente a las inserciones anidadas.

```ce
![##Instrucciones(español)]
![<<estilo>>(español)]
```

```text
Responde en español. Tono: directo.
```

`![Compartido:##Tono($1)]`

## Previsualizar y copiar

`ce` y `codeembed` muestran la estructura. En `md` o `xml`, pulsa Vista previa. Copy+ copia el texto expandido. El lenguaje del bloque controla la presentación.

## Limitar la búsqueda a un paquete

Abre el menú de la carpeta con un clic derecho o una pulsación larga, o elige una carpeta en la paleta de comandos. Confirma la ruta del marcador al quitarlo. Cada carpeta marcada muestra su color y **◆ Raíz**. La opción, desactivada por defecto, muestra **+ Raíz** en las demás carpetas.

**Mostrar acciones en todas las carpetas** — Muestra «+ Raíz» en las carpetas sin marcador y «◆ Raíz» en todas las raíces de paquete.

Code Embed utiliza el idioma de la interfaz de Obsidian. Sus ajustes muestran la versión instalada, un enlace a la guía en español y **Elegir carpeta del paquete**. Para marcar una carpeta manualmente, crea dentro una nota `_code-embed-root` (archivo `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Inicio.md
  Compartido/
    Estilo.md
```

`Prompts/Inicio.md` → `![Compartido/Estilo:##Tono]`

El marcador más cercano delimita toda la expansión. Los nombres cortos deben ser únicos. Si hay duplicados, utiliza una ruta indicada en el mensaje de error. Las rutas con barra parten de la raíz del paquete. Los paquetes anidados son independientes. Mueve la carpeta con su marcador para conservar las referencias.

## Compatibilidad y migración

Dentro de los bloques de código se reconocen las formas antiguas de la tabla. Fuera de ellos, Obsidian gestiona las inserciones nativas de notas, encabezados e imágenes. Al cambiar un nombre, Code Embed guarda las referencias que actualiza en la forma canónica.

| Sintaxis anterior | Sintaxis canónica |
| --- | --- |
| `![[Plantillas:##Estilo]]` | `![Plantillas:##Estilo]` |
| `$[##Estilo]` | `![##Estilo]` |
| `![.:<<estilo>>]` | `![<<estilo>>]` |
| `![Plantillas##Estilo]` | `![Plantillas:##Estilo]` |

## Instalar la versión de desarrollo

```sh
npm run build
npm test
```

Copia `dist/{main.js,manifest.json,styles.css}` a `.obsidian/plugins/code-embed/`.

Se permite el uso comercial. Si compartes Code Embed o una versión modificada, reconoce a Jakub Wajda (JavaMiner) como autor original, incluye un enlace a la licencia e indica los cambios que hayas realizado.

[Versiones](../../releases) · [CC BY 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)
