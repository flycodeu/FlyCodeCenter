export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface SearchEngine {
  search(query: string): Promise<SearchResult[]>;
  destroy?: () => void;
}
