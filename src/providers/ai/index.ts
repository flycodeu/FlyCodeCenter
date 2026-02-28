import siteConfig from "../../site.config";
import type { AiRuntime } from "./types";

export async function createAiRuntime(): Promise<AiRuntime | null> {
  switch (siteConfig.ai.provider) {
    case "openaiCompatible": {
      const { createOpenAiCompatibleRuntime } = await import("./openai-compatible");
      return createOpenAiCompatibleRuntime();
    }
    case "externalWidget": {
      const { createExternalWidgetRuntime } = await import("./external-widget");
      return createExternalWidgetRuntime();
    }
    default:
      return null;
  }
}
