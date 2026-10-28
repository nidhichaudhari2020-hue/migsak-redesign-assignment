import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { requireAdmin } from "@/lib/auth";
import { createAdminToken, verifyAdminToken } from "@/lib/session";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), limit: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.limit, rateLimitKey: () => "admin:test" }));
const config = { password: "a-long-admin-test-password", secret: "test-signing-key-at-least-32-characters" };
function req(password = config.password, origin = "https://example.com") {
  return new Request("https://example.com/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ password }),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://example.com");
  vi.stubEnv("ADMIN_PASSWORD", config.password);
  vi.stubEnv("SESSION_SECRET", config.secret);
  vi.stubEnv("NODE_ENV", "production");
  mocks.limit.mockReset().mockResolvedValue(true);
  mocks.get.mockReset(); mocks.set.mockReset();
  mocks.redirect.mockReset().mockImplementation(() => { throw new Error("REDIRECT"); });
});
afterEach(() => vi.unstubAllEnvs());

describe("admin authentication boundaries", () => {
  it("sets only a signed, secure, HttpOnly session after successful authentication", async () => {
    expect((await login(req())).status).toBe(200);
    const [name, token, options] = mocks.set.mock.calls[0];
    expect(name).toBe("__Host-migsak_admin");
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 28800 });
    expect(await verifyAdminToken(token, config)).toBe(true);
    expect(token).not.toContain(config.password);
  });
  it("never sets a cookie on a wrong password or cross-site request", async () => {
    expect((await login(req("incorrect"))).status).toBe(401);
    expect((await login(req(config.password, "https://attacker.example"))).status).toBe(403);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("fails closed when rate limited or when the limiter is unavailable", async () => {
    mocks.limit.mockResolvedValue(false);
    expect((await login(req())).status).toBe(429);
    mocks.limit.mockRejectedValue(new Error("database unavailable"));
    expect((await login(req())).status).toBe(503);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("rejects an absent, forged or expired admin cookie", async () => {
    await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    mocks.get.mockReturnValue({ value: "admin=true" });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    mocks.get.mockReturnValue({ value: await createAdminToken(config, new Date("2000-01-01")) });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/login");
  });
  it("admits a verified session and expires the cookie on logout", async () => {
    mocks.get.mockReturnValue({ value: await createAdminToken(config) });
    await expect(requireAdmin()).resolves.toBeUndefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect((await logout(req())).status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith("__Host-migsak_admin", "", expect.objectContaining({ maxAge: 0, path: "/" }));
  });
});
