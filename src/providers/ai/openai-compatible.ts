import siteConfig from "../../site.config";
import { createSearchEngine } from "../search/index";
import type { AiConnection, AiRuntime } from "./types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export function createOpenAiCompatibleRuntime(): AiRuntime {
  const connection: AiConnection = {
    apiBaseUrl: siteConfig.ai.openaiCompatible.apiBaseUrl,
    model: siteConfig.ai.openaiCompatible.model,
    apiKey: "",
    headers: {}
  };

  const getMergedHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...siteConfig.ai.openaiCompatible.headers,
      ...(connection.headers ?? {})
    };

    if (siteConfig.ai.connectionMode === "hybrid" && connection.apiKey) {
      headers.Authorization = `Bearer ${connection.apiKey}`;
    }

    return headers;
  };

  const callOpenAiCompatible = async (messages: ChatMessage[]): Promise<string> => {
    const apiBaseUrl = connection.apiBaseUrl || siteConfig.ai.openaiCompatible.apiBaseUrl;
    if (!apiBaseUrl) {
      throw new Error("AI apiBaseUrl 未配置，无法调用 openaiCompatible provider。");
    }
    const target = /\/chat\/completions\/?$/.test(apiBaseUrl)
      ? apiBaseUrl
      : `${apiBaseUrl.replace(/\/$/, "")}/chat/completions`;

    const response = await fetch(target, {
      method: "POST",
      headers: getMergedHeaders(),
      body: JSON.stringify({
        model: connection.model || siteConfig.ai.openaiCompatible.model,
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = (await response.json()) as ChatResponse;
    return data.choices?.[0]?.message?.content?.trim() ?? "No response from model.";
  };

  return {
    async summarizeCurrentArticle() {
      const article = document.querySelector("article");
      const text = article?.textContent?.slice(0, 12000) ?? "";
      if (!text.trim()) {
        return "当前页面没有可总结的正文内容。";
      }
      return callOpenAiCompatible([
        { role: "system", content: "你是一个技术文章总结助手，请用简洁中文输出要点。" },
        { role: "user", content: `请总结以下文章：\n${text}` }
      ]);
    },
    async askSite(question: string) {
      const search = await createSearchEngine();
      const docs = await search.search(question);
      const context = docs
        .slice(0, siteConfig.search.topK)
        .map((item, idx) => `#${idx + 1} ${item.title}\n${item.snippet}\nURL: ${item.url}`)
        .join("\n\n");
      return callOpenAiCompatible([
        {
          role: "system",
          content:
            "你是站内问答助手。仅使用提供的上下文回答，并在结尾列出参考链接；若上下文不足请明确说明。"
        },
        {
          role: "user",
          content: `问题：${question}\n\n上下文：\n${context}`
        }
      ]);
    },
    async chat(prompt: string) {
      return callOpenAiCompatible([
        {
          role: "system",
          content: "你是站点 AI 助手，回答要准确、简洁。"
        },
        {
          role: "user",
          content: prompt
        }
      ]);
    },
    setConnection(next) {
      if (next.apiBaseUrl !== undefined) connection.apiBaseUrl = next.apiBaseUrl;
      if (next.model !== undefined) connection.model = next.model;
      if (siteConfig.ai.connectionMode === "hybrid" && next.apiKey !== undefined) {
        connection.apiKey = next.apiKey;
      }
      if (next.headers !== undefined) connection.headers = next.headers;
    },
    getConnection() {
      return { ...connection };
    }
  };
}

