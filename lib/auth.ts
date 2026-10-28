import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig, verifyAdminToken } from "@/lib/session";

export function sessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-migsak_admin" : "migsak_admin";
}

export async function hasAdminSession(): Promise<boolean> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return false;
  try {
    return await verifyAdminToken(token, authConfig());
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  if (!(await hasAdminSession())) redirect("/admin/login");
}
