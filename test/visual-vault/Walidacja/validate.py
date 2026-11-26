import re

expected = {
  "CE-01": "Czerwony\nZielony\nNiebieski",
  "CE-02": "Zielony\nNiebieski",
  "CE-03": "Niebieski",
  "CE-04": "## Rano\n### Cel\nSpacer",
  "CE-05": "Lektura",
  "CE-06": "<ton>Spokojnie</ton>",
  "CE-07": "Spokojnie",
  "CE-08": "Kolor: morski. Tryb: nocny.",
  "CE-09": "Kolor: morski. Tryb: jasny.",
  "CE-10": "A, B / C / A, B, C",
  "CE-11": "Kolor: koralowy. Tryb: jasny.",
  "CE-12": "Przed Spokojnie po.",
  "CE-13": "Tylko tutaj.",
  "CE-14": [
    "[Fehler: Bereich 7-8 außerhalb der Datei (1–3)]",
    "[error: Range 7-8 outside file (1–3)]",
    "[error: Intervalo 7-8 fuera del archivo (1–3)]",
    "[erreur: Plage 7-8 hors du fichier (1–3)]",
    "[errore: Intervallo 7-8 fuori dal file (1–3)]",
    "[fout: Bereik 7-8 buiten bestand (1–3)]",
    "[błąd: Zakres 7-8 poza zakresem pliku (1–3)]"
  ]
}
names = {
  "AT-01": "single brackets and local shorthand",
  "AT-02": "canonical forms, legacy input and native embeds",
  "AT-03": "Markdown and XML expand identically with explicit forwarding",
  "AT-04": "package scope, ambiguity, traversal, nested roots and local import context",
  "AT-05": "moving a package preserves root-relative paths; unmarking restores vault lookup",
  "AT-06": "moving a source out of a package reports a lost binding",
  "AT-07": "numbered and joined arguments are shared by XML and Markdown",
  "AT-08": "package-aware Rename changes only references to the old target",
  "AT-09": "source root stays fixed when an unmarked entry imports a marked note",
  "AT-10": "marked folders resolve existing includes throughout the package",
  "AT-11": "shortened paths report duplicates and package-relative paths take priority",
  "AT-12": "same-note list items expand XML selectors in prose and bash blocks",
  "AT-13": "reading view restores two XML selectors split by Markdown HTML processing",
  "AT-14": "reading view unwraps a single paragraph without losing inline markup",
  "AT-15": "Live Preview unwraps inline embeds before measuring the widget",
  "AT-16": "parameterized XML reference",
  "AT-17": "default English",
  "AT-18": "Polish locale",
  "AT-19": "release versions match",
  "AT-20": "release metadata, funding and build output",
  "AT-21": "seven guides share examples, using only canonical syntax",
  "AT-22": "clipboard access remains write-only",
  "AT-23": "the build embeds dictionaries for both LF and Windows CRLF checkouts",
  "AT-24": "all bundled languages define the English translation keys",
  "AT-25": "marked folders stay visible across note switches and only unmarked actions depend on settings",
  "AT-26": "app language determines folder labels for every documented locale",
  "AT-27": "single-folder context menus support both explorer events and add one working action",
  "AT-28": "documentation follows the app language including unsupported-language fallback",
  "AT-29": "older hosts use the legacy locale, panel activation and native deletion prompt",
  "AT-30": "a replaced package marker survives a pending confirmation",
  "AT-31": "dist/main.js registers translated commands on startup for pl-PL",
  "AT-32": "dist/main.js registers translated commands on startup for fr-FR",
  "AT-33": "dist/main.js registers translated commands on startup for sv-SE"
}
print("Paste CE lines (ID, space, actual text) and/or a TAP report. End with END.")
rows = []
while True:
    line = input()
    if line == "END":
        break
    rows.append(line)
for case, wanted in expected.items():
    actual = [line[len(case)+1:].replace(r"\n", "\n") for line in rows if line.startswith(case + " ")]
    allowed = wanted if isinstance(wanted, list) else [wanted]
    print(case, "MISSING" if not actual else "PASS" if len(actual) == 1 and actual[0] in allowed else "FAIL")
for case, title in names.items():
    matches = [m for line in rows if (m := re.fullmatch(r"(not ok|ok) \d+ - (.*)", line)) and (m[2] == title or m[2].startswith(title + " #"))]
    print(case, "MISSING" if not matches else "PASS" if len(matches) == 1 and matches[0].groups() == ("ok", title) else "FAIL")
