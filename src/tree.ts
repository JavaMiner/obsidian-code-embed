export type TreeNode =
  | { type: "text"; text: string }
  | { type: "element"; tag: string; attrs: string; children: TreeNode[] }
  | { type: "import"; ref: string; children: TreeNode[] };
type Branch = Exclude<TreeNode, { type: "text" }> | { type: "root"; children: TreeNode[] };
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "wbr"]);

const importStart = String.fromCharCode(1);
const importBody = String.fromCharCode(2);
const importEnd = String.fromCharCode(3);

export function markImport(reference: string, body: string) {
  const label = reference
    .split(importStart)
    .join("")
    .split(importBody)
    .join("")
    .split(importEnd)
    .join("");
  return importStart + label + importBody + body + importEnd;
}

export function parseTree(text: string) {
  const root: Branch = { type: "root", children: [] };
  const stack: Branch[] = [root];
  const re = new RegExp(
    importStart +
      "([^" +
      importBody +
      "]*)" +
      importBody +
      "|(" +
      importEnd +
      ")|" +
      /<(\/?)([A-Za-z_][\w:.-]*)((?:\s[^<>]*?)?)(\/?)>/.source,
    "g",
  );
  const top = () => stack[stack.length - 1];
  const addText = (s: string) => {
    if (s) top().children.push({ type: "text", text: s });
  };
  let last = 0,
    m;
  while ((m = re.exec(text)) !== null) {
    addText(text.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] !== undefined) {
      const n: TreeNode = { type: "import", ref: m[1], children: [] };
      top().children.push(n);
      stack.push(n);
    } else if (m[2]) {
      for (let k = stack.length - 1; k > 0; k--)
        if (stack[k].type === "import") {
          stack.length = k;
          break;
        }
    } else {
      const closing = m[3] === "/",
        tag = m[4],
        attrs = (m[5] || "").trim();
      const self = m[6] === "/" || VOID_TAGS.has(tag.toLowerCase());
      if (closing) {
        let k = stack.length - 1;
        while (k > 0) {
          const ancestor = stack[k];
          if (ancestor.type === "element" && ancestor.tag === tag) break;
          if (ancestor.type === "import") {
            k = -1;
            break;
          }
          k--;
        }
        if (k > 0) stack.length = k;
        else addText(m[0]);
      } else {
        const n: TreeNode = { type: "element", tag, attrs, children: [] };
        top().children.push(n);
        if (!self) stack.push(n);
      }
    }
  }
  addText(text.slice(last));
  return root;
}

export function hasStructure(node: Branch) {
  return node.children.some((c) => c.type !== "text");
}
