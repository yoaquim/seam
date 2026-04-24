import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRecordings } from "@/hooks/useRecordings";

describe("useRecordings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads recordings from manifest.json", async () => {
    const mockData = {
      recordings: [
        {
          dirName: "2026-04-22_test",
          data: {
            id: "rec_001",
            title: "Test Recording",
            description: "",
            duration: 60,
            language: "en",
            created_at: "2026-04-22T09:00:00Z",
            tags: [],
            transcript: [],
            summary: {},
          },
          analysis: null,
          markdown: "",
          analysisMarkdown: null,
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const { result } = renderHook(() => useRecordings());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.recordings).toHaveLength(1);
    expect(result.current.recordings[0].data.title).toBe("Test Recording");
    expect(result.current.error).toBeNull();
  });

  it("handles fetch errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const { result } = renderHook(() => useRecordings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to load manifest: 404");
    expect(result.current.recordings).toHaveLength(0);
  });

  it("handles network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useRecordings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
  });
});
