interface SeedModel { id?: string; name?: string; apiBase?: string }
interface SeedPersona { id?: string; name?: string; greeting?: string }
interface JarvisInitConfig {
  defaultModels?: SeedModel[];
  personaPresets?: SeedPersona[];
  interactionConfig?: { eventNamespace?: string };
}

type ChatRole = "user" | "assistant";
interface ConversationMessage { role: ChatRole; content: string; createdAt: number }
interface Conversation { id: string; title: string; createdAt: number; updatedAt: number; messages: ConversationMessage[] }
interface RoleProfile { id: string; name: string; systemPrompt: string; personaPrompt: string; greeting: string }
interface ModelProfile {
  uid: string;
  name: string;
  provider: "openai-compatible" | "custom";
  model: string;
  apiBase: string;
  temperature: number;
  enabled: boolean;
  apiKeyCipher: string;
  apiKeyIv: string;
  apiKeySalt: string;
  apiKeyPlain: string;
}

const STORAGE = {
  conversations: "jarvis-conversations-v2",
  activeConversation: "jarvis-conversation-active-v2",
  models: "jarvis-models-v2",
  activeModel: "jarvis-model-active-v2",
  roles: "jarvis-roles-v2",
  activeRole: "jarvis-role-active-v2",
  orbModel: "fly-jarvis-model-preset",
  vaultMeta: "jarvis-vault-meta-v1",
  vaultReady: "jarvis-vault-ready-v1"
} as const;

const VAULT_DB_NAME = "jarvis-vault-db";
const VAULT_DB_STORE = "keys";
const VAULT_KEY_ID = "master";

const safeJson = <T>(raw: string | null, fallback: T): T => {
  try { return (JSON.parse(raw || "") as T) ?? fallback; } catch { return fallback; }
};
const safeJsonArray = <T>(raw: string | null): { value: T[]; repaired: boolean } => {
  const parsed = safeJson<unknown>(raw, []);
  if (Array.isArray(parsed)) return { value: parsed as T[], repaired: false };
  return { value: [], repaired: true };
};
const toPartial = <T>(value: unknown): Partial<T> => {
  if (value && typeof value === "object") return value as Partial<T>;
  return {};
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const escapeHtml = (value: string) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const nowLabel = (time: number) => {
  const d = new Date(Number(time) || Date.now());
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
const fromBase64 = (base64: string) => {
  const bin = atob(String(base64 || ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};
const sanitizeHtml = (html: string) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  tpl.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((n) => n.remove());
  tpl.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if (name === "href" || name === "src") {
        if (!/^(https?:|mailto:|tel:|#|\/)/i.test(attr.value.trim())) node.removeAttribute(attr.name);
      }
    });
    if (node.tagName.toLowerCase() === "a") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
  return tpl.innerHTML;
};

const openVaultDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(VAULT_DB_NAME, 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(VAULT_DB_STORE)) db.createObjectStore(VAULT_DB_STORE);
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error("vault db open failed"));
});
const getVaultKeyFromDb = async () => {
  const db = await openVaultDb();
  return new Promise<CryptoKey | null>((resolve, reject) => {
    const tx = db.transaction(VAULT_DB_STORE, "readonly");
    const req = tx.objectStore(VAULT_DB_STORE).get(VAULT_KEY_ID);
    req.onsuccess = () => resolve((req.result as CryptoKey) || null);
    req.onerror = () => reject(req.error || new Error("vault key read failed"));
  });
};
const saveVaultKeyToDb = async (key: CryptoKey) => {
  const db = await openVaultDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_DB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("vault key write failed"));
    tx.objectStore(VAULT_DB_STORE).put(key, VAULT_KEY_ID);
  });
};
const clearVaultDb = async () => {
  const db = await openVaultDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_DB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("vault clear failed"));
    tx.objectStore(VAULT_DB_STORE).delete(VAULT_KEY_ID);
  });
};
const deriveAesKey = async (password: string, salt: ArrayBuffer) => {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 180000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};
const encryptSecret = async (text: string, key: CryptoKey) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { cipher: toBase64(cipher), iv: toBase64(iv.buffer) };
};
const decryptSecret = async (cipherBase64: string, ivBase64: string, key: CryptoKey) => {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(fromBase64(ivBase64)) }, key, fromBase64(cipherBase64));
  return new TextDecoder().decode(plain);
};
const getEl = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

type Mode = "info" | "warning" | "success" | "error";

