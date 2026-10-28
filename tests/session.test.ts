import { describe, expect, it } from "vitest";
import { createAdminToken, passwordMatches, SESSION_SECONDS, verifyAdminToken } from "@/lib/session";

const config = { password: "test-password-that-is-long-enough", secret: "test-secret-that-is-at-least-thirty-two-characters" };
const now = new Date("2026-01-01T00:00:00Z");
describe("admin sessions", () => {
  it("accepts only the matching password, including different lengths", () => {
    expect(passwordMatches(config.password, config.password)).toBe(true);
    expect(passwordMatches("wrong", config.password)).toBe(false);
    expect(passwordMatches("", config.password)).toBe(false);
  });
  it("accepts a signed token and rejects tampering", async () => {
    const token = await createAdminToken(config, now);
    expect(await verifyAdminToken(token, config, now)).toBe(true);
    const [header, payload, signature] = token.split(".");
    const edited = `${header}.${payload}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
    expect(await verifyAdminToken(edited, config, now)).toBe(false);
    expect(await verifyAdminToken("not-a-token", config, now)).toBe(false);
  });
  it("rejects expired tokens and tokens after password or secret rotation", async () => {
    const token = await createAdminToken(config, now);
    expect(await verifyAdminToken(token, config, new Date(now.getTime() + SESSION_SECONDS * 1000))).toBe(false);
    expect(await verifyAdminToken(token, { ...config, password: "a-different-password" }, now)).toBe(false);
    expect(await verifyAdminToken(token, { ...config, secret: "a-different-signing-secret" }, now)).toBe(false);
  });
});
