import siteConfig from "@/site.config";

function countCjkCharacters(text: string): number {
  const matches = text.match(/[\u3400-\u9fff]/g);
  return matches ? matches.length : 0;
}

function countLatinWords(text: string): number {
  const latinOnly = text.replace(/[\u3400-\u9fff]/g, " ");
  const words = latinOnly.trim().match(/[A-Za-z0-9_]+/g);
  return words ? words.length : 0;
}

export function estimateWordCount(text: string): number {
  const cjk = countCjkCharacters(text);
  const latin = countLatinWords(text);
  return cjk + latin;
}

export function estimateReadingMinutes(text: string): number {
  const wordCount = estimateWordCount(text);
  const wpm = siteConfig.readingTime.wordsPerMinute;
  return Math.max(1, Math.ceil(wordCount / wpm));
}

export function summarizeReading(text: string): { wordCount: number; minutes: number } {
  return {
    wordCount: estimateWordCount(text),
    minutes: estimateReadingMinutes(text)
  };
}
