import {
  INTERVIEW_STATE_EVENT,
  dispatchInterviewStateChange,
  isInterviewStateValid,
  readInterviewSessionState,
  readInterviewState,
  writeInterviewSessionState,
  unlockInterviewCenter
} from "./interview-state";
import { bindInterviewModule, matchesPasswordToken } from "./interview-client";

function initInterviewAccessGate() {
  document.querySelectorAll("[data-interview-access-gate]").forEach((root) => {
    if (!(root instanceof HTMLElement) || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    const passwordToken = String(root.dataset.passwordToken || "").trim();
    const passwordHash = String(root.dataset.passwordHash || "").trim();
    const storageSecret = String(root.dataset.storageSecret || "").trim();
    const checkingText = String(root.dataset.checkingText || "正在验证...").trim();
    const errorText = String(root.dataset.errorText || "密码错误，暂时无法进入面试中心。").trim();
    const storageErrorText = String(root.dataset.storageErrorText || "保存解锁状态失败，请重试。").trim();
    const verifyErrorText = String(root.dataset.verifyErrorText || "当前环境无法完成密码校验，请刷新后重试。").trim();
    const rootClass = "interview-locked";

    const form = root.querySelector("[data-interview-access-form]");
    const input = root.querySelector("[data-access-password]");
    const message = root.querySelector("[data-access-message]");
    const submitButton = form?.querySelector('button[type="submit"]');
    const setGateVisible = (visible: boolean) => {
      root.hidden = !visible;
      root.style.display = visible ? "" : "none";
      document.documentElement.classList.toggle(rootClass, visible);
    };

    const sync = async () => {
      const sessionState = readInterviewSessionState();
      if (isInterviewStateValid(sessionState, passwordHash)) {
        setGateVisible(false);
        return;
      }

      const state = await readInterviewState(storageSecret);
      const unlocked = isInterviewStateValid(state, passwordHash);
      setGateVisible(!unlocked);
    };

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!(input instanceof HTMLInputElement) || !(message instanceof HTMLElement)) return;
      if (submitButton instanceof HTMLButtonElement) {
        if (submitButton.disabled) return;
        submitButton.disabled = true;
      }

      const password = input.value.trim();
      if (!password) {
        if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
        return;
      }

      try {
        root.dataset.loading = "1";
        message.textContent = checkingText;
        const matches = passwordToken ? matchesPasswordToken(password, passwordToken) : false;
        if (!matches) {
          message.textContent = errorText;
          return;
        }

        message.textContent = "";
        writeInterviewSessionState({
          ...readInterviewSessionState(),
          unlocked: true,
          password,
          passwordHash
        });
        setGateVisible(false);
        root.dataset.loading = "0";
        dispatchInterviewStateChange("unlock");
        void unlockInterviewCenter(storageSecret, {
          password,
          passwordHash
        }).catch((error) => {
          console.error("Failed to persist interview center gate state.", error);
        });
      } catch (error) {
        console.error("Failed to unlock interview center gate.", error);
        message.textContent = verifyErrorText || storageErrorText;
      } finally {
        if (!root.hidden) {
          root.dataset.loading = "0";
          if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
        }
      }
    });

    window.addEventListener(INTERVIEW_STATE_EVENT, () => {
      sync().catch(console.error);
    });
    window.addEventListener("storage", () => {
      sync().catch(console.error);
    });

    sync().catch(console.error);
  });
}

bindInterviewModule("interview-access-gate", initInterviewAccessGate);
