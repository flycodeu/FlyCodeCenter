import expressiveCode from "astro-expressive-code";
import rehypePrettyCode from "rehype-pretty-code";

type HighlightProvider = "expressive" | "shiki" | "prism" | "rehype-pretty-code";

interface ResolvedHighlightConfig {
  provider: HighlightProvider;
  integrations: unknown[];
  syntaxHighlight: "prism" | "shiki" | false;
  shikiConfig?: Record<string, unknown>;
  extraRehypePlugins: unknown[];
}

const readProvider = (siteConfig: any): HighlightProvider => {
  const raw = String(siteConfig?.codeHighlight?.provider || "prism").trim();
  if (raw === "expressive" || raw === "shiki" || raw === "prism" || raw === "rehype-pretty-code") {
    return raw;
  }
  return "prism";
};

const toShikiThemeName = (themeId: string, darkFallback = false) => {
  const key = String(themeId || "").trim().toLowerCase();
  const mapping: Record<string, string> = {
    "mac-light": "github-light",
    "mac-dark": "github-dark",
    "github-light": "github-light",
    "github-dark": "github-dark",
    "idea-light": "light-plus",
    "idea-dark": "dark-plus",
    "one-light": "one-light",
    "one-dark": "one-dark-pro",
    "nord-dark": "nord",
    dracula: "dracula"
  };
  if (mapping[key]) return mapping[key];
  return darkFallback ? "github-dark" : "github-light";
};

const resolveThemePair = (siteConfig: any) => {
  const themes = Array.isArray(siteConfig?.codeTheme?.themes) ? siteConfig.codeTheme.themes : [];
  const fallback = String(siteConfig?.codeTheme?.defaultTheme || "github-light");
  const lightRaw = themes.find((item: string) => item.includes("light")) || fallback || "github-light";
  const darkRaw = themes.find((item: string) => item.includes("dark")) || "github-dark";
  return {
    light: toShikiThemeName(lightRaw, false),
    dark: toShikiThemeName(darkRaw, true)
  };
};

export const resolveCodeHighlightConfig = (siteConfig: any): ResolvedHighlightConfig => {
  const provider = readProvider(siteConfig);
  const { light, dark } = resolveThemePair(siteConfig);
  const langs = Array.isArray(siteConfig?.codeHighlight?.languages) ? siteConfig.codeHighlight.languages : [];

  if (provider === "expressive") {
    return {
      provider,
      integrations: [
        expressiveCode({
          themes: [light, dark]
        })
      ],
      syntaxHighlight: false,
      extraRehypePlugins: []
    };
  }

  if (provider === "shiki") {
    return {
      provider,
      integrations: [],
      syntaxHighlight: "shiki",
      shikiConfig: {
        themes: { light, dark },
        wrap: true,
        langs
      },
      extraRehypePlugins: []
    };
  }

  if (provider === "rehype-pretty-code") {
    return {
      provider,
      integrations: [],
      syntaxHighlight: false,
      extraRehypePlugins: [
        [
          rehypePrettyCode,
          {
            keepBackground: false,
            defaultLang: "txt",
            theme: {
              light,
              dark
            }
          }
        ]
      ]
    };
  }

  return {
    provider: "prism",
    integrations: [],
    syntaxHighlight: "prism",
    extraRehypePlugins: []
  };
};
