import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { SettingsPage } from "../SettingsPage";

const mockSettings = {
  configured: true,
  pocketApiKey: "pk_***bdc0",
  s3Bucket: "",
  s3Prefix: "seam/",
  awsProfile: "",
};

function renderPage() {
  return render(
    <BrowserRouter>
      <SettingsPage />
    </BrowserRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => mockSettings,
  } as Response);
});

describe("SettingsPage", () => {
  it("renders settings heading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
    });
  });

  it("shows Pocket API Key section", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Pocket API Key")).toBeInTheDocument();
    });
  });

  it("shows S3 Backup section with Optional badge", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("S3 Backup")).toBeInTheDocument();
      expect(screen.getByText("Optional")).toBeInTheDocument();
    });
  });

  it("disables Test Connection when bucket is empty", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test connection/i })).toBeDisabled();
    });
  });

  it("disables Sync Now when bucket is empty", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sync now/i })).toBeDisabled();
    });
  });

  it("disables Save when nothing has changed", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });
  });

  it("enables Save after editing a field", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Pocket API Key")).toBeInTheDocument();
    });
    const bucketInput = screen.getByLabelText("Bucket");
    await user.type(bucketInput, "my-bucket");
    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
  });

  it("calls PUT /api/settings on save", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // First call: initial load. Second call: save.
    fetchSpy
      .mockResolvedValueOnce({ ok: true, json: async () => mockSettings } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSettings, s3Bucket: "new" }),
      } as Response);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Pocket API Key")).toBeInTheDocument();
    });
    const bucketInput = screen.getByLabelText("Bucket");
    await user.type(bucketInput, "new");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3001/api/settings",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("does not send masked API key when only other fields change", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce({ ok: true, json: async () => mockSettings } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSettings, s3Bucket: "test-bucket" }),
      } as Response);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Pocket API Key")).toBeInTheDocument();
    });
    const bucketInput = screen.getByLabelText("Bucket");
    await user.type(bucketInput, "test-bucket");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find(
        (c) => c[1] && (c[1] as RequestInit).method === "PUT",
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string);
      expect(body).not.toHaveProperty("pocketApiKey");
      expect(body).toHaveProperty("s3Bucket", "test-bucket");
    });
  });

  it("toggles API key visibility", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Pocket API Key")).toBeInTheDocument();
    });
    // Should start hidden
    const input = screen.getByPlaceholderText("pk_your_api_key_here");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show api key/i }));
    expect(input).toHaveAttribute("type", "text");
  });
});
