import type { SummaryPrompt } from "./prompt";

export interface SummaryProvider {
  /** Returns raw model output; callers must validate it before use. */
  summarize(prompt: SummaryPrompt): Promise<unknown>;
}
