import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnquiryInsert } from "@/lib/database";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), on: vi.fn(), pool: vi.fn(), supabase: vi.fn(), limit: vi.fn(),
}));
vi.mock("pg", () => ({
  Pool: vi.fn(function (config) {
    mocks.pool(config);
    return { query: mocks.query, on: mocks.on };
  }),
}));
vi.mock("@/lib/supabase", () => ({ getSupabase: mocks.supabase }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.limit, rateLimitKey: () => "test-bucket" }));

const row: EnquiryInsert = {
  id: "7a7e5f64-94e5-46ea-93ed-e4e2a071a3b2",
  name: "Ada Owner",
  email: "ada@example.com",
  project_details: "We need a website with a clear enquiry form.",
  planner_choices: { service: "website", integrations: ["payments"], start: "month" },
};

function request() {
  return new Request("https://example.com/api/enquiry", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" },
    body: JSON.stringify({
      submissionId: row.id, name: row.name, email: row.email,
      projectDetails: row.project_details, plannerChoices: row.planner_choices, website: "",
    }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://test:private-password@db.example.com/test?sslmode=disable&ssl=no-verify");
  vi.stubEnv("APP_ORIGIN", "https://example.com");
  mocks.query.mockReset(); mocks.on.mockReset(); mocks.pool.mockReset(); mocks.supabase.mockReset();
  mocks.limit.mockReset().mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("optional PostgreSQL backend", () => {
  it("keeps user data out of SQL text and enforces verified TLS", async () => {
    mocks.query.mockResolvedValue({ rows: [], rowCount: 1 });
    const { insertEnquiry } = await import("@/lib/database");
    const hostileName = "Robert'); DROP TABLE enquiries;--";
    await insertEnquiry({ ...row, name: hostileName });
    const [sql, parameters] = mocks.query.mock.calls[0];
    expect(sql).not.toContain(hostileName);
    expect(sql).toContain("$1");
    expect(parameters).toEqual([row.id, hostileName, row.email, row.project_details, JSON.stringify(row.planner_choices)]);
    expect(mocks.pool).toHaveBeenCalledWith(expect.objectContaining({
      ssl: { rejectUnauthorized: true }, max: 2,
      connectionTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 10_000,
    }));
    expect(mocks.pool.mock.calls[0][0].connectionString).not.toContain("sslmode");
    expect(mocks.pool.mock.calls[0][0].connectionString).not.toContain("no-verify");
    expect(mocks.supabase).not.toHaveBeenCalled();
  });

  it("returns 201 only after PostgreSQL accepts an enquiry", async () => {
    mocks.query.mockResolvedValue({ rows: [], rowCount: 1 });
    const { POST } = await import("@/app/api/enquiry/route");
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("accepts identical duplicate IDs without overwriting and rejects conflicting ones", async () => {
    const { POST } = await import("@/app/api/enquiry/route");
    mocks.query.mockRejectedValueOnce({ code: "23505" }).mockResolvedValueOnce({ rows: [row] });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.query.mock.calls[1][1]).toEqual([row.id]);
    mocks.query.mockRejectedValueOnce({ code: "23505" }).mockResolvedValueOnce({ rows: [{ ...row, name: "Private other name" }] });
    const conflict = await POST(request());
    expect(conflict.status).toBe(409);
    expect(await conflict.text()).not.toContain("Private other name");
    expect(mocks.query.mock.calls.every(([sql]) => !/\bupdate\b/i.test(sql))).toBe(true);
  });

  it("fails safely on connection failure and lookup failure after a duplicate", async () => {
    const { POST } = await import("@/app/api/enquiry/route");
    mocks.query.mockRejectedValueOnce(new Error("private connection detail"));
    const failedInsert = await POST(request());
    expect(failedInsert.status).toBe(503);
    expect(await failedInsert.text()).not.toContain("private connection detail");
    mocks.query.mockRejectedValueOnce({ code: "23505" }).mockRejectedValueOnce(new Error("private lookup detail"));
    const failedLookup = await POST(request());
    expect(failedLookup.status).toBe(503);
    expect(await failedLookup.text()).not.toContain("private lookup detail");
  });

  it("keeps the total count for an empty page and parameterizes page bounds", async () => {
    mocks.query.mockResolvedValue({ rows: [{ count: "73", rows: [] }] });
    const { listEnquiries } = await import("@/lib/database");
    await expect(listEnquiries(3, 50)).resolves.toEqual({ rows: [], count: 73 });
    const [sql, parameters] = mocks.query.mock.calls[0];
    expect(parameters).toEqual([50, 100]);
    expect(sql).toMatch(/order by created_at desc, id desc/);
    expect(sql).toMatch(/limit \$1 offset \$2/);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("normalizes persisted timestamps for the admin table", async () => {
    mocks.query.mockResolvedValue({ rows: [{ count: "1", rows: [{ ...row, created_at: "2026-10-28T08:30:00+00:00" }] }] });
    const { listEnquiries } = await import("@/lib/database");
    const result = await listEnquiries(1, 50);
    expect(result.rows[0].created_at).toBe("2026-10-28T08:30:00.000Z");
    expect(result.rows[0].planner_choices).toEqual(row.planner_choices);
  });

  it("requires a boolean result from the atomic rate limiter and fails closed", async () => {
    const { consumeDatabaseRateLimit } = await import("@/lib/database");
    mocks.query.mockResolvedValueOnce({ rows: [{ allowed: false }] });
    await expect(consumeDatabaseRateLimit("opaque-bucket", 5, 900)).resolves.toBe(false);
    expect(mocks.query.mock.calls[0][1]).toEqual(["opaque-bucket", 5, 900]);
    mocks.query.mockResolvedValueOnce({ rows: [{ allowed: true }] });
    await expect(consumeDatabaseRateLimit("opaque-bucket", 5, 900)).resolves.toBe(true);
    mocks.query.mockResolvedValueOnce({ rows: [] });
    await expect(consumeDatabaseRateLimit("opaque-bucket", 5, 900)).rejects.toThrow();
    mocks.query.mockRejectedValueOnce(new Error("unavailable"));
    await expect(consumeDatabaseRateLimit("opaque-bucket", 5, 900)).rejects.toThrow();
  });

  it("rejects malformed database configuration before opening a connection", async () => {
    vi.stubEnv("DATABASE_URL", "https://example.com/database");
    const { insertEnquiry } = await import("@/lib/database");
    await expect(insertEnquiry(row)).rejects.toThrow("Invalid database configuration.");
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(mocks.supabase).not.toHaveBeenCalled();
  });

  it("preserves Supabase pagination when DATABASE_URL is absent", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const range = vi.fn().mockResolvedValue({ data: [], count: 73, error: null });
    const order = vi.fn();
    order.mockReturnValue({ order, range });
    mocks.supabase.mockReturnValue({ from: () => ({ select: () => ({ order }) }) });
    const { listEnquiries } = await import("@/lib/database");
    await expect(listEnquiries(3, 50)).resolves.toEqual({ rows: [], count: 73 });
    expect(range).toHaveBeenCalledWith(100, 149);
    expect(mocks.pool).not.toHaveBeenCalled();
  });
});
