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

const sseEvent = (event: string, data: Record<string, unknown>) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const extractDelta = (payload: any): string => {
  const delta = payload?.choices?.[0]?.delta?.content;
  if (typeof delta === "string") return delta;
  if (Array.isArray(delta)) {
    return delta
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("");
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
        stream: true
      })
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(text || `upstream error ${upstream.status}`, { status: upstream.status });
    }

    if (!upstream.body) {
      return new Response("upstream stream unavailable", { status: 502 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = "";
        let doneEventSent = false;

        const push = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        };

        const parseLine = (raw: string) => {
          const line = raw.trim();
          if (!line || !line.startsWith("data:")) return;

          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            if (!doneEventSent) {
              push("done", { reason: "stop" });
              doneEventSent = true;
            }
            return;
          }

          let json: any;
          try {
            json = JSON.parse(payload);
          } catch {
            return;
          }

          const delta = extractDelta(json);
          if (delta) {
            push("delta", { text: delta });
          }

          const reason = json?.choices?.[0]?.finish_reason;
          if (reason && !doneEventSent) {
            push("done", { reason });
            doneEventSent = true;
          }
        };

        push("start", { ok: true });

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            while (true) {
              const lineEnd = buffer.indexOf("\n");
              if (lineEnd < 0) break;
              const line = buffer.slice(0, lineEnd);
              buffer = buffer.slice(lineEnd + 1);
              parseLine(line);
            }

            if (doneEventSent) break;
          }

          const tail = decoder.decode();
          if (tail) {
            buffer += tail;
          }
          if (buffer.trim()) {
            parseLine(buffer);
            buffer = "";
          }

          if (!doneEventSent) {
            push("done", { reason: "eof" });
          }
        } catch (error) {
          push("error", { message: error instanceof Error ? error.message : "stream read failed" });
        } finally {
          try {
            reader.releaseLock();
          } catch {}
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "invalid request", { status: 500 });
  }
};

