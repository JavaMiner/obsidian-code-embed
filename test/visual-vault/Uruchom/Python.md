# Python

Kliknij ▶ w bloku poniżej. Wynik pojawi się pod nim.

```javascript
const root = app.vault.adapter.getBasePath();
const {execFile} = window.require("node:child_process");
await new Promise(resolve => execFile("python", ["test/visual-vault/Uruchom/suite.py"], {cwd: root, windowsHide: true}, (error, stdout, stderr) => {
  console.log(stdout.trim() || "Brak wyników.");
  if (error) console.log("BŁĄD URUCHOMIENIA: " + (stderr.trim() || error.message));
  resolve();
}));
```
