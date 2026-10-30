import { z } from "zod";

export const projectSummarySchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  keyPoints: z.array(z.string().trim().min(1).max(300)).max(5),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;
