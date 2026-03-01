import type { APIRoute } from "astro";

export const prerender = false;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestPayload {
  apiBase: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  messages: ChatMessage[];
}

const resolveEndpoint = (apiBase: string) => {
  const base = String(apiBase || "").trim();
  if (!base) return "";
  if (/\/chat\/completions\/?$/i.test(base)) return base;
  return `${base.replace(/\/$/, "")}/chat/completions`;
};

const extractText = (payload: any): string => {
  const choiceText = payload?.choices?.[0]?.message?.content;
  if (typeof choiceText === "string" && choiceText.trim()) return choiceText;

  const outputText = payload?.output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText;

  const message = payload?.message?.content;
  if (typeof message === "string" && message.trim()) return message;

  const contentArray = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(contentArray)) {
    const joined = contentArray
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim();
    if (joined) return joined;
  }

  return "";
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as RequestPayload;
    const endpoint = resolveEndpoint(body?.apiBase);

    if (!endpoint) {
      return new Response("apiBase is required", { status: 400 });
    }

    const model = String(body?.model || "").trim();
    if (!model) {
      return new Response("model is required", { status: 400 });
    }

    const messages = Array.isArray(body?.messages)
      ? body.messages
          .map((item) => ({ role: item?.role, content: String(item?.content || "") }))
          .filter((item) => ["system", "user", "assistant"].includes(String(item.role)) && item.content.trim())
      : [];

    if (!messages.length) {
      return new Response("messages is required", { status: 400 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (body.apiKey) {
      headers.Authorization = `Bearer ${body.apiKey}`;
    }

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: Math.max(0, Math.min(2, Number(body?.temperature ?? 0.7))),
        stream: false
      })
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return new Response(text || `upstream error ${upstream.status}`, { status: upstream.status });
    }

    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    const content = extractText(data);
    if (!content) {
      return Response.json({ content: "模型返回成功，但未解析到文本内容。", raw: data }, { status: 200 });
    }

    return Response.json({ content, raw: data }, { status: 200 });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "invalid request", { status: 500 });
  }
};

