import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

function installMatchMedia(matches: boolean) {
  const mql = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => true,
    onchange: null,
  };
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => mql });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  installMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  it("cycles through light → dark → system on click", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button", { name: /theme/i });

    // Default is "system" (no localStorage). First click → light.
    await user.click(button);
    expect(localStorage.getItem("seam-theme")).toBe("light");

    // Second click → dark.
    await user.click(button);
    expect(localStorage.getItem("seam-theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");

    // Third click → back to system.
    await user.click(button);
    expect(localStorage.getItem("seam-theme")).toBe("system");
  });

  it("has an accessible name reflecting the current theme", () => {
    localStorage.setItem("seam-theme", "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button", { name: /theme/i });
    expect(button).toHaveAttribute("aria-label", expect.stringMatching(/dark/i));
  });
});
