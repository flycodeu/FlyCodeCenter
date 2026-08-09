const parseArticleRuntimeConfig = () => {
  const runtimeConfigNode = document.getElementById("article-runtime-config");
  if (!runtimeConfigNode?.textContent) return null;
  try {
    const parsed = JSON.parse(runtimeConfigNode.textContent);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("failed to parse article runtime config", error);
    return null;
  }
};

const scheduleArticleRuntime = (task) => {
  if (typeof task !== "function") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => task(), { timeout: 1200 });
    return;
  }
  window.setTimeout(task, 120);
};

const lifecycle = (window.__flyArticleRuntimeLifecycle ??= {
  bound: false,
  cleanup: null,
  revision: 0
});

const cleanupArticleRuntime = () => {
  lifecycle.revision += 1;
  if (typeof lifecycle.cleanup === "function") {
    lifecycle.cleanup();
  }
  lifecycle.cleanup = null;
};

const bootArticleRuntime = () => {
  const revision = ++lifecycle.revision;
  scheduleArticleRuntime(async () => {
    if (revision !== lifecycle.revision) return;
    const runtimeConfig = parseArticleRuntimeConfig();
    if (!runtimeConfig) {
      cleanupArticleRuntime();
      return;
    }

    const { initArticleRuntime } = await import("../plugins/runtime/article/index.js");
    if (revision !== lifecycle.revision) return;

    if (typeof lifecycle.cleanup === "function") {
      lifecycle.cleanup();
    }
    lifecycle.cleanup = initArticleRuntime(runtimeConfig);
  });
};

if (!lifecycle.bound) {
  lifecycle.bound = true;
  document.addEventListener("astro:before-swap", cleanupArticleRuntime);
  document.addEventListener("astro:page-load", bootArticleRuntime);
}

bootArticleRuntime();
