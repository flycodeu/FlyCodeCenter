import siteConfig from "../../site.config";
import type { AiRuntime } from "./types";

export function createExternalWidgetRuntime(): AiRuntime {
  return {
    async summarizeCurrentArticle() {
      return "External widget mode does not provide built-in summarize.";
    },
    async askSite() {
      return "External widget mode does not provide built-in site QA.";
    },
    async chat() {
      return "External widget mode does not provide built-in chat API.";
    },
    async mountExternalWidget(host: HTMLElement) {
      const { scriptSrc, iframeSrc } = siteConfig.ai.externalWidget;
      if (scriptSrc) {
        const script = document.createElement("script");
        script.src = scriptSrc;
        script.async = true;
        host.appendChild(script);
      }
      if (iframeSrc) {
        const iframe = document.createElement("iframe");
        iframe.src = iframeSrc;
        iframe.style.width = "100%";
        iframe.style.height = "420px";
        iframe.style.border = "1px solid var(--line)";
        iframe.style.borderRadius = "12px";
        host.appendChild(iframe);
      }
    }
  };
}

