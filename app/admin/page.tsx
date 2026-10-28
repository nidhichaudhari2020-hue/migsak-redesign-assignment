import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin-auth";
import { requireAdmin } from "@/lib/auth";
import { listEnquiries } from "@/lib/database";
import type { EnquiryRow } from "@/lib/enquiry-schema";

const pageSize = 50;
const labels: Record<string, string> = {
  website: "Website", "web-app": "Web app", "mobile-app": "Mobile app", automation: "Automation",
  integration: "Integration", unsure: "Not sure yet", asap: "As soon as possible",
  month: "Within a month", quarter: "In 1–3 months", exploring: "Exploring",
  payments: "Payments", whatsapp: "WhatsApp", crm: "CRM", erp: "ERP", accounting: "Accounting",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  // Authenticate before constructing a database client or reading any submissions.
  await requireAdmin();
  const { page: rawPage } = await searchParams;
  const page = typeof rawPage === "string" && /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1;
  let rows: EnquiryRow[] = [];
  let count = 0;
  let failed = false;
  try {
    const result = await listEnquiries(page, pageSize);
    rows = result.rows;
    count = result.count;
  } catch { failed = true; }
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const formatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
    <div className="flex items-start justify-between gap-4"><div>
      <Link href="/" className="text-sm font-semibold text-blue-700">← Homepage</Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">Project enquiries</h1>
      <p className="mt-3 text-slate-600">{failed ? "Submissions are temporarily unavailable." : `${count} submission${count === 1 ? "" : "s"} · newest first · dates in UTC`}</p>
    </div><AdminLogoutButton /></div>

    {failed ? <div role="alert" className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">We could not load enquiries. Check your database configuration and try refreshing the page.</div>
    : <>
      <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white" tabIndex={0} role="region" aria-label="Enquiry submissions, scroll horizontally on small screens">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">All enquiry submissions, page {page} of {totalPages}</caption>
          <thead className="bg-slate-100 text-slate-700"><tr>{["Received (UTC)", "Contact", "Project details", "Planner choices"].map(label => <th key={label} scope="col" className="px-5 py-4 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-200">{rows.map(row => <tr key={row.id}>
            <td className="w-40 px-5 py-5 align-top"><time dateTime={row.created_at}>{formatter.format(new Date(row.created_at))}</time></td>
            <td className="max-w-64 px-5 py-5 align-top"><p className="font-semibold break-words">{row.name}</p><a className="mt-1 block break-all text-blue-700 underline underline-offset-4" href={`mailto:${row.email}`}>{row.email}</a></td>
            <td className="max-w-xl px-5 py-5 align-top whitespace-pre-wrap break-words">{row.project_details}</td>
            <td className="w-64 px-5 py-5 align-top"><dl className="space-y-3"><div><dt className="font-semibold">Service</dt><dd>{labels[row.planner_choices.service] ?? row.planner_choices.service}</dd></div><div><dt className="font-semibold">Connections</dt><dd>{row.planner_choices.integrations.map(value => labels[value] ?? value).join(", ") || "None selected"}</dd></div><div><dt className="font-semibold">Start</dt><dd>{labels[row.planner_choices.start] ?? row.planner_choices.start}</dd></div></dl></td>
          </tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-slate-600">{count === 0 ? "No enquiries yet. New submissions will appear here." : "There are no submissions on this page."}</p>}
      </div>
      <nav aria-label="Submission pages" className="mt-6 flex flex-wrap items-center gap-5 text-sm">
        {page > 1 && <Link className="button button-secondary" href={`/admin?page=${page - 1}`}>← Previous</Link>}
        <span>Page {page} of {totalPages}</span>
        {page < totalPages && <Link className="button button-secondary" href={`/admin?page=${page + 1}`}>Next →</Link>}
        {page > totalPages && <Link className="underline" href="/admin">First page</Link>}
      </nav>
    </>}
  </main>;
}
