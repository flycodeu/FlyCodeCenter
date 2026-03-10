const parseArticleRuntimeConfig = () => {
  const runtimeConfigNode = document.getElementById("article-runtime-config");
  if (!runtimeConfigNode?.textContent) return {};
  try {
    const parsed = JSON.parse(runtimeConfigNode.textContent);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("failed to parse article runtime config", error);
    return {};
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

scheduleArticleRuntime(async () => {
  const runtimeConfig = parseArticleRuntimeConfig();
  const { initArticleRuntime } = await import("../plugins/runtime/article/index.js");
  initArticleRuntime(runtimeConfig);
});
