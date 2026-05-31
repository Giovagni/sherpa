// ~4 chars per token is a reasonable estimate for code/markdown
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export const TOKEN_WARN_THRESHOLD = 8000;
