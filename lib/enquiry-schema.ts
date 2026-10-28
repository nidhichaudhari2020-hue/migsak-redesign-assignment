import { z } from "zod";

export const serviceValues = ["website", "web-app", "mobile-app", "automation", "integration", "unsure"] as const;
export const integrationValues = ["payments", "whatsapp", "crm", "erp", "accounting"] as const;
export const startValues = ["asap", "month", "quarter", "exploring"] as const;

export const plannerSchema = z.object({
  service: z.enum(serviceValues),
  integrations: z.array(z.enum(integrationValues)).max(5)
    .refine((values) => new Set(values).size === values.length, "Choose each integration only once."),
  start: z.enum(startValues),
}).strict();

export const enquirySchema = z.object({
  submissionId: z.uuid(),
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(100),
  email: z.string().trim().max(254).pipe(z.email("Enter a valid email address.")),
  projectDetails: z.string().trim().min(20, "Please add at least 20 characters about your project.").max(5000),
  plannerChoices: plannerSchema,
  website: z.string().max(0, "Unable to accept this submission.").optional(),
}).strict();

export type PlannerChoices = z.infer<typeof plannerSchema>;
export type EnquiryInput = z.infer<typeof enquirySchema>;

export type EnquiryRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  project_details: string;
  planner_choices: PlannerChoices;
};
