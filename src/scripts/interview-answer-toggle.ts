import { bindInterviewModule } from "./interview-client";

function initInterviewAnswerToggle() {
  document.querySelectorAll("[data-interview-answer-shell]").forEach((root) => {
    if (!(root instanceof HTMLElement) || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    const toggle = root.querySelector("[data-answer-toggle]");
    const panel = root.querySelector("[data-answer-panel]");
    const label = root.querySelector("[data-answer-toggle-label]");

    if (!(toggle instanceof HTMLButtonElement) || !(panel instanceof HTMLElement) || !(label instanceof HTMLElement)) {
      return;
    }

    const expandLabel = String(toggle.dataset.expandLabel || "展开讲解").trim();
    const collapseLabel = String(toggle.dataset.collapseLabel || "收起讲解").trim();

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      const nextExpanded = !expanded;
      toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
      label.textContent = nextExpanded ? collapseLabel : expandLabel;
      panel.hidden = !nextExpanded;

      if (nextExpanded) {
        window.dispatchEvent(new CustomEvent("site:decrypted"));
      }
    });
  });
}

bindInterviewModule("interview-answer-toggle", initInterviewAnswerToggle);
