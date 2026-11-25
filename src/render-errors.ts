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
    el.createSpan({ cls: "ce-err", text: m[0] });
    last = re.lastIndex;
  }
  if (last < text.length) el.append(text.slice(last));
  return found;
}
