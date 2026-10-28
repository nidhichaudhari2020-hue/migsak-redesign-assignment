import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { consumeDatabaseRateLimit } from "@/lib/database";

/** Do not trust arbitrary forwarded headers on a directly reachable server. */
export function rateLimitKey(scope: string, request: Request): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("A strong session secret is required.");
  const forwarded = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : null;
  const client = forwarded && isIP(forwarded) ? forwarded : "shared-unknown-client";
  return `${scope}:${createHmac("sha256", secret).update(client).digest("hex")}`;
}

/** Atomic SQL counter works across multiple serverless instances. Fail closed. */
export async function consumeRateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  return consumeDatabaseRateLimit(bucket, limit, windowSeconds);
}
