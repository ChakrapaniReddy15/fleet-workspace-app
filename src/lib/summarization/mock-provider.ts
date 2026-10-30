import type { SummaryProvider } from "./provider";
import type { ProjectSummary } from "./schema";

export class MockSummaryProvider implements SummaryProvider {
  private calls = 0;

  async summarize(notes: readonly string[]): Promise<unknown> {
    this.calls += 1;

    if (this.calls === 1) {
      return { summary: "", keyPoints: "malformed output" };
    }

    const hasBrakeConcern = notes.some((note) =>
      /\bbrakes?\b|\bbrake noise\b/i.test(note),
    );
    const keyPoints = hasBrakeConcern
      ? ["Brake noise was reported and needs inspection."]
      : notes.slice(0, 5).map((note) => note.slice(0, 300));

    const summary = hasBrakeConcern
      ? "A brake concern was reported and should be inspected."
      : `Review ${notes.length} vehicle note${notes.length === 1 ? "" : "s"}.`;

    return {
      summary: summary.slice(0, 1000),
      keyPoints,
    } satisfies ProjectSummary;
  }
}
