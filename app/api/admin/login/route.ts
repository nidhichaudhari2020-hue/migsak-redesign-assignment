import { cookies } from "next/headers";
import { z } from "zod";
import { authConfig, createAdminToken, passwordMatches, SESSION_SECONDS } from "@/lib/session";
import { sessionCookieName } from "@/lib/auth";
import { assertSameOrigin, errorResponse, HttpError, jsonResponse, readJson } from "@/lib/http";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
const schema = z.object({ password: z.string().min(1).max(256) }).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    let config;
    try { config = authConfig(); } catch { throw new HttpError(503, "Admin sign-in is temporarily unavailable."); }
    if (!(await consumeRateLimit(rateLimitKey("admin-login", request), 10, 900))) {
      throw new HttpError(429, "Too many sign-in attempts. Please try again in 15 minutes.");
    }
    const parsed = schema.safeParse(await readJson(request, 2048));
    if (!parsed.success || !passwordMatches(parsed.data.password, config.password)) {
      throw new HttpError(401, "The password is incorrect.");
    }
    const token = await createAdminToken(config);
    (await cookies()).set(sessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
