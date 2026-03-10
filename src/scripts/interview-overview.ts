import {
  INTERVIEW_STATE_EVENT,
  getInterviewSpaceState,
  isInterviewStateValid,
  readInterviewState
} from "./interview-state";
import { bindInterviewModule } from "./interview-client";

function initInterviewOverview() {
  document.querySelectorAll("[data-interview-overview-root]").forEach((root) => {
    if (!(root instanceof HTMLElement) || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    const passwordHash = String(root.dataset.passwordHash || "").trim();
    const storageSecret = String(root.dataset.storageSecret || "").trim();

    const sync = async () => {
      const state = await readInterviewState(storageSecret);
      const valid = isInterviewStateValid(state, passwordHash);

      root.querySelectorAll("[data-space-card]").forEach((card) => {
        if (!(card instanceof HTMLElement)) return;

        const key = String(card.dataset.spaceKey || "").trim();
        const total = Number(card.dataset.total || "0");
        const progressText = card.querySelector("[data-space-progress-text]");
        const progressBar = card.querySelector("[data-space-progress-bar]");
        const nextText = card.querySelector("[data-space-next-text]");
        const spaceState = valid ? getInterviewSpaceState(state, key) : { remembered: [], lastSlug: "" };
        const done = Array.isArray(spaceState.remembered) ? spaceState.remembered.length : 0;
        const ratio = total > 0 ? Math.round((done / total) * 100) : 0;

        if (progressText instanceof HTMLElement) {
          progressText.textContent = `${done} / ${total} 已掌握`;
        }
        if (progressBar instanceof HTMLElement) {
          progressBar.style.width = `${ratio}%`;
        }
        if (nextText instanceof HTMLElement) {
          nextText.textContent = done >= total && total > 0 ? "本组已全部完成" : `当前进度 ${ratio}%`;
        }
      });
    };

    sync().catch(console.error);
    window.addEventListener(INTERVIEW_STATE_EVENT, () => {
      sync().catch(console.error);
    });
    window.addEventListener("storage", () => {
      sync().catch(console.error);
    });
  });
}

bindInterviewModule("interview-overview", initInterviewOverview);
