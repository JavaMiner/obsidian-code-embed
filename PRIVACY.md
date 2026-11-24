# Vault and clipboard access

Code Embed enumerates Markdown files to find references across the vault for backlinks, broken-reference checks, and reference updates when renaming. It reads individual notes to resolve embedded fragments. These operations use local Obsidian APIs.

Copy+ and the expanded-copy command write the selected block's expanded text to the system clipboard when invoked. They do not read the clipboard.

# Dostęp do skarbca i schowka

Code Embed listuje pliki Markdown, aby znajdować odwołania na potrzeby linków zwrotnych, sprawdzania zerwanych odwołań i ich aktualizacji przy zmianie nazw. Odczytuje pojedyncze notatki, aby rozwijać osadzane fragmenty. Te operacje korzystają z lokalnego API Obsidiana.

Copy+ i polecenie kopiowania rozwiniętego bloku zapisują jego treść do schowka na żądanie. Nie odczytują schowka.

## Package discovery

The package index enumerates local file paths to locate markers and compare candidates. Folder selection lists vault folders. Reference validation, backlinks and Rename can read Markdown notes across the vault. Expansion inside a package selects targets within its boundary. Copy+ uses `navigator.clipboard.writeText` after a user action. The support command opens the chosen payment provider in an external browser.

## Wykrywanie pakietów

Indeks odczytuje lokalne ścieżki, aby znaleźć znaczniki i rozróżnić pliki o tej samej nazwie. Polecenie wyboru katalogu wyświetla katalogi skarbca. Walidacja, linki zwrotne i Rename mogą odczytywać notatki Markdown w całym skarbcu. Rozwijanie w pakiecie wybiera cele w jego granicach. Polecenie wsparcia otwiera wybraną stronę płatności w przeglądarce.
