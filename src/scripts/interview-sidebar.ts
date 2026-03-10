import {
  INTERVIEW_STATE_EVENT,
  dispatchInterviewStateChange,
  getInterviewSpaceState,
  isInterviewStateValid,
  readInterviewState,
  setInterviewLastSlug,
  toggleInterviewRemembered
} from "./interview-state";
import { bindInterviewModule } from "./interview-client";

function initInterviewSidebar() {
  document.querySelectorAll("[data-interview-sidebar-root]").forEach((root) => {
    if (!(root instanceof HTMLElement) || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    const spaceKey = String(root.dataset.spaceKey || "").trim();
    const currentSlug = String(root.dataset.currentSlug || "").trim();
    const passwordHash = String(root.dataset.passwordHash || "").trim();
    const storageSecret = String(root.dataset.storageSecret || "").trim();
    const progressText = root.querySelector("[data-progress-text]");
    const progressBar = root.querySelector("[data-progress-bar]");
    const nextText = root.querySelector("[data-next-text]");

    const sync = async () => {
      const state = await readInterviewState(storageSecret);
      const remembered = isInterviewStateValid(state, passwordHash)
        ? new Set(getInterviewSpaceState(state, spaceKey).remembered)
        : new Set<string>();
      const items = [...root.querySelectorAll("[data-interview-item]")];

      items.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const slug = String(node.dataset.slug || "").trim();
        const rememberedNow = remembered.has(slug);
        const toggle = node.querySelector("[data-remember-toggle]");
        node.classList.toggle("is-remembered", rememberedNow);
        if (toggle instanceof HTMLButtonElement) {
          toggle.textContent = rememberedNow ? "已掌握" : "标记已掌握";
          toggle.setAttribute("aria-pressed", rememberedNow ? "true" : "false");
        }
      });

      const total = items.length;
      const done = items.filter(
        (node) => node instanceof HTMLElement && remembered.has(String(node.dataset.slug || "").trim())
      ).length;
      const ratio = total > 0 ? Math.round((done / total) * 100) : 0;

      if (progressText instanceof HTMLElement) {
        progressText.textContent = `${done} / ${total} 已掌握`;
      }
      if (progressBar instanceof HTMLElement) {
        progressBar.style.width = `${ratio}%`;
      }
      if (nextText instanceof HTMLElement) {
        const nextNode = items.find(
          (node) => node instanceof HTMLElement && !remembered.has(String(node.dataset.slug || "").trim())
        );
        const nextLabel =
          nextNode instanceof HTMLElement
            ? `下一题：${nextNode.querySelector(".title")?.textContent?.trim() || "继续复盘"}`
            : "本组已全部完成";
        nextText.textContent = nextLabel;
      }
    };

    root.querySelectorAll("[data-remember-toggle]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const item =
          event.currentTarget instanceof HTMLElement ? event.currentTarget.closest("[data-interview-item]") : null;
        if (!(item instanceof HTMLElement)) return;

        const slug = String(item.dataset.slug || "").trim();
        if (!spaceKey || !slug) return;

        await toggleInterviewRemembered(storageSecret, { spaceKey, slug });
        dispatchInterviewStateChange("remember");
        await sync();
      });
    });

    if (spaceKey && currentSlug) {
      setInterviewLastSlug(storageSecret, { spaceKey, slug: currentSlug }).catch(console.error);
    }

    window.addEventListener(INTERVIEW_STATE_EVENT, () => {
      sync().catch(console.error);
    });
    window.addEventListener("storage", () => {
      sync().catch(console.error);
    });

    sync().catch(console.error);
  });
}

bindInterviewModule("interview-sidebar", initInterviewSidebar);
