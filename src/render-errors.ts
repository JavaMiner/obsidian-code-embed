import { ERROR_PATTERN } from "./fragments";

export function renderErrorsInText(el: HTMLElement, text: string) {
  el.textContent = "";
  const re = new RegExp(ERROR_PATTERN.source, "g");
  let last = 0,
    m,
    found = false;
  while ((m = re.exec(text)) !== null) {
    found = true;
    if (m.index > last) el.append(text.slice(last, m.index));
    const s = document.createElement("span");
    s.className = "ce-err";
    s.textContent = m[0];
    el.append(s);
    last = re.lastIndex;
  }
  if (last < text.length) el.append(text.slice(last));
  return found;
}
