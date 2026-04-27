import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSettings } from "../useSettings";

const mockSettings = {
  configured: true,
  pocketApiKey: "pk_***bdc0",
  s3Bucket: "my-bucket",
  s3Prefix: "seam/",
  awsProfile: "",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useSettings", () => {
  it("fetches settings on mount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockSettings,
    } as Response);

    const { result } = renderHook(() => useSettings());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual(mockSettings);
    expect(fetch).toHaveBeenCalledWith("http://localhost:3001/api/settings");
  });

  it("save calls PUT and updates state", async () => {
    const updated = { ...mockSettings, s3Bucket: "new-bucket" };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => mockSettings } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => updated } as Response);

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await waitFor(async () => {
      ok = await result.current.save({ s3Bucket: "new-bucket" });
    });
    expect(ok).toBe(true);
    await waitFor(() => {
      expect(result.current.settings?.s3Bucket).toBe("new-bucket");
    });
    expect(fetch).toHaveBeenLastCalledWith(
      "http://localhost:3001/api/settings",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("testConnection calls POST /api/s3/test", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => mockSettings } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) } as Response);

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let testRes: { ok: boolean } | undefined;
    await waitFor(async () => {
      testRes = await result.current.testConnection();
    });
    expect(testRes!.ok).toBe(true);
    await waitFor(() => {
      expect(result.current.testResult).toEqual({ ok: true });
    });
  });

  it("triggerSync calls POST /api/s3/sync", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => mockSettings } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "started" }) } as Response);

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.triggerSync();
    expect(fetch).toHaveBeenLastCalledWith("http://localhost:3001/api/s3/sync", { method: "POST" });
  });
});
