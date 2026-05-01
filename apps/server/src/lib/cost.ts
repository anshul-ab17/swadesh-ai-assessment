// Haiku 4.5 pricing (USD per million tokens)
const HAIKU_INPUT_PER_M = 0.8;
const HAIKU_OUTPUT_PER_M = 4.0;
const HAIKU_CACHE_READ_PER_M = 0.08;
const HAIKU_CACHE_WRITE_PER_M = 1.0;

export function estimateCost(opts: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}): number {
  return (
    (opts.inputTokens * HAIKU_INPUT_PER_M +
      opts.outputTokens * HAIKU_OUTPUT_PER_M +
      opts.cacheReadTokens * HAIKU_CACHE_READ_PER_M +
      opts.cacheWriteTokens * HAIKU_CACHE_WRITE_PER_M) /
    1_000_000
  );
}
