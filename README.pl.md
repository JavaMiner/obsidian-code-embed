# Code Embed do Obsidiana

[English](README.md) · [Wydania](../../releases) · [Postaw mi kawę (Wise)](https://wise.com/pay/me/jakubw238)

Zamiast kopiować instrukcje do wielu promptów, trzymaj je w notatkach i składaj z fragmentów. Copy+ kopiuje rozwiniętą treść bloku, a View pozwala obejrzeć strukturę bez zmiany źródła.

> Zgodność: przykłady pokazują docelową składnię Code Embed `![x]`. Bieżący parser wersji 0.1.0 rozpoznaje wyłącznie natywną składnię osadzeń Obsidiana `![[x]]`. Aby uruchomić przykład w tej wersji, zamień pojedynczą parę nawiasów osadzenia na podwójną. Poza blokami kodu część osadzeń nadal obsługuje sam Obsidian.

## Lokalne osadzenia `$[...]`

`$[<tag>]` wstawia linie z tagiem, `$[<<tag>>]` tylko jego wnętrze, `$[#Sekcja]` sekcję z nagłówkiem, a `$[##Sekcja]` samą treść. Pełny zapis `$[.:<tag>]` nadal działa. Skrót wskazuje bieżącą notatkę: najpierw przeszukiwany jest bieżący blok kodu, potem plik.

Przykład: jeśli w bloku masz `<lh>localhost:$1</lh>`, `$[<<lh>>(8000)]` wstawi `localhost:8000`. `\$[<tag>]` pozostawia zapis dosłowny w rozwinięciu.

## Instalacja

Pobierz `main.js`, `manifest.json` i `styles.css` jako osobne załączniki wydania. Włóż je do `.obsidian/plugins/code-embed/` w swoim skarbcu i włącz Code Embed w Community plugins. Do lokalnego buildu uruchom `npm run build`, `npm test` i użyj plików z `dist/`.

## Składnia osadzeń

| Zapis | Wynik |
| --- | --- |
| `![x]` | Cała notatka bez frontmattera |
| `![x:#Sekcja]` | Sekcja razem z nagłówkiem |
| `![x:##Sekcja]` | Sama treść sekcji |
| `![x:##Rozdział#Podrozdział]` | Treść zagnieżdżonej sekcji |
| `![x:1-100]` | Linie 1–100 włącznie |
| `![x:5-]` | Od linii 5 do końca |
| `![x:1--1]` | Wszystkie linie oprócz ostatniej |
| `![x:<tag>]` | Całe linie od otwarcia do zamknięcia tagu |
| `![x:<<tag>>]` | Wnętrze tagu |
| `![.:<<tag>>]` | Wnętrze tagu w bieżącej notatce |

- Nazwa notatki jest rozwiązywana jak link Obsidiana. Przy unikalnych nazwach używaj samej nazwy pliku. Alias całej notatki po `|` jest ignorowany; nie używaj `|` w zakresie. Numeracja linii zaczyna się od 1 i obejmuje frontmatter. Zakres poza plikiem jest błędem.
- Sekcje H1–H6: pierwsze dopasowanie bez względu na wielkość liter; ignorowane są `*`, `_` i backticki. Sekcja kończy się przed następnym nagłówkiem tego samego lub wyższego poziomu. Nie używaj `#`, `(` ani `^` w nazwie; kotwice bloków nie są obsługiwane.
- Tagi: dokładne `<tag>` bez atrybutów i pasujące `</tag>`. Wygrywa pierwsze wystąpienie. Dozwolone są litery ASCII, cyfry, `_`, `:`, `.` i `-`. Wnętrze usuwa po jednym skrajnym znaku nowej linii; tekst jednoliniowy jest dodatkowo przycinany.
- `.` szuka najpierw w bieżącym bloku kodu, a potem w notatce. Osadzenia można zagnieżdżać; domyślny limit to 5 poziomów. Cykle, brak celu, zły zakres i przekroczenie limitu zwracają `[błąd: …]`. Backslash przed osadzeniem pozostawia je dosłownie.

## Argumenty

Zdefiniuj w `Fragmenty.md`: `<ocena>temat: $1; ocena: ${2:dobra}</ocena>`. Wywołanie `![Fragmenty:<<ocena>>(regeneracja)]` daje `temat: regeneracja; ocena: dobra`.

- `$1`–`$9` to pozycje, `$*` łączy argumenty przez `, `. `${n:tekst}` działa przy pustym lub pominiętym argumencie; tekst domyślny nie może zawierać `}`.
- Przecinek rozdziela argumenty. `![Fragmenty:<<ocena>>(regeneracja, "dobra, ale nierówna")]` przekazuje dwa argumenty. Podwójne cudzysłowy lub backticki grupują argument i nie trafiają do wyniku; nie można ich escapować.
- Bez nawiasów podstawiają się tylko wartości domyślne. Brakujący `$3` bez wartości domyślnej pozostaje dosłowny. `\$` oznacza dosłowny dolar w wywołaniu z nawiasami, nawet pustymi `()`.
- Argumenty działają dla tagów i sekcji, nie dla całych notatek ani zakresów linii. Przekazanie argumentu dalej: `![Inne:<<tag>>($1)]` wewnątrz parametryzowanego fragmentu.

## Podgląd, nawigacja i zmiana nazw

- `ce` i `codeembed` otwierają podgląd od razu oraz pokazują tylko Copy+. `xml`, `md` i `markdown` mają zwykły podgląd kodu i osobny View. W Live Preview odwołanie znowu widać, gdy edytujesz jego linię. Krótkie jednoliniowe importy w drzewie mogą być zwinięte do chipa; ustawienie 0 wyłącza to zwijanie.
- Panel Code Embed pokazuje błędy i odwołania; integracja z panelami Obsidiana pokazuje odwołania wychodzące i zwrotne. Możesz wyłączyć pokazywanie zagnieżdżonych zależności i przejść do wystąpienia lub celu z panelu.
- Polecenia Rename zmieniają nazwę notatki, tagu lub nagłówka i aktualizują obsługiwane odwołania. Można wywołać Rename na celu pod kursorem i konwertować tag XML na nagłówek lub odwrotnie. Po konwersji sprawdź ścieżki wielopoziomowe i powtarzające się nazwy. Automatyczne aktualizacje i ostrzeżenia o zerwanych odwołaniach można wyłączyć w ustawieniach.

## Przykład: prompt do pisania promptów

Zapisz reguły ogólne w notatce `Fragmenty`, pod nagłówkiem `Styl`. Przykład poniżej jest skróconą adaptacją promptu i używa składni docelowej; do wersji 0.1.0 zastosuj uwagę o zgodności powyżej.

~~~markdown
```ce
<obsidian_code_embed_prompt_writer>
# Kontekst
Piszę w Obsidianie z Code Embed. Zamiast kopiować wspólne instrukcje, odwołuj się do gotowych fragmentów.

# Zadanie
Gdy proszę o prompt, zwróć jeden blok kodu `ce`, `md` albo `xml`. Nie wstawiaj wewnątrz niego kolejnych ogrodzeń kodu; przykłady zapisuj wcięciem.

# Styl
![Fragmenty:##Styl]

# Reguły osadzeń
Używaj nazwy notatki bez pełnej ścieżki, jeżeli jest unikalna. Aby pokazać zapis dosłownie, użyj `\![Fragmenty:##Styl]`.
</obsidian_code_embed_prompt_writer>
```
~~~

Autor: Jakub Wajda. Licencja: [CC BY-NC 4.0](LICENSE). Wsparcie przez Wise jest dobrowolne i nie odblokowuje funkcji.
