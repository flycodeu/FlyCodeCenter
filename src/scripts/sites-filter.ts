declare global {
  interface Window {
    __flySitesFilterInited?: boolean;
  }
}

function initSitesFilter() {
  if (window.__flySitesFilterInited) return;
  window.__flySitesFilterInited = true;

  const root = document.getElementById("site-filter-root");
  if (!(root instanceof HTMLElement)) return;

  const defaultTag = root.dataset.default || "all";
  const buttons = [...root.querySelectorAll("[data-site-filter]")];
  const cards = [...document.querySelectorAll("[data-site-card]")];

  const applyFilter = (tag: string) => {
    for (const button of buttons) {
      if (!(button instanceof HTMLElement)) continue;
      button.classList.toggle("active", button.dataset.siteFilter === tag);
    }

    for (const card of cards) {
      if (!(card instanceof HTMLElement)) continue;
      if (tag === "all") {
        card.hidden = false;
        continue;
      }

      const tags = (card.dataset.tags || "")
        .split("||")
        .map((item) => item.trim())
        .filter(Boolean);

      card.hidden = !tags.includes(tag);
    }
  };

  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) continue;
    button.addEventListener("click", () => {
      applyFilter(button.dataset.siteFilter || "all");
    });
  }

  applyFilter(defaultTag);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSitesFilter, { once: true });
} else {
  initSitesFilter();
}
