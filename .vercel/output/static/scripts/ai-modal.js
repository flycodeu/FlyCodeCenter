(() => {
  const CLEANUP_KEY = "__flyAiModalCleanup";
  const STORAGE = {
    sessions: "site-ai-sessions-v2",
    active: "site-ai-active-session-v2",
    conn: "site-ai-connection-v2"
  };

  function escapeHtml(input) {
    return String(input)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function uid(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeBase(base) {
    const raw = String(base || "").trim();
    if (!raw) return "";
    return /\/chat\/completions\/?$/.test(raw) ? raw : `${raw.replace(/\/$/, "")}/chat/completions`;
  }

  function getPreview(content) {
    const text = String(content || "").replace(/\s+/g, " ").trim();
    if (!text) return "空会话";
    return text.slice(0, 34);
  }

  function formatTime(ts) {
    const d = new Date(ts || Date.now());
    const hh = `${d.getHours()}`.padStart(2, "0");
    const mm = `${d.getMinutes()}`.padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function createDefaultSession(models, prompts, defaultModel) {
    const firstPrompt = prompts[0] || {
      id: "assistant-default",
      name: "通用助手",
      content: "你是站点 AI 助手，回答准确简洁。"
    };

    return {
      id: uid("session"),
      title: "新会话",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: defaultModel || models[0]?.id || "gpt-4o-mini",
      promptTemplateId: firstPrompt.id,
      systemPrompt: firstPrompt.content,
      messages: [
        {
          id: uid("msg"),
          role: "system",
          content: firstPrompt.content,
          createdAt: Date.now()
        }
      ]
    };
  }

  function setupAiModal() {
    const dialog = document.getElementById("ai-modal");
    if (!(dialog instanceof HTMLDialogElement)) return () => {};

    const config = window.__siteAiUiConfig || {};
    const models = Array.isArray(config.models) && config.models.length
      ? config.models
      : [{ id: dialog.getAttribute("data-default-model") || "gpt-4o-mini", label: "Default", apiBaseUrl: dialog.getAttribute("data-default-base") || "" }];
    const prompts = Array.isArray(config.promptTemplates) && config.promptTemplates.length
      ? config.promptTemplates
      : [{ id: "assistant-default", name: "通用助手", content: "你是站点 AI 助手，回答准确简洁。" }];
    const defaultModel = config.defaultModel || dialog.getAttribute("data-default-model") || models[0]?.id;

    const connMode = dialog.getAttribute("data-connection-mode") || "hybrid";
    const shortcut = (dialog.getAttribute("data-shortcut") || "k").toLowerCase();

    const el = {
      shell: document.getElementById("ai-shell"),
      close: document.getElementById("ai-close"),
      newSession: document.getElementById("ai-new-session"),
      sessionList: document.getElementById("ai-session-list"),
      title: document.getElementById("ai-active-title"),
      stream: document.getElementById("ai-chat-stream"),
      form: document.getElementById("ai-chat-form"),
      input: document.getElementById("ai-chat-input"),
      summarize: document.getElementById("ai-summarize"),

      toggleSettings: document.getElementById("ai-toggle-settings"),
      settingsPanel: document.getElementById("ai-settings-panel"),
      settingsClose: document.getElementById("ai-settings-close"),

      modelSelect: document.getElementById("ai-model-select"),
      promptSelect: document.getElementById("ai-prompt-select"),
      systemPrompt: document.getElementById("ai-system-prompt"),
      base: document.getElementById("ai-base"),
      key: document.getElementById("ai-key"),
      saveConn: document.getElementById("ai-save-conn")
    };

    if (!(el.sessionList instanceof HTMLElement) || !(el.stream instanceof HTMLElement)) return () => {};

    const controller = new AbortController();
    const { signal } = controller;

    let sessions = readJson(STORAGE.sessions, []);
    if (!Array.isArray(sessions) || !sessions.length) {
      sessions = [createDefaultSession(models, prompts, defaultModel)];
    }

    let activeSessionId = readJson(STORAGE.active, "") || sessions[0].id;
    if (!sessions.some((session) => session.id === activeSessionId)) {
      activeSessionId = sessions[0].id;
    }

    const defaults = {
      apiBaseUrl: dialog.getAttribute("data-default-base") || "",
      apiKey: ""
    };

    let conn = readJson(STORAGE.conn, defaults);
    if (!conn || typeof conn !== "object") {
      conn = { ...defaults };
    }

    const isEncryptedLocked = () => document.documentElement.dataset.encryptedLocked === "1";

    const setSettingsOpen = (open) => {
      if (!(el.settingsPanel instanceof HTMLElement)) return;
      el.settingsPanel.hidden = !open;
      el.settingsPanel.classList.toggle("is-open", open);
      if (el.shell instanceof HTMLElement) {
        el.shell.classList.toggle("settings-open", open);
      }
    };

    const persist = () => {
      writeJson(STORAGE.sessions, sessions);
      writeJson(STORAGE.active, activeSessionId);
    };

    const getSession = () => sessions.find((item) => item.id === activeSessionId) || sessions[0];

    const syncConnUi = () => {
      if (el.base instanceof HTMLInputElement) {
        el.base.value = conn.apiBaseUrl || defaults.apiBaseUrl;
      }
      if (el.key instanceof HTMLInputElement) {
        el.key.value = conn.apiKey || "";
        el.key.disabled = connMode === "proxyOnly";
      }
    };

    const renderModelOptions = () => {
      if (!(el.modelSelect instanceof HTMLSelectElement)) return;
      el.modelSelect.innerHTML = models
        .map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label || model.id)}</option>`)
        .join("");
    };

    const renderPromptOptions = () => {
      if (!(el.promptSelect instanceof HTMLSelectElement)) return;
      el.promptSelect.innerHTML = prompts
        .map((prompt) => `<option value="${escapeHtml(prompt.id)}">${escapeHtml(prompt.name || prompt.id)}</option>`)
        .join("");
    };

    const renderSessions = () => {
      el.sessionList.innerHTML = sessions
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((session) => {
          const lastMessage = [...session.messages].reverse().find((msg) => msg.role === "assistant" || msg.role === "user");
          const preview = getPreview(lastMessage?.content || "");
          const cls = session.id === activeSessionId ? "session-item active" : "session-item";
          return `<li>
            <div class="session-row">
              <button type="button" class="${cls}" data-session-id="${escapeHtml(session.id)}">
                <span class="title">${escapeHtml(session.title || "新会话")}</span>
                <span class="meta">${escapeHtml(preview)} · ${escapeHtml(formatTime(session.updatedAt))}</span>
              </button>
              <button type="button" class="session-delete" data-action="delete-session" data-session-id="${escapeHtml(session.id)}" aria-label="删除会话">✕</button>
            </div>
          </li>`;
        })
        .join("");
    };

    const renderMessages = () => {
      const session = getSession();
      if (!session) return;

      if (el.title instanceof HTMLElement) {
        el.title.textContent = session.title || "新会话";
      }

      if (el.modelSelect instanceof HTMLSelectElement) {
        el.modelSelect.value = session.modelId || defaultModel;
      }

      if (el.promptSelect instanceof HTMLSelectElement) {
        el.promptSelect.value = session.promptTemplateId || prompts[0]?.id || "";
      }

      if (el.systemPrompt instanceof HTMLTextAreaElement) {
        el.systemPrompt.value = session.systemPrompt || "";
      }

      const visible = session.messages.filter((msg) => msg.role === "user" || msg.role === "assistant");
      el.stream.innerHTML = visible
        .map((msg) => {
          const roleLabel = msg.role === "user" ? "You" : "Assistant";
          const edited = msg.editedAt ? `<span class="edited">已编辑</span>` : "";
          const regen = msg.role === "user" ? `<button type="button" class="msg-btn" data-action="regen" data-msg-id="${escapeHtml(msg.id)}">重答</button>` : "";
          return `<article class="chat-message ${escapeHtml(msg.role)}">
            <header class="msg-head">
              <span class="role">${roleLabel}</span>
              <div class="msg-actions">
                ${edited}
                ${regen}
                <button type="button" class="msg-btn" data-action="edit" data-msg-id="${escapeHtml(msg.id)}">编辑</button>
                <button type="button" class="msg-btn danger" data-action="delete" data-msg-id="${escapeHtml(msg.id)}">删除</button>
              </div>
            </header>
            <div class="msg-content">${escapeHtml(msg.content).replace(/\n/g, "<br/>")}</div>
          </article>`;
        })
        .join("");

      if (!el.stream.innerHTML.trim()) {
        el.stream.innerHTML = "<article class='chat-message assistant'><span class='role'>Assistant</span><div>开始一个新对话吧。</div></article>";
      }

      el.stream.scrollTop = el.stream.scrollHeight;
    };

    const render = () => {
      renderSessions();
      renderMessages();
      persist();
    };

    const appendMessage = (session, role, content) => {
      const message = {
        id: uid("msg"),
        role,
        content,
        createdAt: Date.now()
      };
      session.messages.push(message);
      session.updatedAt = Date.now();
      return message;
    };

    const findMessage = (session, messageId) =>
      session.messages.find((msg) => msg.id === messageId);

    const removeMessage = (session, messageId) => {
      session.messages = session.messages.filter((msg) => msg.id !== messageId);
      if (!session.messages.some((msg) => msg.role === "system")) {
        session.messages.unshift({
          id: uid("msg"),
          role: "system",
          content: session.systemPrompt || "你是站点 AI 助手，回答准确简洁。",
          createdAt: Date.now()
        });
      }
      session.updatedAt = Date.now();
    };

    const typewriterToLastAssistant = async (session, fullText) => {
      let target = session.messages[session.messages.length - 1];
      if (!target || target.role !== "assistant") {
        target = appendMessage(session, "assistant", "");
      }
      target.content = "";
      renderMessages();

      const safe = String(fullText || "").trim() || "模型没有返回内容。";
      let cursor = 0;
      while (cursor < safe.length) {
        const remain = safe.length - cursor;
        const step = Math.max(1, Math.ceil(remain / 36));
        cursor = Math.min(safe.length, cursor + step);
        target.content = safe.slice(0, cursor);
        renderMessages();
        // Slightly slower typing gives a more conversational rhythm.
        await sleep(14);
      }
      session.updatedAt = Date.now();
      render();
    };

    const regenerateFromUserMessage = async (session, messageId) => {
      const hitIndex = session.messages.findIndex((msg) => msg.id === messageId);
      if (hitIndex < 0) return;
      session.messages = session.messages.slice(0, hitIndex + 1);
      appendMessage(session, "assistant", "正在思考...");
      render();

      try {
        const answer = await callModel(session);
        await typewriterToLastAssistant(session, answer);
      } catch (error) {
        const message = `请求失败：${error instanceof Error ? error.message : "未知错误"}`;
        const last = session.messages[session.messages.length - 1];
        if (last && last.role === "assistant") {
          last.content = message;
        } else {
          appendMessage(session, "assistant", message);
        }
        render();
      }
    };

    const applySystemPrompt = (session, value) => {
      const prompt = String(value || "").trim();
      session.systemPrompt = prompt;
      const systemIndex = session.messages.findIndex((msg) => msg.role === "system");
      if (systemIndex >= 0) {
        session.messages[systemIndex].content = prompt;
      } else {
        session.messages.unshift({ id: uid("msg"), role: "system", content: prompt, createdAt: Date.now() });
      }
      session.updatedAt = Date.now();
    };

    const resolveModel = (modelId) => {
      const target = models.find((model) => model.id === modelId);
      return target || models[0];
    };

    const callModel = async (session) => {
      const model = resolveModel(session.modelId);
      const connBase = (el.base instanceof HTMLInputElement ? el.base.value.trim() : "") || conn.apiBaseUrl || model.apiBaseUrl || defaults.apiBaseUrl;
      const endpoint = normalizeBase(connBase);
      if (!endpoint) throw new Error("请先配置接口地址");

      const headers = {
        "Content-Type": "application/json",
        "X-Client-Name": "flycodecenter"
      };

      if (connMode === "hybrid") {
        const key = (el.key instanceof HTMLInputElement ? el.key.value.trim() : "") || conn.apiKey;
        if (key) headers.Authorization = `Bearer ${key}`;
      }

      const usable = session.messages.filter((msg) => msg.role === "system" || msg.role === "assistant" || msg.role === "user");
      const contextWindow = usable.slice(-18).map((msg) => ({ role: msg.role, content: msg.content }));

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model.id,
          messages: contextWindow
        })
      });

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content?.trim() || "模型没有返回内容。";
    };

    const runPrompt = async (promptText) => {
      if (isEncryptedLocked()) return;
      const session = getSession();
      const prompt = String(promptText || "").trim();
      if (!session || !prompt) return;

      appendMessage(session, "user", prompt);
      if (session.title === "新会话") {
        session.title = getPreview(prompt);
      }
      render();

      appendMessage(session, "assistant", "正在思考...");
      render();

      try {
        const answer = await callModel(session);
        await typewriterToLastAssistant(session, answer);
      } catch (error) {
        const message = `请求失败：${error instanceof Error ? error.message : "未知错误"}`;
        const last = session.messages[session.messages.length - 1];
        if (last && last.role === "assistant" && last.content === "正在思考...") {
          last.content = message;
        } else {
          appendMessage(session, "assistant", message);
        }
      }
    };

    const sendMessage = async () => {
      if (!(el.input instanceof HTMLTextAreaElement)) return;
      const prompt = el.input.value.trim();
      if (!prompt) return;
      el.input.value = "";
      await runPrompt(prompt);
    };

    const summarizeArticle = async () => {
      if (isEncryptedLocked()) return;
      const article = document.querySelector(".article-body");
      const text = article?.textContent?.slice(0, 12000) || "";
      if (!text.trim()) {
        const session = getSession();
        appendMessage(session, "assistant", "当前页面没有可总结的文章内容。");
        render();
        return;
      }
      await runPrompt(`请总结当前文章内容，并给出要点。\n\n${text}`);
    };

    const createSession = () => {
      const next = createDefaultSession(models, prompts, defaultModel);
      sessions.push(next);
      activeSessionId = next.id;
      render();
      if (el.input instanceof HTMLTextAreaElement) {
        window.requestAnimationFrame(() => el.input.focus());
      }
    };

    const open = () => {
      if (!dialog.isConnected) return;
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch (error) {
          console.warn("AI modal showModal failed", error);
          return;
        }
      }
      setSettingsOpen(false);
      if (el.input instanceof HTMLTextAreaElement) {
        window.requestAnimationFrame(() => el.input.focus());
      }
    };

    const closeDialog = () => {
      if (dialog.isConnected && dialog.open) dialog.close();
      setSettingsOpen(false);
    };

    renderModelOptions();
    renderPromptOptions();
    syncConnUi();
    render();
    setSettingsOpen(false);

    window.addEventListener("site:open-ai", open, { signal });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('[data-action="open-ai"]');
      if (!(trigger instanceof HTMLElement)) return;
      event.preventDefault();
      open();
    }, { signal });

    window.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== shortcut) return;
      event.preventDefault();
      open();
    }, { signal });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    }, { signal });

    el.close?.addEventListener("click", closeDialog, { signal });
    el.newSession?.addEventListener("click", createSession, { signal });

    el.toggleSettings?.addEventListener("click", () => {
      const panel = el.settingsPanel;
      if (!(panel instanceof HTMLElement)) return;
      setSettingsOpen(panel.hidden);
    }, { signal });

    el.settingsClose?.addEventListener("click", () => setSettingsOpen(false), { signal });

    el.sessionList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const deleteBtn = target.closest("[data-action='delete-session']");
      if (deleteBtn instanceof HTMLElement) {
        const sessionId = deleteBtn.dataset.sessionId;
        if (!sessionId) return;
        sessions = sessions.filter((item) => item.id !== sessionId);
        if (!sessions.length) {
          const next = createDefaultSession(models, prompts, defaultModel);
          sessions = [next];
          activeSessionId = next.id;
        } else if (!sessions.some((item) => item.id === activeSessionId)) {
          activeSessionId = sessions[0].id;
        }
        render();
        return;
      }
      const btn = target.closest("[data-session-id]");
      if (!(btn instanceof HTMLElement)) return;
      activeSessionId = btn.dataset.sessionId || activeSessionId;
      render();
    }, { signal });

    el.stream.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionBtn = target.closest("[data-action]");
      if (!(actionBtn instanceof HTMLElement)) return;

      const action = actionBtn.dataset.action;
      const msgId = actionBtn.dataset.msgId;
      if (!action || !msgId) return;
      const session = getSession();
      if (!session) return;

      if (action === "delete") {
        removeMessage(session, msgId);
        render();
        return;
      }

      if (action === "edit") {
        const hit = findMessage(session, msgId);
        if (!hit) return;
        const next = window.prompt("编辑消息", hit.content || "");
        if (next === null) return;
        const value = String(next).trim();
        if (!value) return;
        hit.content = value;
        hit.editedAt = Date.now();
        session.updatedAt = Date.now();
        render();
        return;
      }

      if (action === "regen") {
        regenerateFromUserMessage(session, msgId).catch(console.error);
      }
    }, { signal });

    if (el.modelSelect instanceof HTMLSelectElement) {
      el.modelSelect.addEventListener("change", () => {
        const session = getSession();
        session.modelId = el.modelSelect.value;
        session.updatedAt = Date.now();
        render();
      }, { signal });
    }

    if (el.promptSelect instanceof HTMLSelectElement && el.systemPrompt instanceof HTMLTextAreaElement) {
      el.promptSelect.addEventListener("change", () => {
        const session = getSession();
        session.promptTemplateId = el.promptSelect.value;
        const selected = prompts.find((prompt) => prompt.id === el.promptSelect.value);
        if (selected) {
          applySystemPrompt(session, selected.content);
        }
        render();
      }, { signal });

      el.systemPrompt.addEventListener("input", () => {
        const session = getSession();
        applySystemPrompt(session, el.systemPrompt.value);
        persist();
      }, { signal });
    }

    el.form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await sendMessage();
    }, { signal });

    if (el.input instanceof HTMLTextAreaElement) {
      el.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          el.form?.dispatchEvent(new Event("submit"));
        }
      }, { signal });
    }

    el.summarize?.addEventListener("click", () => {
      summarizeArticle().catch(console.error);
    }, { signal });

    el.saveConn?.addEventListener("click", () => {
      const nextBase = el.base instanceof HTMLInputElement ? el.base.value.trim() : conn.apiBaseUrl;
      const nextKey = el.key instanceof HTMLInputElement ? el.key.value.trim() : conn.apiKey;
      conn = {
        apiBaseUrl: nextBase || defaults.apiBaseUrl,
        apiKey: nextKey || ""
      };
      writeJson(STORAGE.conn, conn);
      const session = getSession();
      appendMessage(session, "assistant", "连接配置已保存。后续会话将使用新配置。");
      render();
    }, { signal });

    return () => {
      controller.abort();
      closeDialog();
    };
  }

  function bootAiModal() {
    if (typeof window[CLEANUP_KEY] === "function") {
      window[CLEANUP_KEY]();
    }
    window[CLEANUP_KEY] = setupAiModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAiModal, { once: true });
  } else {
    bootAiModal();
  }

  document.addEventListener("astro:page-load", bootAiModal);
})();
