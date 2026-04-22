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
        `${failurePrefix} The local API at ${apiBaseUrl} did not respond within ${Math.ceil(timeoutMs / 1000)}s.`,
      );
    }

    throw new Error(
      `${failurePrefix} Unable to reach the local API at ${apiBaseUrl}. Start the API bridge and analyzer, then try again.`,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}
