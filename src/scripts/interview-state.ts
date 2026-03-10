export const INTERVIEW_STATE_KEY = "fly-interview-center-state-v1";
export const INTERVIEW_SESSION_KEY = "fly-interview-center-session-v1";
export const INTERVIEW_STATE_EVENT = "interview:center-state";
const INTERVIEW_STATE_VERSION = 2;
const LEGACY_SCHEME = "pbkdf2";
const DIRECT_SCHEME = "direct-aes-gcm";
const WINDOW_MIRROR_KEY = "__flyInterviewState";
const MEMORY_MIRROR_KEY = "__flyInterviewSessionState";

declare global {
  interface Window {
    [MEMORY_MIRROR_KEY]?: string;
  }
}

export interface InterviewSpaceState {
  remembered: string[];
  lastSlug: string;
}

export interface InterviewCenterState {
  version: number;
  unlocked: boolean;
  password: string;
  passwordHash: string;
  spaces: Record<string, InterviewSpaceState>;
  updatedAt: string;
}

function createDefaultSpaceState(): InterviewSpaceState {
  return {
    remembered: [],
    lastSlug: ""
  };
}

export function createDefaultInterviewState(): InterviewCenterState {
  return {
    version: INTERVIEW_STATE_VERSION,
    unlocked: false,
    password: "",
    passwordHash: "",
    spaces: {},
    updatedAt: new Date(0).toISOString()
  };
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveLegacyStorageKey(secret: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 120000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function isHexSecret(secret: string): boolean {
  return /^[a-f0-9]+$/i.test(secret) && secret.length % 2 === 0;
}

function fromHex(hex: string): Uint8Array {
  const normalized = String(hex || "").trim();
  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

async function secretToKeyBytes(secret: string): Promise<Uint8Array> {
  const normalized = String(secret || "").trim();
  if (isHexSecret(normalized)) {
    const bytes = fromHex(normalized);
    if (bytes.byteLength === 32) return bytes;
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return new Uint8Array(digest);
}

async function importStorageKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", await secretToKeyBytes(secret), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt"
  ]);
}

function getStorageCandidates(): Storage[] {
  const storages: Storage[] = [];

  try {
    if (typeof localStorage !== "undefined") storages.push(localStorage);
  } catch {}

  try {
    if (typeof sessionStorage !== "undefined") storages.push(sessionStorage);
  } catch {}

  return storages;
}

function readRawState(): string {
  for (const storage of getStorageCandidates()) {
    try {
      const raw = storage.getItem(INTERVIEW_STATE_KEY);
      if (raw) return raw;
    } catch {}
  }

  return "";
}

function readSessionMirror(): string {
  try {
    if (typeof sessionStorage === "undefined") return "";
    return sessionStorage.getItem(INTERVIEW_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function readMemoryMirror(): string {
  try {
    if (typeof window === "undefined") return "";
    return String(window[MEMORY_MIRROR_KEY] || "");
  } catch {
    return "";
  }
}

function readWindowMirror(): string {
  try {
    if (typeof window === "undefined") return "";
    const raw = String(window.name || "").trim();
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return "";
    const mirror = parsed[WINDOW_MIRROR_KEY];
    if (!mirror || typeof mirror !== "object") return "";
    if (mirror.key !== INTERVIEW_SESSION_KEY) return "";
    return String(mirror.value || "");
  } catch {
    return "";
  }
}

export function readInterviewSessionState(): InterviewCenterState {
  try {
    const memoryRaw = readMemoryMirror();
    if (memoryRaw) return normalizeState(JSON.parse(memoryRaw));

    const raw = readSessionMirror();
    if (raw) return normalizeState(JSON.parse(raw));

    const windowRaw = readWindowMirror();
    if (windowRaw) return normalizeState(JSON.parse(windowRaw));

    return createDefaultInterviewState();
  } catch {
    return createDefaultInterviewState();
  }
}

function writeRawState(raw: string): void {
  let lastError: unknown = null;

  for (const storage of getStorageCandidates()) {
    try {
      storage.setItem(INTERVIEW_STATE_KEY, raw);

      for (const staleStorage of getStorageCandidates()) {
        if (staleStorage === storage) continue;
        try {
          staleStorage.removeItem(INTERVIEW_STATE_KEY);
        } catch {}
      }

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to persist interview center state.");
}

function writeSessionMirror(raw: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(INTERVIEW_SESSION_KEY, raw);
  } catch {}
}

function writeMemoryMirror(raw: string): void {
  try {
    if (typeof window === "undefined") return;
    window[MEMORY_MIRROR_KEY] = raw;
  } catch {}
}

function writeWindowMirror(raw: string): void {
  try {
    if (typeof window === "undefined") return;
    const next: Record<string, unknown> = {};
    const current = String(window.name || "").trim();

    if (current) {
      try {
        const parsed = JSON.parse(current);
        if (parsed && typeof parsed === "object") {
          Object.assign(next, parsed);
        }
      } catch {}
    }

    next[WINDOW_MIRROR_KEY] = {
      key: INTERVIEW_SESSION_KEY,
      value: raw
    };

    window.name = JSON.stringify(next);
  } catch {}
}

export function writeInterviewSessionState(state: InterviewCenterState): InterviewCenterState {
  const normalized = normalizeState({
    ...state,
    updatedAt: new Date().toISOString()
  });
  const raw = JSON.stringify(normalized);
  writeMemoryMirror(raw);
  writeSessionMirror(raw);
  writeWindowMirror(raw);
  return normalized;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeState(input: unknown): InterviewCenterState {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<InterviewCenterState>;
  const spaces: Record<string, InterviewSpaceState> = {};

  for (const [spaceKey, value] of Object.entries(raw.spaces ?? {})) {
    const normalizedKey = String(spaceKey || "").trim();
    if (!normalizedKey) continue;
    const space = (value && typeof value === "object" ? value : {}) as Partial<InterviewSpaceState>;
    spaces[normalizedKey] = {
      remembered: normalizeStringList(space.remembered),
      lastSlug: String(space.lastSlug || "").trim()
    };
  }

  return {
    version: INTERVIEW_STATE_VERSION,
    unlocked: Boolean(raw.unlocked),
    password: String(raw.password || "").trim(),
    passwordHash: String(raw.passwordHash || "").trim(),
    spaces,
    updatedAt: String(raw.updatedAt || new Date().toISOString())
  };
}

async function encodeState(state: InterviewCenterState, secret: string): Promise<string> {
  const normalized = normalizeState(state);
  const payload = new TextEncoder().encode(JSON.stringify(normalized));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importStorageKey(secret);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return JSON.stringify({
    version: INTERVIEW_STATE_VERSION,
    scheme: DIRECT_SCHEME,
    iv: toBase64(iv.buffer),
    cipher: toBase64(cipher)
  });
}

async function decodeState(raw: string, secret: string): Promise<InterviewCenterState> {
  try {
    const parsed = JSON.parse(String(raw || ""));
    const iv = fromBase64(String(parsed.iv || ""));
    const cipher = fromBase64(String(parsed.cipher || ""));
    const usesLegacyScheme = String(parsed.scheme || "").trim() === LEGACY_SCHEME || Boolean(parsed.salt);
    const key = usesLegacyScheme
      ? await deriveLegacyStorageKey(secret, fromBase64(String(parsed.salt || "")))
      : await importStorageKey(secret);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return normalizeState(JSON.parse(new TextDecoder().decode(plain)));
  } catch {
    return createDefaultInterviewState();
  }
}

export async function readInterviewState(secret: string): Promise<InterviewCenterState> {
  try {
    const raw = readRawState();
    if (raw) {
      const decoded = await decodeState(raw, secret);
      if (decoded.unlocked || decoded.password || decoded.passwordHash) {
        writeInterviewSessionState(decoded);
        return decoded;
      }
    }

    const sessionState = readInterviewSessionState();
    if (sessionState.unlocked || sessionState.password || sessionState.passwordHash) return sessionState;

    return createDefaultInterviewState();
  } catch {
    return createDefaultInterviewState();
  }
}

export async function writeInterviewState(secret: string, state: InterviewCenterState): Promise<InterviewCenterState> {
  const normalized = normalizeState({
    ...state,
    updatedAt: new Date().toISOString()
  });

  let encryptedWriteError: unknown = null;

  try {
    writeRawState(await encodeState(normalized, secret));
  } catch (error) {
    encryptedWriteError = error;
  }

  writeInterviewSessionState(normalized);

  if (encryptedWriteError && !readSessionMirror() && !readWindowMirror()) {
    throw encryptedWriteError instanceof Error
      ? encryptedWriteError
      : new Error("Unable to persist interview center state.");
  }

  return normalized;
}

export async function updateInterviewState(
  secret: string,
  updater: (state: InterviewCenterState) => InterviewCenterState | Promise<InterviewCenterState>
): Promise<InterviewCenterState> {
  const current = await readInterviewState(secret);
  const next = await updater(current);
  return writeInterviewState(secret, next);
}

export function isInterviewStateValid(state: InterviewCenterState, passwordHash: string): boolean {
  return Boolean(state.unlocked && state.password && state.passwordHash && state.passwordHash === passwordHash);
}

export function getInterviewSpaceState(state: InterviewCenterState, spaceKey: string): InterviewSpaceState {
  return state.spaces[String(spaceKey || "").trim()] ?? createDefaultSpaceState();
}

export function dispatchInterviewStateChange(reason = "update") {
  window.dispatchEvent(new CustomEvent(INTERVIEW_STATE_EVENT, { detail: { reason } }));
}

export async function unlockInterviewCenter(
  secret: string,
  options: {
    password: string;
    passwordHash: string;
  }
): Promise<InterviewCenterState> {
  return updateInterviewState(secret, (current) => ({
    ...current,
    unlocked: true,
    password: String(options.password || "").trim(),
    passwordHash: String(options.passwordHash || "").trim()
  }));
}

export async function setInterviewLastSlug(
  secret: string,
  options: {
    spaceKey: string;
    slug: string;
  }
): Promise<InterviewCenterState> {
  return updateInterviewState(secret, (current) => {
    const spaceKey = String(options.spaceKey || "").trim();
    const slug = String(options.slug || "").trim();
    if (!spaceKey || !slug) return current;
    const currentSpace = getInterviewSpaceState(current, spaceKey);
    return {
      ...current,
      spaces: {
        ...current.spaces,
        [spaceKey]: {
          ...currentSpace,
          lastSlug: slug
        }
      }
    };
  });
}

export async function toggleInterviewRemembered(
  secret: string,
  options: {
    spaceKey: string;
    slug: string;
  }
): Promise<InterviewCenterState> {
  return updateInterviewState(secret, (current) => {
    const spaceKey = String(options.spaceKey || "").trim();
    const slug = String(options.slug || "").trim();
    if (!spaceKey || !slug) return current;

    const currentSpace = getInterviewSpaceState(current, spaceKey);
    const remembered = new Set(currentSpace.remembered);
    if (remembered.has(slug)) {
      remembered.delete(slug);
    } else {
      remembered.add(slug);
    }

    return {
      ...current,
      spaces: {
        ...current.spaces,
        [spaceKey]: {
          remembered: [...remembered],
          lastSlug: currentSpace.lastSlug
        }
      }
    };
  });
}
