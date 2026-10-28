import "server-only";
import { Pool } from "pg";
import type { EnquiryRow } from "@/lib/enquiry-schema";
import { getSupabase } from "@/lib/supabase";

export type EnquiryInsert = Omit<EnquiryRow, "created_at">;
type PreviousEnquiry = Omit<EnquiryInsert, "id">;
type PostgresEnquiry = Omit<EnquiryRow, "created_at"> & { created_at: Date | string };

let pool: Pool | undefined;

/** DATABASE_URL opts into ordinary Postgres; otherwise use the existing Supabase API. */
function postgres(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Invalid database configuration.");
    // URI SSL options override pg's ssl object. Remove them so a hosted connection
    // always verifies the server certificate with Node's trusted certificate roots.
    for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "sslnegotiation", "uselibpqcompat"]) url.searchParams.delete(key);
    pool = new Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true },
      max: 2,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
      query_timeout: 10_000,
      statement_timeout: 10_000,
      allowExitOnIdle: true,
    });
    // An idle socket error must not crash the process or expose connection details.
    pool.on("error", () => console.error("An idle database connection was interrupted."));
  }
  return pool;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function insertEnquiry(row: EnquiryInsert): Promise<void> {
  const db = postgres();
  if (db) {
    await db.query(
      "insert into public.enquiries (id, name, email, project_details, planner_choices) values ($1, $2, $3, $4, $5::jsonb)",
      [row.id, row.name, row.email, row.project_details, JSON.stringify(row.planner_choices)],
    );
    return;
  }
  const { error } = await getSupabase().from("enquiries").insert(row);
  if (error) throw error;
}

export async function findEnquiry(id: string): Promise<PreviousEnquiry | null> {
  const db = postgres();
  if (db) {
    const result = await db.query<PreviousEnquiry>(
      "select name, email, project_details, planner_choices from public.enquiries where id = $1",
      [id],
    );
    return result.rows[0] ?? null;
  }
  const { data, error } = await getSupabase().from("enquiries")
    .select("name,email,project_details,planner_choices").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as PreviousEnquiry | null;
}

export async function listEnquiries(page: number, pageSize: number): Promise<{ rows: EnquiryRow[]; count: number }> {
  const offset = (page - 1) * pageSize;
  const db = postgres();
  if (db) {
    // One statement gives the count and this page the same database snapshot,
    // including a correct count when the requested page contains no rows.
    const result = await db.query<{ count: string; rows: PostgresEnquiry[] }>(
      `select (select count(*) from public.enquiries)::text as count,
        coalesce((select jsonb_agg(page_row order by page_row.created_at desc, page_row.id desc)
          from (select id, created_at, name, email, project_details, planner_choices
            from public.enquiries order by created_at desc, id desc limit $1 offset $2) page_row),
          '[]'::jsonb) as rows`,
      [pageSize, offset],
    );
    return {
      count: Number(result.rows[0].count),
      rows: result.rows[0].rows.map(row => ({ ...row, created_at: new Date(row.created_at).toISOString() })),
    };
  }
  const result = await getSupabase().from("enquiries")
    .select("id,created_at,name,email,project_details,planner_choices", { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (result.error) throw result.error;
  return { rows: (result.data ?? []) as EnquiryRow[], count: result.count ?? 0 };
}

export async function consumeDatabaseRateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = postgres();
  if (db) {
    const result = await db.query<{ allowed: boolean }>(
      "select public.consume_rate_limit($1, $2, $3) as allowed", [bucket, limit, windowSeconds],
    );
    if (typeof result.rows[0]?.allowed !== "boolean") throw new Error("Rate limiter is unavailable.");
    return result.rows[0].allowed;
  }
  const { data, error } = await getSupabase().rpc("consume_rate_limit", {
    p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error || typeof data !== "boolean") throw new Error("Rate limiter is unavailable.");
  return data;
}
