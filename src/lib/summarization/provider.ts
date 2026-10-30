export interface SummaryProvider {
  summarize(notes: readonly string[]): Promise<unknown>;
}
