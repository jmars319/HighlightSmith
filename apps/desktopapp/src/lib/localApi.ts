const defaultLocalApiTimeoutMs = 15_000;

export const localApiTimeouts: {
  default: number;
  analysis: number;
} = {
  default: defaultLocalApiTimeoutMs,
  analysis: 30_000,
};

export async function fetchWithLocalApiMessage(
  input: string,
  apiBaseUrl: string,
  init: RequestInit | undefined,
  failurePrefix: string,
  timeoutMs = localApiTimeouts.default,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `${failurePrefix} HS could not reach its local service at ${apiBaseUrl} within ${Math.ceil(timeoutMs / 1000)}s.`,
      );
    }

    throw new Error(
      `${failurePrefix} HS could not reach its local service at ${apiBaseUrl}. Start the local backend, then try again.`,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}
