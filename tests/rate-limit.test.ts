import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ rpc: mocks.rpc }) }));
beforeEach(() => vi.stubEnv("DATABASE_URL", ""));
afterEach(() => { vi.unstubAllEnvs(); mocks.rpc.mockReset(); });

const from = (ip: string) => new Request("https://example.com", { headers: {
  "x-forwarded-for": ip, "x-vercel-forwarded-for": ip,
} });

describe("distributed rate limiting", () => {
  it("does not trust forwarded headers on an arbitrary host", () => {
    vi.stubEnv("SESSION_SECRET", "s".repeat(64));
    vi.stubEnv("VERCEL", "");
    expect(rateLimitKey("login", from("192.0.2.1"))).toBe(rateLimitKey("login", from("192.0.2.2")));
  });
  it("uses opaque, per-client and per-purpose keys on Vercel", () => {
    vi.stubEnv("SESSION_SECRET", "s".repeat(64));
    vi.stubEnv("VERCEL", "1");
    const first = rateLimitKey("login", from("192.0.2.1"));
    expect(first).not.toContain("192.0.2.1");
    expect(first).not.toBe(rateLimitKey("login", from("192.0.2.2")));
    expect(first).not.toBe(rateLimitKey("enquiry", from("192.0.2.1")));
  });
  it("rejects weak configuration instead of storing raw IPs", () => {
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => rateLimitKey("login", from("192.0.2.1"))).toThrow();
  });
  it("passes the limit and window to the atomic database operation", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(consumeRateLimit("opaque-bucket", 5, 900)).resolves.toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_bucket: "opaque-bucket", p_limit: 5, p_window_seconds: 900,
    });
  });
  it("fails closed when the database operation fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "database-unavailable" } });
    await expect(consumeRateLimit("opaque-bucket", 5, 900)).rejects.toThrow();
  });
});
