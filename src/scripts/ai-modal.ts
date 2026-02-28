import { createAiRuntime } from "../providers/ai/index";
import type { AiRuntime } from "../providers/ai/types";

declare global {
  interface Window {
    __flyAiModalInited?: boolean;
  }
}

const STORAGE_KEY = "site-ai-connection";

function initAiModal() {
  if (window.__flyAiModalInited) return;
  window.__flyAiModalInited = true;

  const dialog = document.getElementById("ai-modal");
  if (!(dialog instanceof HTMLDialogElement)) return;

  const close = document.getElementById("ai-close");
  const summarizeBtn = document.getElementById("ai-summarize");
  const askBtn = document.getElementById("ai-ask");
  const chatBtn = document.getElementById("ai-chat-send");
  const saveConn = document.getElementById("ai-save-conn");
  const questionInput = document.getElementById("ai-question");
  const chatInput = document.getElementById("ai-chat-input");
  const output = document.getElementById("ai-output");
  const externalHost = document.getElementById("ai-external");
  const baseInput = document.getElementById("ai-base");
  const modelInput = document.getElementById("ai-model");
  const keyInput = document.getElementById("ai-key");
  const keyWrap = document.getElementById("ai-key-wrap");

  let runtime: AiRuntime | null = null;

  const isEncryptedLocked = () => document.documentElement.dataset.encryptedLocked === "1";

  const defaults = {
    base: dialog.getAttribute("data-default-base") || "",
    model: dialog.getAttribute("data-default-model") || "",
    mode: dialog.getAttribute("data-connection-mode") || "proxyOnly",
    shortcut: (dialog.getAttribute("data-shortcut") || "k").toLowerCase()
  };

  const readLocal = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { apiBaseUrl: defaults.base, model: defaults.model, apiKey: "" };
      const parsed = JSON.parse(raw);
      return {
        apiBaseUrl: parsed.apiBaseUrl || defaults.base,
        model: parsed.model || defaults.model,
        apiKey: parsed.apiKey || ""
      };
    } catch {
      return { apiBaseUrl: defaults.base, model: defaults.model, apiKey: "" };
    }
  };

  const writeLocal = (conn: { apiBaseUrl: string; model: string; apiKey: string }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conn));
  };

  const syncConnUi = () => {
    if (!(baseInput instanceof HTMLInputElement)) return;
    if (!(modelInput instanceof HTMLInputElement)) return;
    if (!(keyInput instanceof HTMLInputElement)) return;

    const conn = readLocal();
    baseInput.value = conn.apiBaseUrl;
    modelInput.value = conn.model;
    keyInput.value = conn.apiKey;

    if (defaults.mode === "proxyOnly") {
      if (keyWrap instanceof HTMLElement) keyWrap.hidden = true;
      keyInput.disabled = true;
    }
  };

  const applyConnection = () => {
    if (!runtime?.setConnection) return;
    if (!(baseInput instanceof HTMLInputElement)) return;
    if (!(modelInput instanceof HTMLInputElement)) return;
    if (!(keyInput instanceof HTMLInputElement)) return;

    const next = {
      apiBaseUrl: baseInput.value.trim() || defaults.base,
      model: modelInput.value.trim() || defaults.model,
      apiKey: defaults.mode === "hybrid" ? keyInput.value.trim() : ""
    };

    runtime.setConnection(next);
    writeLocal(next);
  };

  const ensureRuntime = async () => {
    if (!runtime) {
      runtime = await createAiRuntime();
      if (runtime?.mountExternalWidget && externalHost instanceof HTMLElement) {
        await runtime.mountExternalWidget(externalHost);
      }
      syncConnUi();
      applyConnection();
    }
    return runtime;
  };

  const open = async () => {
    if (!dialog.open) {
      dialog.showModal();
    }

    if (isEncryptedLocked()) {
      if (output instanceof HTMLElement) {
        output.textContent = "当前文章尚未解密，AI 面板暂不可用。";
      }
      return;
    }

    await ensureRuntime();
  };

  window.addEventListener("site:open-ai", () => {
    open().catch(console.error);
  });

  window.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
    if (event.key.toLowerCase() !== defaults.shortcut) return;
    event.preventDefault();
    open().catch(console.error);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  close?.addEventListener("click", () => dialog.close());

  saveConn?.addEventListener("click", async () => {
    await ensureRuntime();
    applyConnection();
    if (output instanceof HTMLElement) {
      output.textContent = "连接配置已保存。";
    }
  });

  summarizeBtn?.addEventListener("click", async () => {
    if (isEncryptedLocked()) return;
    const rt = await ensureRuntime();
    if (!rt || !(output instanceof HTMLElement)) return;
    output.textContent = "正在生成摘要...";
    output.textContent = await rt.summarizeCurrentArticle();
  });

  askBtn?.addEventListener("click", async () => {
    if (isEncryptedLocked()) return;
    const rt = await ensureRuntime();
    const question = questionInput instanceof HTMLInputElement ? questionInput.value.trim() : "";
    if (!rt || !question || !(output instanceof HTMLElement)) return;
    output.textContent = "正在生成回答...";
    output.textContent = await rt.askSite(question);
  });

  chatBtn?.addEventListener("click", async () => {
    if (isEncryptedLocked()) return;
    const rt = await ensureRuntime();
    const prompt = chatInput instanceof HTMLInputElement ? chatInput.value.trim() : "";
    if (!rt || !prompt || !(output instanceof HTMLElement)) return;
    output.textContent = "正在请求模型...";
    output.textContent = await rt.chat(prompt);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAiModal, { once: true });
} else {
  initAiModal();
}
