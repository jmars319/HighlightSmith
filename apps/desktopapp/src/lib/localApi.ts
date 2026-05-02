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
        `${failurePrefix} Pulse did not finish starting within ${Math.ceil(timeoutMs / 1000)}s. Try again in a few seconds.`,
      );
    }

    throw new Error(
      `${failurePrefix} Pulse is still starting. Try again in a few seconds.`,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}