export const initJarvisPage = (config: JarvisInitConfig) => {
  const nodes = {
    sessionNew: getEl<HTMLButtonElement>("jarvis-session-new"),
    sessionList: getEl<HTMLElement>("jarvis-session-list"),
    settingsOpen: getEl<HTMLButtonElement>("jarvis-settings-open"),
    stream: getEl<HTMLElement>("jarvis-stream"),
    form: getEl<HTMLFormElement>("jarvis-form"),
    input: getEl<HTMLTextAreaElement>("jarvis-input"),
    send: getEl<HTMLButtonElement>("jarvis-send"),
    activeChip: getEl<HTMLElement>("jarvis-active-chip"),
    activeRole: getEl<HTMLSelectElement>("jarvis-active-role"),
    chatStatus: getEl<HTMLElement>("jarvis-chat-status"),
    modal: getEl<HTMLElement>("jarvis-settings-modal"),
    modalBackdrop: getEl<HTMLElement>("jarvis-settings-backdrop"),
    modalClose: getEl<HTMLButtonElement>("jarvis-settings-close"),
    modalTitle: getEl<HTMLElement>("jarvis-settings-title"),
    modalStatus: getEl<HTMLElement>("jarvis-settings-status"),
    menuButtons: Array.from(document.querySelectorAll(".settings-menu button[data-tab]")) as HTMLButtonElement[],
    panelModels: getEl<HTMLElement>("jarvis-panel-models"),
    panelRoles: getEl<HTMLElement>("jarvis-panel-roles"),
    panelSelector: getEl<HTMLElement>("jarvis-panel-selector"),
    modelDraftSelect: getEl<HTMLSelectElement>("jarvis-model-draft-select"),
    modelProvider: getEl<HTMLSelectElement>("jarvis-model-provider"),
    modelName: getEl<HTMLInputElement>("jarvis-model-name"),
    modelId: getEl<HTMLInputElement>("jarvis-model-id"),
    modelBase: getEl<HTMLInputElement>("jarvis-model-base"),
    modelKey: getEl<HTMLInputElement>("jarvis-model-key"),
    modelTemp: getEl<HTMLInputElement>("jarvis-model-temp"),
    modelNew: getEl<HTMLButtonElement>("jarvis-model-new"),
    modelSave: getEl<HTMLButtonElement>("jarvis-model-save"),
    modelDelete: getEl<HTMLButtonElement>("jarvis-model-delete"),
    vaultReset: getEl<HTMLButtonElement>("jarvis-vault-reset"),
    roleDraftSelect: getEl<HTMLSelectElement>("jarvis-role-draft-select"),
    roleName: getEl<HTMLInputElement>("jarvis-role-name"),
    roleSystem: getEl<HTMLTextAreaElement>("jarvis-role-system"),
    rolePersona: getEl<HTMLTextAreaElement>("jarvis-role-persona"),
    roleGreeting: getEl<HTMLTextAreaElement>("jarvis-role-greeting"),
    roleNew: getEl<HTMLButtonElement>("jarvis-role-new"),
    roleSave: getEl<HTMLButtonElement>("jarvis-role-save"),
    roleDelete: getEl<HTMLButtonElement>("jarvis-role-delete"),
    roleActivate: getEl<HTMLButtonElement>("jarvis-role-activate"),
    selectorList: getEl<HTMLElement>("jarvis-model-selector-list"),
    selectorActivate: getEl<HTMLButtonElement>("jarvis-model-activate"),
    confirm: getEl<HTMLElement>("jarvis-save-confirm"),
    confirmNote: getEl<HTMLElement>("jarvis-confirm-note"),
    confirmPasswordWrap: getEl<HTMLElement>("jarvis-confirm-password-wrap"),
    confirmPassword: getEl<HTMLInputElement>("jarvis-confirm-password"),
    confirmCancel: getEl<HTMLButtonElement>("jarvis-confirm-cancel"),
    confirmOk: getEl<HTMLButtonElement>("jarvis-confirm-ok"),
    toastRoot: getEl<HTMLElement>("jarvis-toast-root")
  };

  if (Object.values(nodes).some((n) => !n)) {
    console.error("jarvis ui not ready");
    return;
  }

  const el = nodes as { [K in keyof typeof nodes]-?: NonNullable<(typeof nodes)[K]> };
  const eventNs = config.interactionConfig?.eventNamespace || "jarvis";

  let markedParse: ((text: string) => string) | null = null;

  const seedModels = Array.isArray(config.defaultModels) ? config.defaultModels : [];
  const seedRoles = Array.isArray(config.personaPresets) ? config.personaPresets : [];

  const fallbackModels: ModelProfile[] = seedModels.map((item, idx) => ({
    uid: `default-${idx}`,
    name: String(item?.name || `模型 ${idx + 1}`),
    provider: "openai-compatible",
    model: String(item?.id || ""),
    apiBase: String(item?.apiBase || ""),
    temperature: 0.7,
    enabled: idx === 0,
    apiKeyCipher: "",
    apiKeyIv: "",
    apiKeySalt: "",
    apiKeyPlain: ""
  }));
  if (!fallbackModels.length) {
    fallbackModels.push({
      uid: "default-0",
      name: "GPT-4o mini",
      provider: "openai-compatible",
      model: "gpt-4o-mini",
      apiBase: "https://api.openai.com/v1",
      temperature: 0.7,
      enabled: true,
      apiKeyCipher: "",
      apiKeyIv: "",
      apiKeySalt: "",
      apiKeyPlain: ""
    });
  }

  const fallbackRoles: RoleProfile[] = seedRoles.map((item, idx) => {
    const name = String(item?.name || `角色 ${idx + 1}`);
    return {
      id: String(item?.id || `role-${idx}`),
      name,
      systemPrompt: `你是${name}，回答需要准确、结构化，默认使用 Markdown 输出。`,
      personaPrompt: "",
      greeting: String(item?.greeting || "角色已激活，准备对话。")
    };
  });
  if (!fallbackRoles.length) {
    fallbackRoles.push({
      id: "jarvis-default",
      name: "Jarvis",
      systemPrompt: "你是 Jarvis 助手。请用简洁、准确、结构化的 Markdown 回答。",
      personaPrompt: "优先给出可执行步骤和关键代码。",
      greeting: "系统已上线。请先配置模型，然后开始对话。"
    });
  }

  const normalizeModel = (item: Partial<ModelProfile>, idx: number): ModelProfile => ({
    uid: String(item.uid || `m-${Date.now().toString(36)}-${idx}`),
    name: String(item.name || `模型 ${idx + 1}`),
    provider: item.provider === "custom" ? "custom" : "openai-compatible",
    model: String(item.model || (item as any).id || ""),
    apiBase: String(item.apiBase || ""),
    temperature: clamp(Number(item.temperature ?? 0.7) || 0.7, 0, 2),
    enabled: Boolean(item.enabled || (item as any).isDefault),
    apiKeyCipher: String(item.apiKeyCipher || ""),
    apiKeyIv: String(item.apiKeyIv || ""),
    apiKeySalt: String(item.apiKeySalt || ""),
    apiKeyPlain: String((item as any).apiKey || item.apiKeyPlain || "")
  });
  const normalizeRole = (item: Partial<RoleProfile>, idx: number): RoleProfile => ({
    id: String(item.id || `r-${Date.now().toString(36)}-${idx}`),
    name: String(item.name || `角色 ${idx + 1}`),
    systemPrompt: String(item.systemPrompt || `你是角色 ${idx + 1}，请使用 Markdown 回答。`),
    personaPrompt: String(item.personaPrompt || ""),
    greeting: String(item.greeting || "角色已激活，准备对话。")
  });
  const normalizeConversation = (item: Partial<Conversation>, idx: number): Conversation => ({
    id: String(item.id || `c-${Date.now().toString(36)}-${idx}`),
    title: String(item.title || `会话 ${idx + 1}`),
    createdAt: Number(item.createdAt) || Date.now(),
    updatedAt: Number(item.updatedAt) || Date.now(),
    messages: Array.isArray(item.messages)
      ? item.messages
          .filter((m) => Boolean(m) && typeof m === "object")
          .map((m) => {
            const itemMessage = toPartial<ConversationMessage>(m);
            return {
              role: itemMessage.role === "user" ? "user" : "assistant",
              content: String(itemMessage.content || ""),
              createdAt: Number(itemMessage.createdAt) || Date.now()
            };
          })
      : []
  });
  const createConversation = (title: string, greeting: string): Conversation => ({
    id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: greeting ? [{ role: "assistant", content: greeting, createdAt: Date.now() }] : []
  });

  const loadedModels = safeJsonArray<unknown>(localStorage.getItem(STORAGE.models));
  let modelsNeedRepair = loadedModels.repaired;
  let models = loadedModels.value.map((item, idx) => normalizeModel(toPartial<ModelProfile>(item), idx));
  if (!models.length) {
    models = fallbackModels.map((item, idx) => normalizeModel(item, idx));
    if (loadedModels.value.length) modelsNeedRepair = true;
  }
  if (!models.some((m) => m.enabled)) {
    models[0].enabled = true;
    modelsNeedRepair = true;
  }

  const loadedRoles = safeJsonArray<unknown>(localStorage.getItem(STORAGE.roles));
  let rolesNeedRepair = loadedRoles.repaired;
  let roles = loadedRoles.value.map((item, idx) => normalizeRole(toPartial<RoleProfile>(item), idx));
  if (!roles.length) {
    roles = fallbackRoles.map((item, idx) => normalizeRole(item, idx));
    if (loadedRoles.value.length) rolesNeedRepair = true;
  }

  let activeModelUid = localStorage.getItem(STORAGE.activeModel) || models.find((m) => m.enabled)?.uid || models[0].uid;
  if (!models.some((m) => m.uid === activeModelUid)) {
    activeModelUid = models[0].uid;
    modelsNeedRepair = true;
  }
  models = models.map((m) => ({ ...m, enabled: m.uid === activeModelUid }));

  let activeRoleId = localStorage.getItem(STORAGE.activeRole) || roles[0].id;
  if (!roles.some((r) => r.id === activeRoleId)) {
    activeRoleId = roles[0].id;
    rolesNeedRepair = true;
  }

  const loadedConversations = safeJsonArray<unknown>(localStorage.getItem(STORAGE.conversations));
  let conversationsNeedRepair = loadedConversations.repaired;
  let conversations = loadedConversations.value.map((item, idx) => normalizeConversation(toPartial<Conversation>(item), idx));
  if (!conversations.length) {
    conversations = [createConversation("新会话 1", roles.find((r) => r.id === activeRoleId)?.greeting || "系统已上线。")];
    if (loadedConversations.value.length) conversationsNeedRepair = true;
  }
  let activeConversationId = localStorage.getItem(STORAGE.activeConversation) || conversations[0].id;
  if (!conversations.some((c) => c.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
    conversationsNeedRepair = true;
  }

  type SettingsTab = "models" | "roles" | "selector";
  const normalizeSettingsTab = (value: string): SettingsTab =>
    value === "models" || value === "roles" || value === "selector" ? value : "models";

  let draftModelUid = activeModelUid;
  let draftRoleId = activeRoleId;
  let selectorDraftUid = activeModelUid;
  let settingsTab: SettingsTab = "models";
  let sessionMenuId = "";
  let pendingNeedPassword = false;
  let sending = false;

  const vault = { key: null as CryptoKey | null, ready: localStorage.getItem(STORAGE.vaultReady) === "1" };

  const emit = (name: string, detail: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent(`${eventNs}:${name}`, { detail }));
  };
  const getActiveModel = () => models.find((m) => m.uid === activeModelUid) || models[0];
  const getDraftModel = () => models.find((m) => m.uid === draftModelUid) || models[0];
  const getActiveRole = () => roles.find((r) => r.id === activeRoleId) || roles[0];
  const getDraftRole = () => roles.find((r) => r.id === draftRoleId) || roles[0];
  const getActiveConversation = () => conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const setChatStatus = (text: string, mode: Mode = "info") => {
    el.chatStatus.textContent = text;
    el.chatStatus.dataset.mode = mode;
  };
  const setSettingsStatus = (text: string, mode: Mode = "info") => {
    el.modalStatus.textContent = text;
    el.modalStatus.dataset.mode = mode;
  };
  const showToast = (text: string, mode: Mode = "info", duration = 2200) => {
    const message = String(text || "").trim();
    if (!message) return;
    const toast = document.createElement("div");
    toast.className = `jarvis-toast is-${mode}`;
    toast.setAttribute("role", mode === "error" ? "alert" : "status");
    toast.textContent = message;
    el.toastRoot.appendChild(toast);
    while (el.toastRoot.children.length > 3) {
      el.toastRoot.firstElementChild?.remove();
    }
    window.setTimeout(() => toast.remove(), duration);
  };

  const persistModels = () => {
    const serialized = models.map(({ apiKeyPlain, ...rest }) => rest);
    localStorage.setItem(STORAGE.models, JSON.stringify(serialized));
    localStorage.setItem(STORAGE.activeModel, activeModelUid);
  };
  const persistRoles = () => {
    localStorage.setItem(STORAGE.roles, JSON.stringify(roles));
    localStorage.setItem(STORAGE.activeRole, activeRoleId);
  };
  const persistConversations = () => {
    localStorage.setItem(STORAGE.conversations, JSON.stringify(conversations));
    localStorage.setItem(STORAGE.activeConversation, activeConversationId);
  };

  if (modelsNeedRepair) persistModels();
  if (rolesNeedRepair) persistRoles();
  if (conversationsNeedRepair) persistConversations();

  const ensureVaultKey = async (passwordForSetup = ""): Promise<CryptoKey> => {
    if (vault.key) return vault.key;
    try {
      const existing = await getVaultKeyFromDb();
      if (existing) {
        vault.key = existing;
        vault.ready = true;
        localStorage.setItem(STORAGE.vaultReady, "1");
        return existing;
      }
    } catch {
      // ignore
    }
    const password = String(passwordForSetup || "").trim();
    if (!password) throw new Error("密钥保险库尚未初始化，请先输入加密密码。");
    if (password.length < 6) throw new Error("加密密码至少 6 位。");

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveAesKey(password, salt.buffer);
    await saveVaultKeyToDb(key);
    localStorage.setItem(STORAGE.vaultMeta, JSON.stringify({ version: 1, createdAt: Date.now(), salt: toBase64(salt.buffer) }));
    localStorage.setItem(STORAGE.vaultReady, "1");
    vault.key = key;
    vault.ready = true;
    return key;
  };

  const resolveApiKey = async (model: ModelProfile): Promise<string> => {
    if (model.apiKeyCipher && model.apiKeyIv) {
      const key = await ensureVaultKey();
      return decryptSecret(model.apiKeyCipher, model.apiKeyIv, key);
    }
    return model.apiKeyPlain || "";
  };

  const markdownToHtml = (text: string) => {
    const source = escapeHtml(text || "");
    if (!markedParse) return source.replaceAll("\n", "<br/>");
    return sanitizeHtml(markedParse(source));
  };

  const renderMessages = () => {
    const conversation = getActiveConversation();
    el.stream.innerHTML = conversation.messages
      .map((message) => {
        const user = message.role === "user";
        const body = user ? `<p>${escapeHtml(message.content).replaceAll("\n", "<br/>")}</p>` : markdownToHtml(message.content);
        return `<article class="chat-msg ${user ? "user" : "assistant"}">
          <div class="chat-msg-role">${user ? "YOU" : "JARVIS"}</div>
          <div class="chat-msg-content">${body}</div>
        </article>`;
      })
      .join("");
    el.stream.scrollTop = el.stream.scrollHeight;
  };

  const renderAll = () => {
    el.sessionList.innerHTML = conversations
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((item) => {
        const active = item.id === activeConversationId ? "is-active" : "";
        const menuOpen = item.id === sessionMenuId;
        return `<article class="history-item ${active}" data-session-id="${item.id}">
          <button type="button" class="history-main" data-action="open">
            <span class="history-title">${escapeHtml(item.title)}</span>
            <span class="history-time">${nowLabel(item.updatedAt)}</span>
          </button>
          <div class="history-menu-wrap">
            <button type="button" class="history-menu-toggle" data-action="toggle-menu" aria-label="更多操作" aria-expanded="${menuOpen ? "true" : "false"}">⋯</button>
            <div class="history-menu"${menuOpen ? "" : " hidden"}>
              <button type="button" data-action="rename">重命名</button>
              <button type="button" data-action="delete" class="danger">删除</button>
            </div>
          </div>
        </article>`;
      })
      .join("");

    el.activeRole.innerHTML = roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    el.activeRole.value = activeRoleId;

    el.modelDraftSelect.innerHTML = models.map((m) => `<option value="${m.uid}">${escapeHtml(m.name)}</option>`).join("");
    el.modelDraftSelect.value = draftModelUid;

    el.roleDraftSelect.innerHTML = roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    el.roleDraftSelect.value = draftRoleId;

    el.selectorList.innerHTML = models
      .map((m) => {
        const checked = m.uid === selectorDraftUid ? "checked" : "";
        const active = m.uid === activeModelUid ? "is-active" : "";
        return `<label class="selector-item ${active}">
          <input type="radio" name="jarvis-model-selector" value="${m.uid}" ${checked} />
          <div class="selector-body">
            <strong>${escapeHtml(m.name)}</strong>
            <span>${escapeHtml(m.model || "未配置模型 ID")}</span>
            <small>${escapeHtml(m.apiBase || "未配置 API Base")}</small>
          </div>
        </label>`;
      })
      .join("");

    const model = getDraftModel();
    el.modelProvider.value = model.provider;
    el.modelName.value = model.name;
    el.modelId.value = model.model;
    el.modelBase.value = model.apiBase;
    el.modelTemp.value = String(model.temperature);
    el.modelKey.value = "";
    el.modelKey.placeholder = model.apiKeyCipher ? "已加密保存，输入新值将覆盖" : "sk-...";

    const role = getDraftRole();
    el.roleName.value = role.name;
    el.roleSystem.value = role.systemPrompt;
    el.rolePersona.value = role.personaPrompt;
    el.roleGreeting.value = role.greeting;

    const activeSettingsTab = normalizeSettingsTab(settingsTab);
    settingsTab = activeSettingsTab;
    el.menuButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === activeSettingsTab));
    el.panelModels.hidden = activeSettingsTab !== "models";
    el.panelRoles.hidden = activeSettingsTab !== "roles";
    el.panelSelector.hidden = activeSettingsTab !== "selector";
    el.modalTitle.textContent = activeSettingsTab === "models" ? "模型配置" : activeSettingsTab === "roles" ? "角色配置" : "模型选择";

    const activeModel = getActiveModel();
    const activeRole = getActiveRole();
    el.activeChip.textContent = `${activeRole.name} · ${activeModel.name} (${activeModel.model || "未配置"})`;

    renderMessages();
    persistModels();
    persistRoles();
    persistConversations();
  };

  const focusActiveTabButton = () => {
    const target = el.menuButtons.find((button) => button.dataset.tab === settingsTab) || el.menuButtons[0];
    target?.focus();
  };

  const toggleSettings = (show: boolean) => {
    el.modal.hidden = !show;
    document.body.classList.toggle("has-overlay", show);
    if (show) {
      requestAnimationFrame(focusActiveTabButton);
      return;
    }
    requestAnimationFrame(() => el.settingsOpen.focus());
  };
  const toggleConfirm = (show: boolean, needPassword = false) => {
    pendingNeedPassword = needPassword;
    el.confirm.hidden = !show;
    el.confirmPasswordWrap.hidden = !needPassword;
    if (!show) el.confirmPassword.value = "";
  };

  const emitModelChange = () => {
    const model = getActiveModel();
    localStorage.setItem(STORAGE.orbModel, model.model || "");
    emit("model-change", { modelId: model.model || "", modelName: model.name, source: "jarvis-page" });
  };
  const emitRoleChange = () => {
    const role = getActiveRole();
    emit("persona-change", { personaId: role.id, personaName: role.name, avatarType: "orb", defaultText: "已待命", activeText: "连接中" });
  };
  const parseSseEventBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim() || "message";
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return null;
    const raw = dataLines.join("\n");
    try {
      return { event, data: JSON.parse(raw) as any };
    } catch {
      return { event, data: { text: raw } as any };
    }
  };

  const streamMessage = async (payload: Record<string, unknown>, conversation: Conversation, assistantIndex: number) => {
    const response = await fetch("/api/jarvis/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok || !response.body) throw new Error(`流式请求失败：${response.status}`);

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";
    let hasDelta = false;
    let doneReceived = false;
    let streamError: Error | null = null;

    const applyDelta = (text: string) => {
      if (!text) return;
      hasDelta = true;
      conversation.messages[assistantIndex].content += text;
      conversation.updatedAt = Date.now();
      renderMessages();
    };

    const consume = (flush = false) => {
      while (true) {
        const marker = buffer.indexOf("\n\n");
        if (marker < 0) break;
        const block = buffer.slice(0, marker).trim();
        buffer = buffer.slice(marker + 2);
        if (!block) continue;
        const packet = parseSseEventBlock(block);
        if (!packet) continue;
        if (packet.event === "delta") applyDelta(String(packet.data?.text || ""));
        if (packet.event === "error") streamError = new Error(String(packet.data?.message || "流式响应异常"));
        if (packet.event === "done") doneReceived = true;
        if (doneReceived || streamError) return;
      }
      if (flush && buffer.trim()) {
        const packet = parseSseEventBlock(buffer.trim());
        buffer = "";
        if (packet?.event === "delta") applyDelta(String(packet.data?.text || ""));
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
        consume(false);
        if (doneReceived || streamError) break;
      }
      buffer += decoder.decode().replaceAll("\r\n", "\n");
      consume(true);
    } finally {
      reader.releaseLock();
    }

    return { done: doneReceived, hasDelta, error: streamError };
  };

  const fallbackNonStream = async (payload: Record<string, unknown>, conversation: Conversation, assistantIndex: number) => {
    const response = await fetch("/api/jarvis/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `请求失败：${response.status}`);
    }
    const data = (await response.json()) as { content?: string };
    conversation.messages[assistantIndex].content = String(data.content || "模型未返回内容。");
    conversation.updatedAt = Date.now();
    renderMessages();
  };

  const sendMessage = async (prompt: string) => {
    if (sending) return;
    const model = getActiveModel();
    const role = getActiveRole();
    const conversation = getActiveConversation();
    if (!model.apiBase || !model.model) return setChatStatus("请先在设置中配置模型 API Base 与模型 ID。", "error");

    sending = true;
    el.send.disabled = true;
    emit("state-change", { state: "active", source: "jarvis-page" });

    if (/^新会话/.test(conversation.title)) {
      const title = prompt.replace(/\s+/g, " ").trim().slice(0, 20);
      if (title) conversation.title = title;
    }

    conversation.messages.push({ role: "user", content: prompt, createdAt: Date.now() });
    conversation.messages.push({ role: "assistant", content: "", createdAt: Date.now() });
    const assistantIndex = conversation.messages.length - 1;
    conversation.updatedAt = Date.now();
    renderAll();

    try {
      const apiKey = await resolveApiKey(model);
      const system = [role.systemPrompt, role.personaPrompt].filter(Boolean).join("\n\n");
      const messages = conversation.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      if (system) messages.unshift({ role: "system", content: system } as any);
      const payload = { apiBase: model.apiBase, apiKey, model: model.model, temperature: model.temperature, messages };

      setChatStatus("流式连接中...", "info");
      const result = await streamMessage(payload, conversation, assistantIndex);
      if (result.error) {
        if (!result.hasDelta) {
          await fallbackNonStream(payload, conversation, assistantIndex);
          setChatStatus("流式不可用，已自动回退普通模式。", "warning");
        } else {
          setChatStatus("流式中断，已返回部分内容。", "warning");
        }
      } else if (!result.hasDelta) {
        await fallbackNonStream(payload, conversation, assistantIndex);
        setChatStatus("流式无增量，已自动回退普通模式。", "warning");
      } else {
        setChatStatus("流式响应完成。", "success");
      }
    } catch (error) {
      conversation.messages[assistantIndex].content = `请求失败：${error instanceof Error ? error.message : "未知错误"}`;
      setChatStatus("对话请求失败，请检查模型配置与密钥。", "error");
    } finally {
      conversation.updatedAt = Date.now();
      persistConversations();
      renderAll();
      sending = false;
      el.send.disabled = false;
      emit("state-change", { state: "idle", source: "jarvis-page" });
    }
  };
  el.sessionNew.addEventListener("click", () => {
    conversations.unshift(createConversation(`新会话 ${conversations.length + 1}`, getActiveRole().greeting));
    activeConversationId = conversations[0].id;
    sessionMenuId = "";
    renderAll();
    showToast("已新建会话。", "success");
  });

  el.sessionList.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const row = target.closest(".history-item") as HTMLElement | null;
    if (!row) return;
    const sessionId = row.dataset.sessionId || "";
    const action = (target.closest("button[data-action]") as HTMLButtonElement | null)?.dataset.action || "";

    if (action === "open") { activeConversationId = sessionId; sessionMenuId = ""; renderAll(); return; }
    if (action === "toggle-menu") { sessionMenuId = sessionMenuId === sessionId ? "" : sessionId; renderAll(); return; }
    if (action === "rename") {
      const item = conversations.find((c) => c.id === sessionId);
      if (!item) return;
      const next = window.prompt("输入新的会话名称", item.title);
      if (!next) return;
      item.title = next.trim().slice(0, 48) || item.title;
      item.updatedAt = Date.now();
      sessionMenuId = "";
      renderAll();
      showToast("会话已重命名。", "success");
      return;
    }
    if (action === "delete") {
      if (conversations.length <= 1) {
        const message = "至少保留一条会话。";
        setSettingsStatus(message, "error");
        showToast(message, "warning");
        return;
      }
      const item = conversations.find((c) => c.id === sessionId);
      if (!item || !window.confirm(`确认删除会话「${item.title}」？`)) return;
      conversations = conversations.filter((c) => c.id !== sessionId);
      if (!conversations.some((c) => c.id === activeConversationId)) activeConversationId = conversations[0].id;
      sessionMenuId = "";
      renderAll();
      showToast("会话已删除。", "success");
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest(".history-menu-wrap") && sessionMenuId) {
      sessionMenuId = "";
      renderAll();
    }
  });

  el.settingsOpen.addEventListener("click", () => toggleSettings(true));
  el.modalClose.addEventListener("click", () => toggleSettings(false));
  el.modalBackdrop.addEventListener("click", () => toggleSettings(false));
  el.menuButtons.forEach((button) =>
    button.addEventListener("click", () => {
      settingsTab = normalizeSettingsTab(button.dataset.tab || "");
      renderAll();
    })
  );

  el.modelDraftSelect.addEventListener("change", () => { draftModelUid = el.modelDraftSelect.value; renderAll(); });
  el.modelNew.addEventListener("click", () => {
    const uid = `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    models.push({ uid, name: "新模型", provider: "openai-compatible", model: "", apiBase: "", temperature: 0.7, enabled: false, apiKeyCipher: "", apiKeyIv: "", apiKeySalt: "", apiKeyPlain: "" });
    draftModelUid = uid;
    selectorDraftUid = uid;
    renderAll();
  });

  el.modelSave.addEventListener("click", () => {
    const name = el.modelName.value.trim();
    const modelId = el.modelId.value.trim();
    const apiBase = el.modelBase.value.trim();
    if (!name || !modelId || !apiBase) {
      const message = "显示名称、模型 ID、API Base 均不能为空。";
      setSettingsStatus(message, "error");
      showToast(message, "error", 3000);
      return;
    }
    const hasKey = el.modelKey.value.trim().length > 0;
    const needPassword = hasKey && !vault.ready;
    el.confirmNote.textContent = needPassword
      ? "首次保存密钥需要设置加密密码。模型将写入本地并对密钥加密。"
      : "将把模型信息写入浏览器本地存储，确认继续？";
    toggleConfirm(true, needPassword);
  });

  el.confirmCancel.addEventListener("click", () => toggleConfirm(false));
  el.confirmOk.addEventListener("click", async () => {
    const model = getDraftModel();
    try {
      model.name = el.modelName.value.trim();
      model.model = el.modelId.value.trim();
      model.apiBase = el.modelBase.value.trim();
      model.provider = el.modelProvider.value === "custom" ? "custom" : "openai-compatible";
      model.temperature = clamp(Number(el.modelTemp.value || "0.7"), 0, 2);
      const nextKey = el.modelKey.value.trim();
      if (nextKey) {
        const key = await ensureVaultKey(pendingNeedPassword ? el.confirmPassword.value.trim() : "");
        const encrypted = await encryptSecret(nextKey, key);
        model.apiKeyCipher = encrypted.cipher;
        model.apiKeyIv = encrypted.iv;
        model.apiKeyPlain = "";
        el.modelKey.value = "";
      }
      toggleConfirm(false);
      renderAll();
      setSettingsStatus("模型已保存。", "success");
      showToast("模型已保存。", "success");
    } catch (error) {
      const message = `保存失败：${error instanceof Error ? error.message : "未知错误"}`;
      setSettingsStatus(message, "error");
      showToast(message, "error", 3200);
    }
  });

  el.modelDelete.addEventListener("click", () => {
    if (models.length <= 1) {
      const message = "至少保留一个模型。";
      setSettingsStatus(message, "error");
      showToast(message, "warning");
      return;
    }
    const model = getDraftModel();
    if (!window.confirm(`确认删除模型「${model.name}」？`)) return;
    models = models.filter((item) => item.uid !== model.uid);
    if (!models.some((item) => item.uid === activeModelUid)) activeModelUid = models[0].uid;
    if (!models.some((item) => item.uid === draftModelUid)) draftModelUid = models[0].uid;
    if (!models.some((item) => item.uid === selectorDraftUid)) selectorDraftUid = models[0].uid;
    models = models.map((item) => ({ ...item, enabled: item.uid === activeModelUid }));
    renderAll();
    setSettingsStatus("模型已删除。", "success");
    showToast("模型已删除。", "success");
  });

  el.vaultReset.addEventListener("click", async () => {
    if (!window.confirm("确认重置密钥保险库？重置后需重新填写并保存所有模型密钥。")) return;
    try {
      await clearVaultDb();
      localStorage.removeItem(STORAGE.vaultMeta);
      localStorage.removeItem(STORAGE.vaultReady);
      vault.key = null;
      vault.ready = false;
      models = models.map((item) => ({ ...item, apiKeyCipher: "", apiKeyIv: "", apiKeySalt: "", apiKeyPlain: "" }));
      renderAll();
      setSettingsStatus("保险库已重置，模型密钥已清空。", "success");
      showToast("保险库已重置，模型密钥已清空。", "success");
    } catch (error) {
      const message = `重置失败：${error instanceof Error ? error.message : "未知错误"}`;
      setSettingsStatus(message, "error");
      showToast(message, "error", 3200);
    }
  });

  el.roleDraftSelect.addEventListener("change", () => { draftRoleId = el.roleDraftSelect.value; renderAll(); });
  el.roleNew.addEventListener("click", () => {
    const id = `role-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    roles.push({ id, name: "新角色", systemPrompt: "你是一名专业 AI 助手，请提供准确且结构化的 Markdown 回答。", personaPrompt: "", greeting: "角色已激活，准备对话。" });
    draftRoleId = id;
    renderAll();
  });
  el.roleSave.addEventListener("click", () => {
    const role = getDraftRole();
    const name = el.roleName.value.trim();
    const system = el.roleSystem.value.trim();
    if (!name || !system) {
      const message = "角色名和系统提示词不能为空。";
      setSettingsStatus(message, "error");
      showToast(message, "error", 3000);
      return;
    }
    role.name = name;
    role.systemPrompt = system;
    role.personaPrompt = el.rolePersona.value.trim();
    role.greeting = el.roleGreeting.value.trim() || "角色已激活，准备对话。";
    renderAll();
    setSettingsStatus("角色已保存。", "success");
    showToast("角色已保存。", "success");
  });
  el.roleDelete.addEventListener("click", () => {
    if (roles.length <= 1) {
      const message = "至少保留一个角色。";
      setSettingsStatus(message, "error");
      showToast(message, "warning");
      return;
    }
    const role = getDraftRole();
    if (!window.confirm(`确认删除角色「${role.name}」？`)) return;
    roles = roles.filter((item) => item.id !== role.id);
    if (!roles.some((item) => item.id === activeRoleId)) activeRoleId = roles[0].id;
    if (!roles.some((item) => item.id === draftRoleId)) draftRoleId = roles[0].id;
    renderAll();
    emitRoleChange();
    setSettingsStatus("角色已删除。", "success");
    showToast("角色已删除。", "success");
  });
  el.roleActivate.addEventListener("click", () => {
    activeRoleId = draftRoleId;
    const conversation = getActiveConversation();
    conversation.messages.push({ role: "assistant", content: `已切换角色：${getActiveRole().name}`, createdAt: Date.now() });
    conversation.updatedAt = Date.now();
    renderAll();
    emitRoleChange();
    setSettingsStatus("角色已切换。", "success");
    showToast("角色已切换。", "success");
  });

  el.activeRole.addEventListener("change", () => {
    activeRoleId = el.activeRole.value;
    draftRoleId = activeRoleId;
    renderAll();
    emitRoleChange();
  });

  el.selectorList.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | null;
    if (target?.name === "jarvis-model-selector") selectorDraftUid = target.value;
  });
  el.selectorActivate.addEventListener("click", () => {
    activeModelUid = selectorDraftUid;
    draftModelUid = activeModelUid;
    models = models.map((item) => ({ ...item, enabled: item.uid === activeModelUid }));
    renderAll();
    emitModelChange();
    setSettingsStatus("模型已启用。", "success");
    showToast("模型已启用。", "success");
  });

  el.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const prompt = el.input.value.trim();
    if (!prompt) return;
    el.input.value = "";
    await sendMessage(prompt);
  });
  el.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      el.form.dispatchEvent(new Event("submit"));
    }
  });

  window.addEventListener(`${eventNs}:action`, (event) => {
    const custom = event as CustomEvent<{ actionId?: string }>;
    if ((custom.detail?.actionId || "").trim() === "open-settings") toggleSettings(true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!el.confirm.hidden) return toggleConfirm(false);
    if (!el.modal.hidden) toggleSettings(false);
  });
  void import("marked")
    .then((mod) => {
      mod.marked.setOptions({ gfm: true, breaks: true });
      markedParse = (text: string) => {
        const rendered = mod.marked.parse(text);
        return typeof rendered === "string" ? rendered : "";
      };
      renderMessages();
    })
    .catch(() => {});

  renderAll();
  emitModelChange();
  emitRoleChange();
  setSettingsStatus("可配置多个模型，但同一时刻仅启用一个。", "info");
  setChatStatus("AI 回复在左侧、用户消息在右侧，支持流式 Markdown。", "info");
};
