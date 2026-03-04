import { integrationsBuildPlugin } from "./integrations.plugin.mjs";
import { markdownBuildPlugin } from "./markdown.plugin.mjs";
import { codeHighlightBuildPlugin } from "./code-highlight.plugin.mjs";

export const buildPlugins = [codeHighlightBuildPlugin, integrationsBuildPlugin, markdownBuildPlugin];
