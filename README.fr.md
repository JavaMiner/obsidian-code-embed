# Code Embed · Guide de la version de développement

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![License](https://img.shields.io/badge/license-CC_BY--NC_4.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Définir un fragment

Dans la palette, choisir **Insérer une balise XML** ou **Insérer une section Markdown**. Saisir un nom et toucher OK. Un nom vide crée une paire `var` ou sélectionne `Nom du fragment` pour le remplacer. Le texte sélectionné devient le contenu. Confirmer `_xvar` ou `_mvar` avec **Développer le raccourci**.

Placer ces définitions équivalentes dans deux notes, ou terminer la section par un autre titre de même niveau.

```markdown
## Instrukcje
Odpowiedz po $1. Ton: ${2:rzeczowy}.
```

```xml
<styl>Odpowiedz po $1. Ton: ${2:rzeczowy}.</styl>
```

## Insérer le fragment

`![źródło:selektor(argumenty)]`

Omettre la source pour la note courante. Les deux-points séparent uniquement la source du sélecteur.

- `![Szablony]` — Note entière
- `![Szablony:3-8]` — Lignes, bornes incluses
- `![Szablony:#Styl]` — Section avec titre
- `![Szablony:##Styl]` — Contenu de la section
- `![Szablony:##Rozdział#Styl]` — Contenu de la sous-section
- `![Szablony:<styl>]` — Élément avec ses balises
- `![Szablony:<<styl>>]` — Contenu de l’élément
- `![#Styl]` · `![##Styl]` — Section locale
- `![<styl>]` · `![<<styl>>]` — Balise locale

## Passer des arguments

Les deux appels donnent le résultat ci-dessous. `$1`–`$9` sélectionnent une valeur, `$*` les réunit et `${2:rzeczowy}` remplace une valeur absente ou vide. Entourer de guillemets les arguments contenant une virgule. Transmettre explicitement les valeurs aux imports imbriqués.

```ce
![##Instrukcje(polsku)]
![<<styl>>(polsku)]
```

```text
Odpowiedz po polsku. Ton: rzeczowy.
```

`![Wspólne:##Ton($1)]`

## Prévisualiser et copier

Les blocs `ce` et `codeembed` affichent la structure. Pour `md` ou `xml`, toucher Aperçu. Copy+ copie le texte développé. Le langage du bloc règle la présentation.

## Limiter la recherche à un paquet

Toucher **+ Racine** ou **◆ Racine** à côté du dossier, ouvrir le menu par appui long ou choisir le dossier dans la palette. Toucher son nom le déplie. Le marquage crée le fichier indiqué ci-dessous. Confirmer son chemin pour le retirer.

```text
Prompts/
  _code-embed-root.md
  Start.md
  Wspólne/
    Styl.md
```

`Prompts/Start.md` → `![Wspólne/Styl:##Ton]`

Le marqueur le plus proche délimite toute la résolution. Un nom court doit être unique. En cas de doublon, choisir un chemin proposé dans le diagnostic. Un chemin avec une barre oblique part de la racine du paquet. Les paquets imbriqués sont distincts. Déplacer le dossier avec son marqueur pour conserver les références.

## Compatibilité et migration

Dans les blocs de code, le parseur lit les anciennes formes ci-dessous. Hors des blocs, Obsidian gère les inclusions natives de notes, titres et images. Rename réécrit les inclusions modifiées sous forme canonique.

| Legacy | → |
| --- | --- |
| `![[Szablony:##Styl]]` | `![Szablony:##Styl]` |
| `$[##Styl]` | `![##Styl]` |
| `![.:<<styl>>]` | `![<<styl>>]` |
| `![Szablony##Styl]` | `![Szablony:##Styl]` |

## Installer la version de développement

```sh
npm run build
npm test
```

`dist/{main.js,manifest.json,styles.css}` → `.obsidian/plugins/code-embed/`

[Releases](../../releases) · [CC BY-NC 4.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363)
