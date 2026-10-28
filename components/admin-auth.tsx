"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    setPending(true); setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      form.reset();
      router.replace("/admin"); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
    } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="mt-8 grid gap-5">
    <div><label className="mb-2 block text-sm font-semibold" htmlFor="admin-password">Admin password</label>
      <input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={256}
        className="field w-full" aria-describedby={error ? "login-error" : undefined} aria-invalid={Boolean(error)} />
    </div>
    <p id="login-error" role="alert" className="text-sm text-red-700">{error}</p>
    <button className="button button-primary w-full justify-center" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}

export function AdminLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      router.replace("/admin/login"); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally { setPending(false); }
  }
  return <div className="text-right"><button className="button button-secondary" onClick={logout} disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button><p role="alert" className="mt-2 text-sm text-red-700">{error}</p></div>;
}
