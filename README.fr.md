# Code Embed · Guide de la version de développement

[![CI](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcanonical-embeds-packages)](https://github.com/JavaMiner/obsidian-code-embed/actions/workflows/ci.yml) [![Version](https://img.shields.io/github/v/release/JavaMiner/obsidian-code-embed)](../../releases) [![Licence](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

[PL](README.pl.md) · [EN](README.md) · [DE](README.de.md) · [FR](README.fr.md) · [ES](README.es.md) · [NL](README.nl.md) · [IT](README.it.md)

## Définir un fragment

Conservez la consigne finale commune à plusieurs prompts dans une note nommée `Modèles`. Si vous la modifiez, la prochaine copie de chaque prompt utilisera le nouveau texte.

```xml
<VARIABLE>Donnez trois exemples.</VARIABLE>
```

Insérez le bloc suivant dans une autre note. Sélectionnez **Copy+**, puis collez le résultat : `Donnez trois exemples.`

```ce
![Modèles:<<VARIABLE>>]
```

Placez ces définitions équivalentes dans deux notes distinctes ou terminez la section par un autre titre de même niveau.

```markdown
## Instructions
Répondez en $1. Ton : ${2:direct}.
```

```xml
<style>Répondez en $1. Ton : ${2:direct}.</style>
```

## Insérer un fragment

`![source:sélecteur(arguments)]`

Omettez la source pour utiliser la note courante. Le deux-points sépare uniquement la source du sélecteur.

- `![Modèles]` — Note entière
- `![Modèles:3-8]` — Lignes, bornes incluses
- `![Modèles:#Style]` — Section avec son titre
- `![Modèles:##Style]` — Contenu de la section
- `![Modèles:##Chapitre#Style]` — Contenu de la sous-section
- `![Modèles:<style>]` — Élément avec ses balises
- `![Modèles:<<style>>]` — Contenu de l’élément
- `![#Style]` · `![##Style]` — Section locale
- `![<style>]` · `![<<style>>]` — Balise locale

## Passer des arguments

Les deux appels donnent le résultat ci-dessous. `$1`–`$9` sélectionnent un argument, `$*` réunit tous les arguments et `${2:direct}` fournit une valeur par défaut lorsque le deuxième argument est absent ou vide. Entourez de guillemets les arguments contenant des virgules. Transmettez explicitement les arguments aux inclusions imbriquées.

```ce
![##Instructions(français)]
![<<style>>(français)]
```

```text
Répondez en français. Ton : direct.
```

`![Commun:##Ton($1)]`

## Prévisualiser et copier

En édition et en lecture, **Copy+** copie le bloc développé, **Aperçu** l’affiche et **Permanent** remplace dans la source les références comme `$[Modèles]`. Si un fragment manque, le remplacement est annulé. Les blocs CE affichent leur structure dès l’ouverture.

En haut de la note, ces boutons agissent sur toute la note. L’aperçu ouvre deux volets liés, en édition et en lecture. Sur téléphone, il change de mode. Les blocs sans langage, Markdown, XML et CE sont sélectionnés par défaut. Les réglages permettent d’ajouter d’autres langages. Les délimiteurs peuvent contenir trois accents graves ou tildes, ou davantage.

## Limiter la recherche à un paquet

Ouvrez le menu du dossier par clic droit ou appui long, ou choisissez un dossier dans la palette de commandes. Confirmez le chemin du marqueur avant de le retirer. Chaque dossier marqué affiche sa couleur et **◆ Racine**. Activez **Afficher les actions sur tous les dossiers** pour afficher aussi **+ Racine** sur les dossiers sans marqueur. Cette option est désactivée par défaut.

Code Embed utilise la langue de l’interface d’Obsidian. Ses réglages affichent la version installée, un lien vers le guide français et **Choisir le dossier du paquet**. Pour marquer un dossier manuellement, créez-y une note `_code-embed-root` (fichier `_code-embed-root.md`).

```text
Prompts/
  _code-embed-root.md
  Départ.md
  Commun/
    Style.md
```

`Prompts/Départ.md` → `![Commun/Style:##Ton]`

Le marqueur le plus proche délimite toute la résolution. Un nom court doit être unique. En cas d’ambiguïté, choisissez un chemin proposé dans le message d’erreur. Un chemin contenant une barre oblique part de la racine du paquet. Les paquets imbriqués sont distincts. Déplacez le dossier avec son marqueur pour conserver les références.

## Installer la version de développement

```sh
npm run build
npm test
```

Copiez `dist/{main.js,manifest.json,styles.css}` dans `.obsidian/plugins/code-embed/`.

L’utilisation commerciale est autorisée. Si vous distribuez une version modifiée, joignez la licence, conservez la mention de Jakub Wajda (JavaMiner) figurant dans NOTICE pour le code repris et signalez les fichiers modifiés.

[Versions](../../releases) · [Apache 2.0](LICENSE) · Jakub Wajda · [Buy me a coffee](https://buymeacoffee.com/javaminer) · [PayPal](https://www.paypal.me/JakubWajda363) · [Wise](https://wise.com/pay/me/jakubw238) · [Revolut](https://revolut.me/jakubwt6)
