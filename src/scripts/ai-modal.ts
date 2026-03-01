import { createAiRuntime } from "../providers/ai/index";
import type { AiRuntime } from "../providers/ai/types";

declare global {
  interface Window {
    __flyAiModalCleanup?: () => void;
  }
}

const STORAGE_KEY = "site-ai-connection";

function setupAiModal() {
  const dialog = document.getElementById("ai-modal");
  if (!(dialog instanceof HTMLDialogElement)) return () => {};

  const controller = new AbortController();
  const { signal } = controller;

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
  const tabs = Array.from(dialog.querySelectorAll<HTMLElement>(".ai-tab"));
  const contents = Array.from(dialog.querySelectorAll<HTMLElement>(".ai-tab-content"));

  let runtime: AiRuntime | null = null;
  let destroyed = false;

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

  const safeRun = async (action: () => Promise<string>, loadingText: string) => {
    if (!(output instanceof HTMLElement)) return;
    output.textContent = loadingText;
    try {
      const result = await action();
      output.textContent = result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      output.textContent = `请求失败：${message}\n\n请先检查 API Base / Model / API Key。`;
    }
  };

  const open = async () => {
    if (destroyed) return;
    if (!dialog.isConnected) return;

    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch (error) {
        console.warn("AI modal showModal failed", error);
        return;
      }
    }

    if (isEncryptedLocked()) {
      if (output instanceof HTMLElement) {
        output.textContent = "当前文章尚未解密，AI 面板暂不可用。";
      }
      return;
    }

    await ensureRuntime();
  };

  const closeDialog = () => {
    if (dialog.isConnected && dialog.open) {
      dialog.close();
    }
  };

  const switchTab = (name: string) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("active", active);
    });
    contents.forEach((content) => {
      const active = content.id === `tab-${name}`;
      content.classList.toggle("active", active);
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener(
      "click",
      () => {
        const tabName = tab.dataset.tab || "chat";
        switchTab(tabName);
      },
      { signal }
    );
  });

  window.addEventListener(
    "site:open-ai",
    () => {
      open().catch(console.error);
    },
    { signal }
  );

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('[data-action="open-ai"]');
      if (!(trigger instanceof HTMLElement)) return;
      event.preventDefault();
      open().catch(console.error);
    },
    { signal }
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== defaults.shortcut) return;
      event.preventDefault();
      open().catch(console.error);
    },
    { signal }
  );

  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog) closeDialog();
    },
    { signal }
  );

  close?.addEventListener("click", closeDialog, { signal });

  saveConn?.addEventListener(
    "click",
    async () => {
      await ensureRuntime();
      applyConnection();
      if (output instanceof HTMLElement) {
        output.textContent = "连接配置已保存。";
      }
    },
    { signal }
  );

  summarizeBtn?.addEventListener(
    "click",
    async () => {
      if (isEncryptedLocked()) return;
      const rt = await ensureRuntime();
      if (!rt) return;
      await safeRun(() => rt.summarizeCurrentArticle(), "正在生成摘要...");
    },
    { signal }
  );

  askBtn?.addEventListener(
    "click",
    async () => {
      if (isEncryptedLocked()) return;
      const rt = await ensureRuntime();
      const question = questionInput instanceof HTMLInputElement ? questionInput.value.trim() : "";
      if (!rt || !question) return;
      await safeRun(() => rt.askSite(question), "正在生成回答...");
    },
    { signal }
  );

  chatBtn?.addEventListener(
    "click",
    async () => {
      if (isEncryptedLocked()) return;
      const rt = await ensureRuntime();
      const prompt = chatInput instanceof HTMLInputElement ? chatInput.value.trim() : "";
      if (!rt || !prompt) return;
      if (chatInput instanceof HTMLInputElement) chatInput.value = "";
      await safeRun(() => rt.chat(prompt), "正在请求模型...");
    },
    { signal }
  );

  chatInput?.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        chatBtn?.dispatchEvent(new Event("click"));
      }
    },
    { signal }
  );

  switchTab("chat");
  syncConnUi();

  return () => {
    destroyed = true;
    controller.abort();
    closeDialog();
  };
}

export function bootAiModal() {
  if (window.__flyAiModalCleanup) {
    window.__flyAiModalCleanup();
  }
  window.__flyAiModalCleanup = setupAiModal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAiModal, { once: true });
} else {
  bootAiModal();
}

document.addEventListener("astro:page-load", bootAiModal);
