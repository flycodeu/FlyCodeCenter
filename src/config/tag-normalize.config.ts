const TAG_ALIAS_MAP: Record<string, string> = {
  springboot: "SpringBoot",
  "spring boot": "SpringBoot",
  "spring-boot": "SpringBoot",
  ffmpeg: "FFmpeg",
  websocket: "WebSocket",
  mysql: "MySQL",
  centos: "CentOS7",
  centos7: "CentOS7",
  redis: "Redis",
  docker: "Docker",
  jenkins: "Jenkins",
  ai: "AI",
  mediamtx: "MediaMTX",
  "langchain4j": "LangChain4j",
  sse: "SSE",
  mcp: "MCP",
  java: "Java",
  git: "Git",
  astro: "Astro",
  typescript: "TypeScript",
  javascript: "JavaScript"
};

function normalizeKey(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeTag(tag: string): string {
  const raw = String(tag || "").trim();
  if (!raw) return "";
  const mapped = TAG_ALIAS_MAP[normalizeKey(raw)];
  return mapped || raw;
}

export function normalizeTags(tags: Array<string | undefined | null>): string[] {
  const dedupe = new Set<string>();
  const output: string[] = [];
  for (const item of tags) {
    const normalized = normalizeTag(String(item || ""));
    if (!normalized) continue;
    if (dedupe.has(normalized)) continue;
    dedupe.add(normalized);
    output.push(normalized);
  }
  return output;
}

export default TAG_ALIAS_MAP;
