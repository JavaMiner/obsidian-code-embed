# Code Embed · Guía de la versión de desarrollo

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Versión](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![Licencia](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Definir un fragmento

Guarda la instrucción final de varios prompts en una nota llamada `Plantillas`. Si la editas, la próxima copia de cada prompt incluirá el cambio.

```xml
<VARIABLE>Da tres ejemplos.</VARIABLE>
```

Inserta el siguiente bloque en otra nota. Pulsa **⧉ Copy+** y pega el resultado: `Da tres ejemplos.`

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

### Variables y etiquetas en línea

Los selectores de etiquetas también funcionan entre comillas simples y en código en línea. Escribe `\![<<sys:package>>]` para conservar el texto literal.

```md
Paquete `![<<sys:package>>]`, nota `![<<sys:note>>]`
```

[Variables y reglas de expansión](SYSTEM-VARIABLES.md)

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

⧉ copia el texto expandido. 👁️ muestra el bloque o abre un panel de lectura vinculado a la nota. ⚙️ abre los ajustes del lenguaje o de la nota. Por defecto se seleccionan los bloques sin lenguaje, Markdown, XML y CE.

En la parte superior de la nota, 🔒 crea y abre una copia en la misma carpeta, con las referencias expandidas en el texto y en todos los bloques. Conserva las propiedades y la nota original.

En ⚙️ puedes eliminar formatos o añadirlos al final de la lista. La barra del bloque tiene una opacidad del 20 % en reposo, ajustable en ⚙️. Al pasar el puntero por el bloque se vuelve opaca. 📝 Editar abre la descripción del paquete en una pestaña del editor. Su etiqueta también se puede ocultar. Los marcadores anteriores con guion bajo siguen funcionando.

⚙️ → `[name].perm.[date].v[version].md` → `test.perm.20261206.v1.md` Los marcadores anteriores con guion bajo siguen funcionando.

## Limitar la búsqueda a un paquete

Abre el menú de la carpeta con un clic derecho o una pulsación larga, o elige una carpeta en la paleta de comandos. Confirma la ruta del marcador al quitarlo. Cada carpeta marcada muestra su color y **📝 Editar**. La opción, desactivada por defecto, muestra **+ Raíz** en las demás carpetas.

**Mostrar acciones en todas las carpetas** — Muestra «+ Raíz» en las carpetas sin marcador y «📝 Editar» en todas las raíces de paquete.

Code Embed utiliza el idioma de la interfaz de Obsidian. Sus ajustes muestran la versión instalada, un enlace a la guía en español y **Elegir carpeta del paquete**. Para marcar una carpeta manualmente, crea dentro una nota `.code-embed-root` (archivo `.code-embed-root.md`).

```text
Prompts/
  .code-embed-root.md
  Inicio.md
  Compartido/
    Estilo.md
```

`Prompts/Inicio.md` → `![Compartido/Estilo:##Tono]`

El marcador más cercano delimita toda la expansión. Los nombres cortos deben ser únicos. Si hay duplicados, utiliza una ruta indicada en el mensaje de error. Las rutas con barra parten de la raíz del paquete. Los paquetes anidados son independientes. Mueve la carpeta con su marcador para conservar las referencias.

## Instalación

Descarga `main.js`, `manifest.json` y `styles.css` de la [última versión](../../releases/latest) y cópialos en `.obsidian/plugins/code-embed/` dentro de tu bóveda. Después activa **Code Embed** en Ajustes → Complementos de la comunidad. Los mismos tres archivos funcionan en Windows, macOS, Linux, iOS y Android; el complemento no está limitado al escritorio. En el móvil, copia la carpeta con tu servicio de sincronización o con la aplicación Archivos.

Los archivos de las versiones desde la 0.3.5 incluyen atestaciones de compilación de GitHub. Para verificarlas:

```sh
gh attestation verify main.js -R JavaMiner/obsidian-code-embed
```

Para compilar desde el código fuente:

```sh
npm ci
npm run build
npm test
```

Después copia `dist/{main.js,manifest.json,styles.css}` en la misma carpeta.

## Privacidad

Code Embed funciona de forma local. Lee las rutas de archivo de la bóveda para encontrar marcadores de paquete y lee notas solo para resolver referencias. Escribe en el portapapeles únicamente cuando ejecutas Copy+ y nunca lo lee. Detalles: [PRIVACY.md](PRIVACY.md).

Se permite el uso comercial. Al distribuir una versión modificada, incluye la licencia, conserva la atribución a Jakub Wajda (JavaMiner) de NOTICE para el código reutilizado e identifica los archivos modificados.

> ⚠️ **Fase inicial de desarrollo.** Code Embed aún está en construcción y su interfaz puede seguir cambiando. La sintaxis debería mantenerse en gran medida, pero aún son posibles pequeños ajustes. Cualquier cambio de este tipo se indicará claramente en la documentación.

[Versiones](../../releases) · [Apache 2.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6) · [Ko-fi](https://ko-fi.com/x480447)
