export function cjkNgramTokens(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const tokens: string[] = [];
  for (const word of cleaned.split(" ")) {
    if (!word) continue;
    if (/[\u3400-\u9fff]/.test(word)) {
      for (let i = 0; i < word.length; i += 1) {
        tokens.push(word[i]);
        if (i < word.length - 1) tokens.push(word.slice(i, i + 2));
      }
    } else {
      tokens.push(word);
    }
  }
  return [...new Set(tokens)];
}

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function makeSnippet(content: string, query: string, radius = 56): string {
  const source = content.replace(/\s+/g, " ").trim();
  if (!source) return "";
  const lower = source.toLowerCase();
  const key = query.toLowerCase();
  const at = lower.indexOf(key);
  const start = at >= 0 ? Math.max(0, at - radius) : 0;
  const end = at >= 0 ? Math.min(source.length, at + key.length + radius) : Math.min(source.length, 120);
  let snippet = source.slice(start, end);
  if (start > 0) snippet = `...${snippet}`;
  if (end < source.length) snippet = `${snippet}...`;
  return highlight(snippet, query);
}

export function highlight(text: string, query: string): string {
  if (!query.trim()) return text;
  const pattern = new RegExp(`(${escapeRegex(query)})`, "ig");
  return text.replace(pattern, "<mark>$1</mark>");
}
