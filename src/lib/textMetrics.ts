export interface NormalizeOptions {
  removeAccents?: boolean;
}

export function normalizeSpanishText(input: string, options: NormalizeOptions = {}): string {
  const removeAccents = options.removeAccents ?? true;
  let normalized = input.toLowerCase();
  if (removeAccents) {
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  return normalized
    .replace(/[^a-z0-9ñ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeWords(input: string, options: NormalizeOptions = {}): string[] {
  const text = normalizeSpanishText(input, options);
  if (!text) return [];
  return text.split(' ');
}

export function computeWER(referenceWords: string[], hypothesisWords: string[]): number {
  if (referenceWords.length === 0) return hypothesisWords.length > 0 ? 1 : 0;

  const dp: number[][] = Array.from({ length: referenceWords.length + 1 }, () =>
    Array(hypothesisWords.length + 1).fill(0),
  );

  for (let i = 0; i <= referenceWords.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= hypothesisWords.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= referenceWords.length; i += 1) {
    for (let j = 1; j <= hypothesisWords.length; j += 1) {
      const cost = referenceWords[i - 1] === hypothesisWords[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[referenceWords.length][hypothesisWords.length] / referenceWords.length;
}

export function computeAccuracy(referenceText: string, hypothesisText: string, options: NormalizeOptions = {}): number {
  const ref = tokenizeWords(referenceText, options);
  const hyp = tokenizeWords(hypothesisText, options);
  const wer = computeWER(ref, hyp);
  const accuracy = 1 - wer;
  return Math.max(0, Math.min(1, accuracy));
}

export function calculateWpm(wordCountRead: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Number((wordCountRead / (durationSeconds / 60)).toFixed(2));
}
