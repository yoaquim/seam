import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type Theme } from "@/components/ThemeProvider";

const NEXT: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${theme} (click to change)`}
      className="gap-1.5"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
