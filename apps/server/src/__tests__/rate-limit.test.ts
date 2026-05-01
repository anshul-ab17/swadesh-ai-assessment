import { expect, test } from "bun:test";

async function runExtractionWithBackoff(
  callFn: () => Promise<string>,
  maxRetries = 3,
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callFn();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 10; // short delay for tests
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

test("backoff retries on 429 and succeeds on third attempt", async () => {
  let callCount = 0;
  const callFn = async (): Promise<string> => {
    callCount++;
    if (callCount < 3) {
      const err = new Error("Rate limited") as Error & { status: number };
      err.status = 429;
      throw err;
    }
    return "success";
  };

  const result = await runExtractionWithBackoff(callFn);
  expect(result).toBe("success");
  expect(callCount).toBe(3);
});

test("throws after maxRetries exceeded", async () => {
  const callFn = async (): Promise<string> => {
    const err = new Error("Rate limited") as Error & { status: number };
    err.status = 429;
    throw err;
  };

  expect(runExtractionWithBackoff(callFn, 3)).rejects.toThrow();
});
