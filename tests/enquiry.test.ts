import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enquirySchema } from "@/lib/enquiry-schema";
import { POST } from "@/app/api/enquiry/route";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  insert: vi.fn(), maybeSingle: vi.fn(), limit: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.limit, rateLimitKey: () => "test-bucket",
}));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ from: () => ({
    insert: mocks.insert,
    select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
  }) }),
}));

const valid = {
  submissionId: "7a7e5f64-94e5-46ea-93ed-e4e2a071a3b2",
  name: "Ada Owner",
  email: "ada@example.com",
  projectDetails: "We need a website with a clear enquiry form.",
  plannerChoices: { service: "website", integrations: ["payments"], start: "month" },
  website: "",
};
function request(payload: unknown = valid, origin = "https://example.com") {
  return new Request("https://example.com/api/enquiry", {
    method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(payload),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://example.com");
  vi.stubEnv("DATABASE_URL", "");
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.maybeSingle.mockReset();
  mocks.limit.mockReset().mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("enquiry schema", () => {
  it("trims user text and rejects unsupported planner choices", () => {
    expect(enquirySchema.parse({ ...valid, name: "  Ada Owner  " }).name).toBe("Ada Owner");
    expect(enquirySchema.safeParse({ ...valid, plannerChoices: { ...valid.plannerChoices, service: "unknown" } }).success).toBe(false);
  });
  it("rejects duplicate integrations, hidden fields and excess data", () => {
    expect(enquirySchema.safeParse({ ...valid, plannerChoices: { ...valid.plannerChoices, integrations: ["crm", "crm"] } }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...valid, website: "spam.example" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...valid, admin: true }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...valid, projectDetails: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("POST /api/enquiry", () => {
  it("returns success only after inserting validated fields", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.insert).toHaveBeenCalledWith({
      id: valid.submissionId, name: valid.name, email: valid.email,
      project_details: valid.projectDetails, planner_choices: valid.plannerChoices,
    });
  });
  it("rejects invalid email and cross-origin requests before database writes", async () => {
    expect((await POST(request({ ...valid, email: "invalid" }))).status).toBe(400);
    expect((await POST(request(valid, "https://evil.example"))).status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("returns 429 for a rejected rate limit", async () => {
    mocks.limit.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("fails closed if the distributed limiter cannot be reached", async () => {
    mocks.limit.mockRejectedValue(new Error("backend unavailable"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("does not reveal database internals or claim a failed insert succeeded", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "42501", message: "private database detail" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database detail");
  });
  it("acknowledges an identical retry without overwriting the row", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    mocks.maybeSingle.mockResolvedValue({ data: {
      name: valid.name, email: valid.email, project_details: valid.projectDetails, planner_choices: valid.plannerChoices,
    }, error: null });
    expect((await POST(request())).status).toBe(200);
  });
  it("rejects reuse of an ID with different content", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    mocks.maybeSingle.mockResolvedValue({ data: {
      name: "A different person", email: valid.email, project_details: valid.projectDetails, planner_choices: valid.plannerChoices,
    }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("A different person");
  });
});
