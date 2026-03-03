import { initJarvisPage } from "./jarvis-page";

let pageConfig: Record<string, unknown> = {};
const configNode = document.getElementById("jarvis-page-config");
if (configNode?.textContent) {
  try {
    pageConfig = JSON.parse(configNode.textContent) as Record<string, unknown>;
  } catch (error) {
    console.error("invalid jarvis page config", error);
  }
}

initJarvisPage(pageConfig);
