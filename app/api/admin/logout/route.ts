import { cookies } from "next/headers";
import { sessionCookieName } from "@/lib/auth";
import { assertSameOrigin, errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    (await cookies()).set(sessionCookieName(), "", {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/", maxAge: 0,
    });
    return jsonResponse({ ok: true });
  } catch (error) { return errorResponse(error); }
}
