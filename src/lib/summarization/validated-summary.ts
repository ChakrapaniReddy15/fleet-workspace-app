import {
  projectSummarySchema,
  type ProjectSummary,
} from "./schema";
import { buildSummaryPrompt } from "./prompt";
import type { SummaryProvider } from "./provider";

export class InvalidSummaryError extends Error {
  constructor() {
    super("The summary provider returned invalid output after one retry.");
    this.name = "InvalidSummaryError";
  }
}

export async function createValidatedSummary(
  provider: SummaryProvider,
  notes: readonly string[],
): Promise<ProjectSummary> {
  const prompt = buildSummaryPrompt(notes);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await provider.summarize(prompt);
    const result = projectSummarySchema.safeParse(output);

    if (result.success) {
      return result.data;
    }
  }

  throw new InvalidSummaryError();
}
