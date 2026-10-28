import "server-only";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

/** Use configured deployment origin, never an attacker-controlled Host header. */
export function assertSameOrigin(request: Request): void {
  let allowed: URL;
  try {
    allowed = new URL(process.env.APP_ORIGIN ?? "");
    if (!/^https?:$/.test(allowed.protocol) || allowed.username || allowed.password || allowed.pathname !== "/" || allowed.search || allowed.hash) throw new Error();
  } catch {
    throw new HttpError(503, "This service is not configured yet.");
  }
  if (request.headers.get("origin") !== allowed.origin) {
    throw new HttpError(403, "This request could not be verified. Reload the page and try again.");
  }
}

/** Bound actual bytes, including chunked requests with no Content-Length. */
export async function readJson(request: Request, maxBytes = 20_480): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "Send JSON data.");
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new HttpError(413, "This submission is too large.");
  }
  if (!request.body) throw new HttpError(400, "The request body is empty.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "This submission is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new HttpError(400, "The request contains invalid JSON.");
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function errorResponse(error: unknown): Response {
  const response = error instanceof HttpError
    ? jsonResponse({ error: error.message }, error.status)
    : jsonResponse({ error: "The service is temporarily unavailable. Please try again shortly." }, 503);
  if (error instanceof HttpError && error.status === 429) response.headers.set("Retry-After", "900");
  return response;
}
