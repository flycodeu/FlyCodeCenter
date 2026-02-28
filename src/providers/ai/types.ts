export interface AiConnection {
  apiBaseUrl: string;
  model: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

export interface AiRuntime {
  summarizeCurrentArticle: () => Promise<string>;
  askSite: (question: string) => Promise<string>;
  chat: (prompt: string) => Promise<string>;
  mountExternalWidget?: (host: HTMLElement) => Promise<void>;
  setConnection?: (connection: Partial<AiConnection>) => void;
  getConnection?: () => AiConnection;
}
