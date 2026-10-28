import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSameOrigin, HttpError, readJson } from "@/lib/http";

vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/enquiry", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body,
  });
}

describe("request boundaries", () => {
  it("requires the configured origin rather than trusting Host", () => {
    vi.stubEnv("APP_ORIGIN", "https://example.com");
    expect(() => assertSameOrigin(jsonRequest("{}", { origin: "https://example.com" }))).not.toThrow();
    expect(() => assertSameOrigin(jsonRequest("{}", { host: "example.com" }))).toThrow(HttpError);
    expect(() => assertSameOrigin(jsonRequest("{}", { origin: "https://evil.example", host: "evil.example" }))).toThrow(HttpError);
  });

  it("fails closed when origin configuration is absent", () => {
    vi.stubEnv("APP_ORIGIN", "");
    expect(() => assertSameOrigin(jsonRequest("{}"))).toThrow(HttpError);
  });

  it("parses JSON and rejects malformed JSON", async () => {
    await expect(readJson(jsonRequest('{"name":"Ada"}'))).resolves.toEqual({ name: "Ada" });
    await expect(readJson(jsonRequest("{broken"))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a non-JSON content type", async () => {
    await expect(readJson(jsonRequest("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({ status: 415 });
  });

  it("enforces actual UTF-8 byte size with no Content-Length", async () => {
    await expect(readJson(jsonRequest(JSON.stringify({ value: "🌏".repeat(10) })), 32))
      .rejects.toMatchObject({ status: 413 });
  });

  it("rejects declared oversized requests before parsing", async () => {
    await expect(readJson(jsonRequest("{}", { "content-length": "50000" })))
      .rejects.toMatchObject({ status: 413 });
  });
});
