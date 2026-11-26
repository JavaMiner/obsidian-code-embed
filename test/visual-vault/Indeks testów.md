# Indeks testów

Otwórz tę notatkę w trybie czytania z włączoną wtyczką **Code Embed**. Każdy link prowadzi do osobnej karty. Pod linkiem Obsidian wyświetla rzeczywistą próbę z tej karty. Wejdź na kartę, aby skopiować dokładny zapis i porównać wynik.

## Próby wizualne

### [[Próby/CE-01|CE-01 · Cała notatka]]

Blok zawiera trzy wiersze, w kolejności źródła.

![[Próby/CE-01#Próba na żywo]]

### [[Próby/CE-02|CE-02 · Zakres wierszy]]

Pierwszy kolor znika. Pozostałe zajmują osobne wiersze.

![[Próby/CE-02#Próba na żywo]]

### [[Próby/CE-03|CE-03 · Do końca notatki]]

Widać tylko ostatni wiersz.

![[Próby/CE-03#Próba na żywo]]

### [[Próby/CE-04|CE-04 · Sekcja z nagłówkiem]]

Nagłówki są częścią wyniku. W bloku kodu widać również znaki #.

![[Próby/CE-04#Próba na żywo]]

### [[Próby/CE-05|CE-05 · Ścieżka nagłówków]]

Wybrana jest druga sekcja Cel.

![[Próby/CE-05#Próba na żywo]]

### [[Próby/CE-06|CE-06 · XML z tagami]]

Znaczniki otaczają wartość.

![[Próby/CE-06#Próba na żywo]]

### [[Próby/CE-07|CE-07 · Wnętrze XML]]

Widać samo słowo.

![[Próby/CE-07#Próba na żywo]]

### [[Próby/CE-08|CE-08 · Dwa argumenty]]

W podglądzie słowo morski jest pogrubione.

![[Próby/CE-08#Próba na żywo]]

### [[Próby/CE-09|CE-09 · Wartość domyślna]]

Brak drugiego argumentu daje jasny.

![[Próby/CE-09#Próba na żywo]]

### [[Próby/CE-10|CE-10 · Argument z przecinkiem]]

Cudzysłów chroni przecinek w pierwszym argumencie. Ostatnie pole łączy wszystkie argumenty.

![[Próby/CE-10#Próba na żywo]]

### [[Próby/CE-11|CE-11 · Przekazanie argumentu]]

Wartość przechodzi przez drugą notatkę; koralowy jest pogrubione.

![[Próby/CE-11#Próba na żywo]]

### [[Próby/CE-12|CE-12 · Osadzenie w zdaniu]]

Całość pozostaje w jednym akapicie.

![[Próby/CE-12#Próba na żywo]]

### [[Próby/CE-13|CE-13 · Fragment lokalny]]

Tekst pochodzi z tej samej karty.

![[Próby/CE-13#Próba na żywo]]

### [[Próby/CE-14|CE-14 · Diagnostyka zakresu]]

Widać komunikat błędu dla zakresu 7–8. Źródło ma trzy wiersze. Treść komunikatu zależy od języka aplikacji.

![[Próby/CE-14#Próba na żywo]]

## Testy automatyczne

Te testy uruchamia terminal w katalogu repozytorium po wykonaniu `npm ci` i `npm run build`. Każdy link otwiera opis z poleceniem uruchamiającym dokładnie jeden przypadek.

- [[Automaty/AT-01|AT-01 · single brackets and local shorthand]]

- [[Automaty/AT-02|AT-02 · canonical forms, legacy input and native embeds]]

- [[Automaty/AT-03|AT-03 · Markdown and XML expand identically with explicit forwarding]]

- [[Automaty/AT-04|AT-04 · package scope, ambiguity, traversal, nested roots and local import context]]

- [[Automaty/AT-05|AT-05 · moving a package preserves root-relative paths; unmarking restores vault lookup]]

- [[Automaty/AT-06|AT-06 · moving a source out of a package reports a lost binding]]

- [[Automaty/AT-07|AT-07 · numbered and joined arguments are shared by XML and Markdown]]

- [[Automaty/AT-08|AT-08 · package-aware Rename changes only references to the old target]]

- [[Automaty/AT-09|AT-09 · source root stays fixed when an unmarked entry imports a marked note]]

- [[Automaty/AT-10|AT-10 · marked folders resolve existing includes throughout the package]]

- [[Automaty/AT-11|AT-11 · shortened paths report duplicates and package-relative paths take priority]]

- [[Automaty/AT-12|AT-12 · same-note list items expand XML selectors in prose and bash blocks]]

- [[Automaty/AT-13|AT-13 · reading view restores two XML selectors split by Markdown HTML processing]]

- [[Automaty/AT-14|AT-14 · reading view unwraps a single paragraph without losing inline markup]]

- [[Automaty/AT-15|AT-15 · Live Preview unwraps inline embeds before measuring the widget]]

- [[Automaty/AT-16|AT-16 · parameterized XML reference]]

- [[Automaty/AT-17|AT-17 · default English]]

- [[Automaty/AT-18|AT-18 · Polish locale]]

- [[Automaty/AT-19|AT-19 · release versions match]]

- [[Automaty/AT-20|AT-20 · release metadata, funding and build output]]

- [[Automaty/AT-21|AT-21 · seven guides share examples, using only canonical syntax]]

- [[Automaty/AT-22|AT-22 · clipboard access remains write-only]]

- [[Automaty/AT-23|AT-23 · the build embeds dictionaries for both LF and Windows CRLF checkouts]]

- [[Automaty/AT-24|AT-24 · all bundled languages define the English translation keys]]

- [[Automaty/AT-25|AT-25 · marked folders stay visible across note switches and only unmarked actions depend on settings]]

- [[Automaty/AT-26|AT-26 · app language determines folder labels for every documented locale]]

- [[Automaty/AT-27|AT-27 · single-folder context menus support both explorer events and add one working action]]

- [[Automaty/AT-28|AT-28 · documentation follows the app language including unsupported-language fallback]]

- [[Automaty/AT-29|AT-29 · older hosts use the legacy locale, panel activation and native deletion prompt]]

- [[Automaty/AT-30|AT-30 · a replaced package marker survives a pending confirmation]]

- [[Automaty/AT-31|AT-31 · dist/main.js registers translated commands on startup for pl-PL]]

- [[Automaty/AT-32|AT-32 · dist/main.js registers translated commands on startup for fr-FR]]

- [[Automaty/AT-33|AT-33 · dist/main.js registers translated commands on startup for sv-SE]]
