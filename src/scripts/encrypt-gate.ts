import { decryptMarkdown } from "../utils/encrypt";

declare global {
  interface Window {
    __flyEncryptGateInited?: boolean;
  }
}

function initEncryptGate() {
  if (window.__flyEncryptGateInited) return;
  window.__flyEncryptGateInited = true;

  const section = document.querySelector(".encrypt-gate");
  if (!(section instanceof HTMLElement)) return;

  const encryptedFile = section.dataset.encryptedFile || "";
  if (!encryptedFile) return;

  const form = document.getElementById("decrypt-form");
  const passwordInput = document.getElementById("decrypt-password");
  const message = document.getElementById("decrypt-message");
  const content = document.getElementById("decrypted-content");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!(passwordInput instanceof HTMLInputElement)) return;
    if (!(message instanceof HTMLElement)) return;
    if (!(content instanceof HTMLElement)) return;

    const password = passwordInput.value.trim();
    if (!password) return;

    try {
      message.textContent = "正在解密...";
      const res = await fetch(encryptedFile, { cache: "no-store" });
      if (!res.ok) throw new Error("无法读取密文文件");
      const payload = await res.json();
      const markdown = await decryptMarkdown(payload, password);
      const { marked } = await import("marked");
      content.innerHTML = marked.parse(markdown);
      message.textContent = "解密成功。";
      window.dispatchEvent(new CustomEvent("site:decrypted"));
    } catch {
      message.textContent = "密码错误或密文损坏，解密失败。";
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEncryptGate, { once: true });
} else {
  initEncryptGate();
}
