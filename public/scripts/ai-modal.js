(() => {
  const CLEANUP_KEY = "__flyAiModalCleanup";
  const STORAGE = {
    sessions: "site-ai-sessions-v3",
    active: "site-ai-active-session-v3",
    conn: "site-ai-conn-v3",
    roles: "site-ai-roles-v1",
    secret: "site-ai-secret-v1"
  };

  const PRESETS = {
    openai: { label: "OpenAI", apiBaseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    claude: { label: "Claude", apiBaseUrl: "https://api.anthropic.com/v1", model: "claude-3-5-sonnet-latest" },
    gemini: { label: "Gemini", apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-1.5-pro" },
    custom: { label: "Custom", apiBaseUrl: "", model: "" }
  };

  function uid(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function escapeHtml(input) {
    return String(input)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  function normalizeBase(base) {
    const raw = String(base || "").trim();
    if (!raw) return "";
    return /\/chat\/completions\/?$/.test(raw) ? raw : `${raw.replace(/\/$/, "")}/chat/completions`;
  }

  function getPreview(content) {
    const text = String(content || "").replace(/\s+/g, " ").trim();
    if (!text) return "新会话";
    return text.slice(0, 30);
  }

  function formatTime(ts) {
    const d = new Date(ts || Date.now());
    const hh = `${d.getHours()}`.padStart(2, "0");
    const mm = `${d.getMinutes()}`.padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function toBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function isCryptoReady() {
    return Boolean(window.crypto?.subtle);
  }

  async function deriveAesKey(password, saltBytes) {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: 150000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptApiKey(secret, masterPassword) {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(masterPassword, salt);
    const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(secret));
    return {
      salt: toBase64(salt),
      iv: toBase64(iv),
      cipherText: toBase64(new Uint8Array(encrypted))
    };
  }

  async function decryptApiKey(record, masterPassword) {
    const salt = fromBase64(record.salt);
    const iv = fromBase64(record.iv);
    const cipherBytes = fromBase64(record.cipherText);
    const key = await deriveAesKey(masterPassword, salt);
    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
    return new TextDecoder().decode(decrypted);
  }

  function setupAiModal() {
    const dialog = document.getElementById("ai-modal");
    if (!(dialog instanceof HTMLDialogElement)) return () => {};

    const config = window.__siteAiUiConfig || {};
    const configModels = Array.isArray(config.models) ? config.models : [];
    const configPrompts = Array.isArray(config.promptTemplates) ? config.promptTemplates : [];
    const defaultModel = config.defaultModel || dialog.getAttribute("data-default-model") || "gpt-4o-mini";
    const connMode = dialog.getAttribute("data-connection-mode") || "hybrid";
    const shortcut = (dialog.getAttribute("data-shortcut") || "k").toLowerCase();
    const defaultBase = dialog.getAttribute("data-default-base") || PRESETS.openai.apiBaseUrl;

    const el = {
      close: document.getElementById("ai-close"),
      newSession: document.getElementById("ai-new-session"),
      sessionList: document.getElementById("ai-session-list"),
      title: document.getElementById("ai-active-title"),
      activeRole: document.getElementById("ai-active-role"),
      stream: document.getElementById("ai-chat-stream"),
      form: document.getElementById("ai-chat-form"),
      input: document.getElementById("ai-chat-input"),
      send: document.getElementById("ai-chat-send"),

      openSettings: document.getElementById("ai-open-settings"),
      closeSettings: document.getElementById("ai-close-settings"),
      settingsPanel: document.getElementById("ai-settings-panel"),
      settingsHead: document.querySelector("#ai-settings-panel .settings-head"),
      status: document.getElementById("ai-settings-status"),

      providerSelect: document.getElementById("ai-provider-select"),
      baseInput: document.getElementById("ai-base-input"),
      modelInput: document.getElementById("ai-model-input"),
      keyInput: document.getElementById("ai-key-input"),
      masterInput: document.getElementById("ai-master-pass"),
      unlockBtn: document.getElementById("ai-unlock-key"),
      clearKeyBtn: document.getElementById("ai-clear-key"),
      saveSettingsBtn: document.getElementById("ai-save-settings"),

      roleSelect: document.getElementById("ai-role-select"),
      roleNameInput: document.getElementById("ai-role-name"),
      rolePromptInput: document.getElementById("ai-role-prompt"),
      newRoleBtn: document.getElementById("ai-new-role"),
      saveRoleBtn: document.getElementById("ai-save-role"),
      deleteRoleBtn: document.getElementById("ai-delete-role")
    };

    if (!(el.sessionList instanceof HTMLElement)) return () => {};
    if (!(el.stream instanceof HTMLElement)) return () => {};
    if (!(el.input instanceof HTMLTextAreaElement)) return () => {};
    if (!(el.providerSelect instanceof HTMLSelectElement)) return () => {};
    if (!(el.baseInput instanceof HTMLInputElement)) return () => {};
    if (!(el.modelInput instanceof HTMLInputElement)) return () => {};
    if (!(el.keyInput instanceof HTMLInputElement)) return () => {};
    if (!(el.masterInput instanceof HTMLInputElement)) return () => {};
    if (!(el.roleSelect instanceof HTMLSelectElement)) return () => {};
    if (!(el.roleNameInput instanceof HTMLInputElement)) return () => {};
    if (!(el.rolePromptInput instanceof HTMLTextAreaElement)) return () => {};
    if (!(el.settingsPanel instanceof HTMLElement)) return () => {};

    const controller = new AbortController();
    const { signal } = controller;

    const defaultRolePrompt = configPrompts[0]?.content || "你是站点 AI 助手，回答准确、简洁、结构清晰。";
    const defaultRoleName = configPrompts[0]?.name || "默认助手";

    const normalizeRole = (input) => {
      const name = String(input?.name || "").trim();
      const systemPrompt = String(input?.systemPrompt || input?.content || "").trim();
      return {
        id: String(input?.id || uid("role")),
        name: name || "未命名角色",
        systemPrompt: systemPrompt || defaultRolePrompt
      };
    };

    let roles = readJson(STORAGE.roles, []);
    if (!Array.isArray(roles) || !roles.length) {
      roles = [{ id: "assistant-default", name: defaultRoleName, systemPrompt: defaultRolePrompt }];
    } else {
      roles = roles.map(normalizeRole);
    }

    const normalizeMessage = (msg) => {
      const role = msg?.role === "assistant" || msg?.role === "user" ? msg.role : "assistant";
      return {
        id: String(msg?.id || uid("msg")),
        role,
        content: String(msg?.content || ""),
        createdAt: Number(msg?.createdAt) || Date.now()
      };
    };

    const normalizeSession = (item) => {
      const safeRoleId = roles.some((r) => r.id === item?.roleId) ? item.roleId : roles[0].id;
      const safeModel = String(item?.model || defaultModel);
      const rawMessages = Array.isArray(item?.messages) ? item.messages : [];
      return {
        id: String(item?.id || uid("session")),
        title: String(item?.title || "新会话"),
        roleId: safeRoleId,
        model: safeModel,
        createdAt: Number(item?.createdAt) || Date.now(),
        updatedAt: Number(item?.updatedAt) || Date.now(),
        messages: rawMessages.map(normalizeMessage)
      };
    };

    let sessions = readJson(STORAGE.sessions, []);
    if (!Array.isArray(sessions) || !sessions.length) {
      sessions = [];
    }
    sessions = sessions.map(normalizeSession);
    if (!sessions.length) {
      sessions.push({
        id: uid("session"),
        title: "新会话",
        roleId: roles[0].id,
        model: defaultModel,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: []
      });
    }

    let activeSessionId = readJson(STORAGE.active, "") || sessions[0].id;
    if (!sessions.some((session) => session.id === activeSessionId)) {
      activeSessionId = sessions[0].id;
    }

    const initialConn = readJson(STORAGE.conn, {
      provider: "openai",
      apiBaseUrl: defaultBase,
      model: defaultModel
    });
    let conn = {
      provider: String(initialConn?.provider || "openai"),
      apiBaseUrl: String(initialConn?.apiBaseUrl || defaultBase),
      model: String(initialConn?.model || defaultModel)
    };

    let secretRecord = readJson(STORAGE.secret, null);
    if (!(secretRecord && secretRecord.salt && secretRecord.iv && secretRecord.cipherText)) {
      secretRecord = null;
    }

    let unlockedApiKey = "";
    let activeRoleDraftId = "";
    let stickToBottom = true;
    let isSending = false;
    let isSettingsOpen = false;

    const isEncryptedLocked = () => document.documentElement.dataset.encryptedLocked === "1";

    const setStatus = (message, mode = "info") => {
      if (!(el.status instanceof HTMLElement)) return;
      el.status.textContent = String(message || "");
      if (mode === "error") {
        el.status.style.color = "#ef4444";
      } else if (mode === "success") {
        el.status.style.color = "color-mix(in oklab, var(--text) 70%, #22c55e 30%)";
      } else {
        el.status.style.color = "var(--text-soft)";
      }
    };

    const persist = () => {
      writeJson(STORAGE.sessions, sessions);
      writeJson(STORAGE.active, activeSessionId);
      writeJson(STORAGE.conn, conn);
      writeJson(STORAGE.roles, roles);
      if (secretRecord) {
        writeJson(STORAGE.secret, secretRecord);
      } else {
        removeStorage(STORAGE.secret);
      }
    };

    const getSession = () => sessions.find((item) => item.id === activeSessionId) || sessions[0];

    const getRoleById = (roleId) => roles.find((role) => role.id === roleId) || roles[0];

    const scrollToBottom = (force = false) => {
      if (!force && !stickToBottom) return;
      window.requestAnimationFrame(() => {
        el.stream.scrollTop = el.stream.scrollHeight;
      });
    };

    const nearBottom = () => {
      const gap = el.stream.scrollHeight - el.stream.scrollTop - el.stream.clientHeight;
      return gap < 84;
    };

    const syncSendState = () => {
      if (el.send instanceof HTMLButtonElement) {
        el.send.disabled = isSending;
      }
    };

    const autosizeInput = () => {
      el.input.style.height = "auto";
      el.input.style.height = `${Math.min(el.input.scrollHeight, 220)}px`;
    };

    const setSettingsOpen = (open) => {
      isSettingsOpen = Boolean(open);
      el.settingsPanel.hidden = !isSettingsOpen;
      if (isSettingsOpen) {
        syncSettingsPanel();
      }
    };

    const syncSettingsPanel = () => {
      const session = getSession();
      el.providerSelect.value = conn.provider in PRESETS ? conn.provider : "custom";
      el.baseInput.value = conn.apiBaseUrl || "";
      el.modelInput.value = session?.model || conn.model || defaultModel;
      el.keyInput.value = "";
      if (secretRecord) {
        setStatus(unlockedApiKey ? "密钥已解锁（仅当前会话内存）" : "已检测到加密密钥，输入主密码后可解锁。");
      } else {
        setStatus("尚未保存 API Key，可输入并使用主密码加密保存。");
      }
    };

    const renderRoleSelect = (selectedId) => {
      const targetId = roles.some((role) => role.id === selectedId) ? selectedId : roles[0].id;
      el.roleSelect.innerHTML = roles
        .map((role) => `<option value="${escapeHtml(role.id)}">${escapeHtml(role.name)}</option>`)
        .join("");
      el.roleSelect.value = targetId;
      activeRoleDraftId = targetId;
    };

    const fillRoleEditor = (roleId) => {
      const role = getRoleById(roleId);
      activeRoleDraftId = role.id;
      el.roleSelect.value = role.id;
      el.roleNameInput.value = role.name;
      el.rolePromptInput.value = role.systemPrompt;
    };

    const renderSessions = () => {
      const sorted = sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt);
      el.sessionList.innerHTML = sorted
        .map((session) => {
          const last = session.messages[session.messages.length - 1];
          const preview = getPreview(last?.content || "");
          const cls = session.id === activeSessionId ? "session-card active" : "session-card";
          return `<li>
            <article class="${cls}" data-session-id="${escapeHtml(session.id)}" tabindex="0" role="button" aria-label="切换到会话 ${escapeHtml(session.title || "新会话")}">
              <span class="title">${escapeHtml(session.title || "新会话")}</span>
              <span class="meta">${escapeHtml(preview)} · ${escapeHtml(formatTime(session.updatedAt))}</span>
            </article>
          </li>`;
        })
        .join("");
    };

    const renderMessages = (forceBottom = false) => {
      const session = getSession();
      if (!session) return;

      const role = getRoleById(session.roleId);
      if (el.title instanceof HTMLElement) {
        el.title.textContent = session.title || "新会话";
      }
      if (el.activeRole instanceof HTMLElement) {
        el.activeRole.textContent = role.name;
      }

      if (!session.messages.length) {
        el.stream.innerHTML = `
          <article class="message-row assistant">
            <div class="avatar" aria-hidden="true">AI</div>
            <div class="bubble">
              <span class="role">Assistant</span>
              <div class="msg-content">开始一个新对话吧。</div>
            </div>
          </article>`;
        scrollToBottom(true);
        return;
      }

      el.stream.innerHTML = session.messages
        .map((msg) => {
          if (msg.role === "assistant") {
            return `<article class="message-row assistant" data-msg-id="${escapeHtml(msg.id)}">
              <div class="avatar" aria-hidden="true">AI</div>
              <div class="bubble">
                <span class="role">Assistant</span>
                <div class="msg-content">${escapeHtml(msg.content).replace(/\n/g, "<br/>")}</div>
              </div>
            </article>`;
          }
          return `<article class="message-row user" data-msg-id="${escapeHtml(msg.id)}">
            <div class="bubble">
              <span class="role">You</span>
              <div class="msg-content">${escapeHtml(msg.content).replace(/\n/g, "<br/>")}</div>
            </div>
          </article>`;
        })
        .join("");

      scrollToBottom(forceBottom);
    };

    const render = (forceBottom = false) => {
      renderSessions();
      renderMessages(forceBottom);
      syncSendState();
      persist();
    };

    const appendMessage = (session, role, content) => {
      const message = {
        id: uid("msg"),
        role,
        content: String(content || ""),
        createdAt: Date.now()
      };
      session.messages.push(message);
      session.updatedAt = Date.now();
      return message;
    };

    const buildContext = (session) => {
      const role = getRoleById(session.roleId);
      const contextMessages = session.messages
        .filter((msg) => msg.role === "assistant" || msg.role === "user")
        .slice(-18)
        .map((msg) => ({ role: msg.role, content: msg.content }));
      return [{ role: "system", content: role.systemPrompt }, ...contextMessages];
    };

    const callModel = async (session) => {
      const endpoint = normalizeBase(conn.apiBaseUrl);
      if (!endpoint) throw new Error("请先设置 API Base");

      const headers = {
        "Content-Type": "application/json",
        "X-Client-Name": "flycodecenter"
      };

      if (connMode === "hybrid" && !unlockedApiKey) {
        throw new Error("请先在设置中输入主密码并解锁密钥");
      }
      if (connMode === "hybrid" && unlockedApiKey) {
        headers.Authorization = `Bearer ${unlockedApiKey}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: session.model || conn.model || defaultModel,
          messages: buildContext(session)
        })
      });

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content?.trim() || "模型没有返回内容。";
    };

    const typewriterToMessage = async (session, msgId, fullText) => {
      const target = session.messages.find((msg) => msg.id === msgId);
      if (!target) return;

      const safe = String(fullText || "").trim() || "模型没有返回内容。";
      target.content = "";
      renderMessages(true);

      let cursor = 0;
      while (cursor < safe.length) {
        const remain = safe.length - cursor;
        const step = Math.max(1, Math.ceil(remain / 34));
        cursor = Math.min(safe.length, cursor + step);
        target.content = safe.slice(0, cursor);

        const node = el.stream.querySelector(`[data-msg-id="${msgId}"] .msg-content`);
        if (node instanceof HTMLElement) {
          node.textContent = target.content;
          scrollToBottom(false);
        } else {
          renderMessages(false);
        }
        await sleep(14);
      }

      session.updatedAt = Date.now();
      render();
    };

    const runPrompt = async (rawPrompt) => {
      if (isSending || isEncryptedLocked()) return;
      const prompt = String(rawPrompt || "").trim();
      if (!prompt) return;

      const session = getSession();
      if (!session) return;

      isSending = true;
      syncSendState();

      appendMessage(session, "user", prompt);
      if (session.title === "新会话") {
        session.title = getPreview(prompt);
      }
      const pending = appendMessage(session, "assistant", "正在思考...");
      render(true);

      try {
        const answer = await callModel(session);
        await typewriterToMessage(session, pending.id, answer);
      } catch (error) {
        pending.content = `请求失败：${error instanceof Error ? error.message : "未知错误"}`;
        session.updatedAt = Date.now();
        render(true);
      } finally {
        isSending = false;
        syncSendState();
      }
    };

    const createSession = () => {
      const next = {
        id: uid("session"),
        title: "新会话",
        roleId: getSession()?.roleId || roles[0].id,
        model: conn.model || defaultModel,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: []
      };
      sessions.push(next);
      activeSessionId = next.id;
      stickToBottom = true;
      render(true);
      window.requestAnimationFrame(() => {
        el.input.focus();
        autosizeInput();
      });
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
      stickToBottom = true;
      renderMessages(true);
      window.requestAnimationFrame(() => {
        el.input.focus();
        autosizeInput();
      });
    };

    const closeDialog = () => {
      if (dialog.isConnected && dialog.open) {
        dialog.close();
      }
      setSettingsOpen(false);
    };

    const saveConnection = async () => {
      const provider = el.providerSelect.value in PRESETS ? el.providerSelect.value : "custom";
      const base = el.baseInput.value.trim();
      const model = el.modelInput.value.trim();
      const apiKey = el.keyInput.value.trim();
      const password = el.masterInput.value;

      if (!base) {
        setStatus("API Base 不能为空。", "error");
        return;
      }
      if (!model) {
        setStatus("Model 不能为空。", "error");
        return;
      }

      conn = { provider, apiBaseUrl: base, model };
      const session = getSession();
      if (session) {
        session.model = model;
        session.updatedAt = Date.now();
      }

      if (apiKey) {
        if (!isCryptoReady()) {
          setStatus("当前环境不支持 WebCrypto，无法加密存储密钥。", "error");
          return;
        }
        if (password.length < 8) {
          setStatus("主密码至少 8 位。", "error");
          return;
        }
        try {
          secretRecord = await encryptApiKey(apiKey, password);
          unlockedApiKey = apiKey;
          el.keyInput.value = "";
          setStatus("配置已保存，密钥已加密存储。", "success");
        } catch (error) {
          setStatus(`密钥加密失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
          return;
        }
      } else if (!secretRecord) {
        setStatus("配置已保存。当前未设置 API Key。", "success");
      } else {
        setStatus("配置已保存。已保留本地加密密钥。", "success");
      }

      render();
    };

    const unlockKey = async () => {
      if (!secretRecord) {
        setStatus("本地没有已加密的 API Key。", "error");
        return;
      }
      if (!isCryptoReady()) {
        setStatus("当前环境不支持 WebCrypto，无法解锁。", "error");
        return;
      }
      const password = el.masterInput.value;
      if (!password) {
        setStatus("请输入主密码后再解锁。", "error");
        return;
      }
      try {
        unlockedApiKey = await decryptApiKey(secretRecord, password);
        setStatus("密钥解锁成功。", "success");
      } catch {
        unlockedApiKey = "";
        setStatus("主密码错误或密钥数据损坏。", "error");
      }
    };

    const clearKey = () => {
      secretRecord = null;
      unlockedApiKey = "";
      el.keyInput.value = "";
      removeStorage(STORAGE.secret);
      setStatus("已清除本地密钥。", "success");
      persist();
    };

    const saveRole = () => {
      const name = el.roleNameInput.value.trim();
      const systemPrompt = el.rolePromptInput.value.trim();

      if (!name) {
        setStatus("角色名称不能为空。", "error");
        return;
      }
      if (!systemPrompt) {
        setStatus("系统提示词不能为空。", "error");
        return;
      }

      const existing = roles.find((role) => role.id === activeRoleDraftId);
      if (existing) {
        existing.name = name;
        existing.systemPrompt = systemPrompt;
      } else {
        const next = { id: uid("role"), name, systemPrompt };
        roles.push(next);
        activeRoleDraftId = next.id;
      }

      const session = getSession();
      if (session) {
        session.roleId = activeRoleDraftId;
        session.updatedAt = Date.now();
      }

      renderRoleSelect(activeRoleDraftId);
      fillRoleEditor(activeRoleDraftId);
      render();
      setStatus("角色已保存。", "success");
    };

    const deleteRole = () => {
      const deletingId = activeRoleDraftId || el.roleSelect.value;
      if (!deletingId) return;
      if (roles.length <= 1) {
        setStatus("至少保留一个角色。", "error");
        return;
      }
      roles = roles.filter((role) => role.id !== deletingId);
      const fallbackRole = roles[0];
      sessions.forEach((session) => {
        if (session.roleId === deletingId) {
          session.roleId = fallbackRole.id;
          session.updatedAt = Date.now();
        }
      });
      activeRoleDraftId = fallbackRole.id;
      renderRoleSelect(activeRoleDraftId);
      fillRoleEditor(activeRoleDraftId);
      render();
      setStatus("角色已删除。", "success");
    };

    const resetRoleEditor = () => {
      activeRoleDraftId = "";
      el.roleNameInput.value = "";
      el.rolePromptInput.value = defaultRolePrompt;
      setStatus("请填写新角色信息后点击“保存角色”。");
    };

    renderRoleSelect(roles[0].id);
    fillRoleEditor(roles[0].id);
    render(true);
    autosizeInput();
    syncSettingsPanel();
    setSettingsOpen(false);

    el.stream.addEventListener(
      "scroll",
      () => {
        stickToBottom = nearBottom();
      },
      { signal }
    );

    window.addEventListener("site:open-ai", open, { signal });

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const trigger = target.closest('[data-action="open-ai"]');
        if (!(trigger instanceof HTMLElement)) return;
        event.preventDefault();
        open();
      },
      { signal }
    );

    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && isSettingsOpen) {
          event.preventDefault();
          setSettingsOpen(false);
          return;
        }
        if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
        if (event.key.toLowerCase() !== shortcut) return;
        event.preventDefault();
        open();
      },
      { signal }
    );

    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!isSettingsOpen) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("#ai-settings-panel")) return;
        if (target.closest("#ai-open-settings")) return;
        setSettingsOpen(false);
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

    el.close?.addEventListener("click", closeDialog, { signal });
    el.newSession?.addEventListener("click", createSession, { signal });
    el.openSettings?.addEventListener(
      "click",
      () => {
        setSettingsOpen(!isSettingsOpen);
      },
      { signal }
    );
    el.closeSettings?.addEventListener("click", () => setSettingsOpen(false), { signal });

    if (el.settingsHead instanceof HTMLElement) {
      el.settingsHead.addEventListener(
        "pointerdown",
        (event) => {
          if (window.matchMedia("(max-width: 760px)").matches) return;
          if (!isSettingsOpen) return;
          const target = event.target;
          if (target instanceof Element && target.closest("button, input, textarea, select, a")) return;
          const panel = el.settingsPanel;
          if (!(panel instanceof HTMLElement)) return;
          if (event.button !== 0) return;
          const rect = panel.getBoundingClientRect();
          const offsetX = event.clientX - rect.left;
          const offsetY = event.clientY - rect.top;

          panel.style.left = `${rect.left}px`;
          panel.style.top = `${rect.top}px`;
          panel.style.bottom = "auto";
          panel.style.right = "auto";

          const onMove = (moveEvent) => {
            const panelWidth = panel.offsetWidth;
            const panelHeight = panel.offsetHeight;
            const maxLeft = Math.max(8, window.innerWidth - panelWidth - 8);
            const maxTop = Math.max(8, window.innerHeight - panelHeight - 8);
            const nextLeft = Math.min(maxLeft, Math.max(8, moveEvent.clientX - offsetX));
            const nextTop = Math.min(maxTop, Math.max(8, moveEvent.clientY - offsetY));
            panel.style.left = `${nextLeft}px`;
            panel.style.top = `${nextTop}px`;
          };

          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        },
        { signal }
      );
    }

    el.sessionList.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const item = target.closest("[data-session-id]");
        if (!(item instanceof HTMLElement)) return;
        const nextId = item.dataset.sessionId;
        if (!nextId) return;
        activeSessionId = nextId;
        stickToBottom = true;
        render(true);
        syncSettingsPanel();
      },
      { signal }
    );

    el.sessionList.addEventListener(
      "keydown",
      (event) => {
        if (!(event.target instanceof HTMLElement)) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        const item = event.target.closest("[data-session-id]");
        if (!(item instanceof HTMLElement)) return;
        event.preventDefault();
        const nextId = item.dataset.sessionId;
        if (!nextId) return;
        activeSessionId = nextId;
        stickToBottom = true;
        render(true);
        syncSettingsPanel();
      },
      { signal }
    );

    el.providerSelect.addEventListener(
      "change",
      () => {
        const provider = el.providerSelect.value in PRESETS ? el.providerSelect.value : "custom";
        if (provider === "custom") return;
        const preset = PRESETS[provider];
        el.baseInput.value = preset.apiBaseUrl;
        if (!el.modelInput.value.trim()) {
          el.modelInput.value = preset.model;
        }
      },
      { signal }
    );

    el.unlockBtn?.addEventListener("click", () => {
      unlockKey().catch((error) => {
        setStatus(`解锁失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      });
    }, { signal });

    el.clearKeyBtn?.addEventListener("click", clearKey, { signal });

    el.saveSettingsBtn?.addEventListener("click", () => {
      saveConnection().catch((error) => {
        setStatus(`保存失败：${error instanceof Error ? error.message : "未知错误"}`, "error");
      });
    }, { signal });

    el.roleSelect.addEventListener(
      "change",
      () => {
        const selectedId = el.roleSelect.value;
        fillRoleEditor(selectedId);
        const session = getSession();
        if (session) {
          session.roleId = selectedId;
          session.updatedAt = Date.now();
          render();
        }
      },
      { signal }
    );

    el.newRoleBtn?.addEventListener("click", resetRoleEditor, { signal });
    el.saveRoleBtn?.addEventListener("click", saveRole, { signal });
    el.deleteRoleBtn?.addEventListener("click", deleteRole, { signal });

    el.form?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        const prompt = el.input.value.trim();
        if (!prompt) return;
        el.input.value = "";
        autosizeInput();
        await runPrompt(prompt);
      },
      { signal }
    );

    el.input.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          el.form?.dispatchEvent(new Event("submit"));
        }
      },
      { signal }
    );

    el.input.addEventListener("input", autosizeInput, { signal });

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
