import { z } from "zod";
import { enquirySchema, type PlannerChoices } from "@/lib/enquiry-schema";
import { assertSameOrigin, errorResponse, HttpError, jsonResponse, readJson } from "@/lib/http";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { findEnquiry, insertEnquiry, isUniqueViolation } from "@/lib/database";

export const runtime = "nodejs";

function sameChoices(a: PlannerChoices, b: PlannerChoices) {
  return a.service === b.service && a.start === b.start &&
    [...a.integrations].sort().join(",") === [...b.integrations].sort().join(",");
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const parsed = enquirySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonResponse({ error: "Please check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors }, 400);
    }
    if (!await consumeRateLimit(rateLimitKey("enquiry", request), 5, 900)) {
      throw new HttpError(429, "Too many enquiries. Please wait 15 minutes before trying again.");
    }

    const { submissionId, name, email, projectDetails, plannerChoices } = parsed.data;
    const row = { id: submissionId, name, email, project_details: projectDetails, planner_choices: plannerChoices };
    try {
      await insertEnquiry(row);
      return jsonResponse({ ok: true }, 201);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // A retry after a lost response is safe; a conflicting ID never overwrites a record.
      const previous = await findEnquiry(submissionId);
      if (previous && previous.name === name && previous.email === email &&
          previous.project_details === projectDetails && sameChoices(previous.planner_choices as PlannerChoices, plannerChoices)) {
        return jsonResponse({ ok: true }, 200);
      }
      throw new HttpError(409, "This submission could not be saved. Reload the page and try again.");
    }
  } catch (error) {
    return errorResponse(error);
  }
}
