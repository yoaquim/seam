import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecordingToolbar } from "@/components/RecordingToolbar";
import type { Recording } from "@/types/recording";

function makeRecording(tags: string[]): Recording {
  return {
    dirName: tags.join("-"),
    data: {
      id: "rec_" + tags.join("_"),
      title: "Test",
      description: "",
      duration: 100,
      language: "en",
      recording_at: null,
      created_at: "2026-04-22T09:00:00Z",
      tags: tags.map((name) => ({ name })),
      transcript: [],
      summary: {},
    },
    analysis: null,
    markdown: "",
    analysisMarkdown: null,
  };
}

const noop = vi.fn();

describe("RecordingToolbar tag filter", () => {
  it("scrolls horizontally and does not wrap when many tags exist", () => {
    const tags = Array.from({ length: 30 }, (_, i) => `tag-${i.toString().padStart(2, "0")}`);
    render(
      <RecordingToolbar
        recordings={[makeRecording(tags)]}
        sortField="date"
        sortDir="desc"
        filterType=""
        filterTag=""
        onSortFieldChange={noop}
        onSortDirToggle={noop}
        onFilterTypeChange={noop}
        onFilterTagChange={noop}
      />,
    );

    // Find the row by picking any tag chip and walking up to its row container.
    const firstTag = screen.getByText("tag-00");
    const row = firstTag.closest('[data-testid="tag-filter-row"]');
    expect(row).not.toBeNull();
    const className = row!.className;

    // The row should scroll horizontally rather than wrapping.
    expect(className).toMatch(/overflow-x-auto/);
    // Chips must stay on a single line.
    expect(className).toMatch(/flex-nowrap|whitespace-nowrap/);
    // The leading icon should not shrink.
    const icon = row!.querySelector("svg");
    expect(icon?.getAttribute("class") || "").toMatch(/shrink-0|flex-shrink-0/);
  });

  it("renders nothing when there are no tags", () => {
    render(
      <RecordingToolbar
        recordings={[makeRecording([])]}
        sortField="date"
        sortDir="desc"
        filterType=""
        filterTag=""
        onSortFieldChange={noop}
        onSortDirToggle={noop}
        onFilterTypeChange={noop}
        onFilterTagChange={noop}
      />,
    );
    expect(screen.queryByTestId("tag-filter-row")).toBeNull();
  });
});
