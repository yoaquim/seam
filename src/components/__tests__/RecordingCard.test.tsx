import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingCard } from "@/components/RecordingCard";
import type { Recording } from "@/types/recording";

const baseRecording: Recording = {
  dirName: "2026-04-22_test",
  data: {
    id: "rec_001",
    title: "Weekly Standup",
    description: "Monday standup",
    duration: 1247,
    language: "en",
    created_at: "2026-04-22T09:00:00Z",
    tags: [{ name: "standup" }, { name: "team" }],
    transcript: [
      { speaker: "Alice", text: "Good morning everyone.", start: 0, end: 3 },
      { speaker: "Bob", text: "Morning!", start: 4, end: 5 },
    ],
    summary: {},
  },
  analysis: {
    recording_id: "rec_001",
    title: "Weekly Standup",
    date: "2026-04-22",
    duration_seconds: 1247,
    type: "meeting",
    participants: ["Alice", "Bob"],
    executive_summary: "Monday standup covering sprint progress.",
    takeaways: ["Auth migration in review", "Dashboard redesign starting"],
    decisions: [
      { decision: "Close items by Thursday", by: "Alice", rationale: "Demo Friday" },
    ],
    action_items: [
      { task: "Merge auth PR", owner: "Bob", due: "2026-04-22", completed: false },
    ],
    open_questions: ["Will security approve today?"],
    key_quotes: [
      { text: "Should merge today.", speaker: "Bob", timestamp_seconds: 6 },
    ],
    topics: [],
    mind_map: { nodes: [], edges: [] },
    sentiment: "neutral",
    tags_suggested: ["standup"],
  },
  markdown: "",
  analysisMarkdown: null,
};

describe("RecordingCard", () => {
  it("renders title and metadata", () => {
    render(<RecordingCard recording={baseRecording} onOpenMindMap={vi.fn()} />);

    expect(screen.getByText("Weekly Standup")).toBeInTheDocument();
    expect(screen.getByText("2026-04-22")).toBeInTheDocument();
    expect(screen.getByText("20m 47s")).toBeInTheDocument();
    expect(screen.getByText("standup")).toBeInTheDocument();
    expect(screen.getByText("team")).toBeInTheDocument();
    expect(screen.getByText("meeting")).toBeInTheDocument();
  });

  it("expands to show analysis on click", async () => {
    const user = userEvent.setup();
    render(<RecordingCard recording={baseRecording} onOpenMindMap={vi.fn()} />);

    // Analysis content should not be visible initially
    expect(screen.queryByText("Monday standup covering sprint progress.")).not.toBeInTheDocument();

    // Click the header to expand
    await user.click(screen.getByText("Weekly Standup"));

    // Now analysis content should be visible
    expect(screen.getByText("Monday standup covering sprint progress.")).toBeInTheDocument();
    expect(screen.getByText("Auth migration in review")).toBeInTheDocument();
    expect(screen.getByText("Merge auth PR")).toBeInTheDocument();
    expect(screen.getByText("Will security approve today?")).toBeInTheDocument();
  });

  it("shows transcript link when transcript exists", async () => {
    const user = userEvent.setup();
    render(<RecordingCard recording={baseRecording} onOpenMindMap={vi.fn()} />);

    await user.click(screen.getByText("Weekly Standup"));

    expect(screen.getByText("View Transcript (2 segments)")).toBeInTheDocument();
  });

  it("renders without analysis gracefully", () => {
    const noAnalysis: Recording = {
      ...baseRecording,
      analysis: null,
    };
    render(<RecordingCard recording={noAnalysis} onOpenMindMap={vi.fn()} />);

    expect(screen.getByText("Weekly Standup")).toBeInTheDocument();
  });
});
