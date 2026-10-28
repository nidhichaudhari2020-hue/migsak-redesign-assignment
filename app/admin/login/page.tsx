import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-auth";
import { hasAdminSession } from "@/lib/auth";

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect("/admin");
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
    <Link href="/" className="mb-12 text-sm font-semibold">← Back to Migsak</Link>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Private workspace</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight">Enquiries, in one place.</h1>
    <p className="mt-4 text-slate-600">Sign in to review project enquiries.</p>
    <AdminLoginForm />
  </main>;
}
