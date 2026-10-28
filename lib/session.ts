import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_SECONDS = 60 * 60 * 8;
const issuer = "migsak-admin";
const audience = "migsak-admin-page";
export type AuthConfig = { password: string; secret: string };

export function authConfig(): AuthConfig {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  if (password.length < 16 || secret.length < 32 || password.includes("REPLACE_") || secret.includes("REPLACE_")) {
    throw new Error("Admin authentication is not configured.");
  }
  return { password, secret };
}

export function passwordMatches(candidate: string, expected: string): boolean {
  // Fixed-length digests avoid a timingSafeEqual length exception.
  return timingSafeEqual(
    createHash("sha256").update(candidate).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

function signingKey(config: AuthConfig) {
  // Rotating either environment variable invalidates existing sessions.
  return createHmac("sha256", config.secret).update(config.password).digest();
}

export async function createAdminToken(config: AuthConfig, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("site-admin").setIssuer(issuer).setAudience(audience)
    .setIssuedAt(issuedAt).setExpirationTime(issuedAt + SESSION_SECONDS)
    .sign(signingKey(config));
}

export async function verifyAdminToken(token: string, config: AuthConfig, now = new Date()): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, signingKey(config), {
      algorithms: ["HS256"], issuer, audience, currentDate: now,
      maxTokenAge: SESSION_SECONDS,
      requiredClaims: ["exp", "iat", "sub"],
    });
    return payload.sub === "site-admin" && payload.role === "admin";
  } catch {
    return false;
  }
}
