declare global {
  interface Window {
    __flyInterviewModuleState?: Record<string, boolean>;
  }
}

export function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    return Promise.reject(new Error("Web Crypto API is unavailable in the current environment."));
  }

  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(String(value || "")))
    .then((digest) =>
      [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("")
    );
}

export function toBase64Utf8(value: string): string {
  const encoded = new TextEncoder().encode(String(value || ""));
  let binary = "";

  for (const item of encoded) {
    binary += String.fromCharCode(item);
  }

  return btoa(binary);
}

export function matchesPasswordToken(password: string, token: string): boolean {
  return toBase64Utf8(password) === String(token || "").trim();
}

export function bindInterviewModule(name: string, init: () => void): void {
  const state = (window.__flyInterviewModuleState ??= {});

  if (!state[name]) {
    state[name] = true;
    document.addEventListener("astro:page-load", init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }

  init();
}
