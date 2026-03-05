import { initJarvisPage } from "./jarvis-page";

let disposeJarvisPage: (() => void) | null = null;
let activeJarvisShell: Element | null = null;

const teardownJarvisPage = () => {
  disposeJarvisPage?.();
  disposeJarvisPage = null;
  activeJarvisShell = null;
};

const bootJarvisPage = () => {
  const configNode = document.getElementById("jarvis-page-config");
  const shell = document.querySelector(".jarvis-shell");

  if (!configNode?.textContent || !shell) {
    teardownJarvisPage();
    return;
  }

  if (shell === activeJarvisShell && disposeJarvisPage) return;

  let pageConfig: Record<string, unknown> = {};
  try {
    pageConfig = JSON.parse(configNode.textContent) as Record<string, unknown>;
  } catch (error) {
    console.error("invalid jarvis page config", error);
  }

  teardownJarvisPage();
  disposeJarvisPage = initJarvisPage(pageConfig);
  activeJarvisShell = shell;
};

document.addEventListener("astro:before-swap", teardownJarvisPage);
document.addEventListener("astro:page-load", bootJarvisPage);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootJarvisPage, { once: true });
} else {
  bootJarvisPage();
}
