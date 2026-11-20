# Code Embed do Obsidiana

[English](README.md) · [Wsparcie projektu](SUPPORT.pl.md)

Wstawiaj fragmenty notatek do promptów. Bloki `ce` i `codeembed` od razu pokazują drzewo i tylko przycisk `Copy+`. W `xml` i `md` przełącznik `Podgląd` otwiera drzewo na żądanie.

~~~markdown
```ce
<zadanie>
![[Fragmenty:##Instrukcje]]
</zadanie>
```
~~~

## Instalacja

Skopiuj `main.js`, `manifest.json` i `styles.css` z wydania (lub z `dist/` po `npm run build`) do `.obsidian/plugins/code-embed/`. Włącz wtyczkę w ustawieniach Obsidiana. Najpierw sprawdź ją w testowym skarbcu.

## Składnia

- `![[Notatka]]` – cała treść bez frontmattera.
- `![[Notatka:#Tytuł]]` / `![[Notatka:##Tytuł]]` – sekcja z nagłówkiem / bez nagłówka.
- `![[Notatka:<tag>]]` / `![[Notatka:<<tag>>]]` – całe linie tagu / jego wnętrze.
- `![[.:<<tag>>(8000)]]` – lokalny tag z argumentem `$1`.
- `![[Notatka:1-10]]` – linie 1–10 włącznie.
