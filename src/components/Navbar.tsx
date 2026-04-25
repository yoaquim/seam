import { useNavigate, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { useSync } from "@/hooks/useSync";
import { Users, RefreshCw } from "lucide-react";

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const sync = useSync();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 shrink-0">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-baseline gap-2 cursor-pointer">
          <img src="/logo.svg" alt="Seam" className="h-6 w-auto self-center" />
          <span className="text-lg font-bold tracking-tight">Seam</span>
          <span className="text-xs text-muted-foreground">Pocket AI Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant={isActive("/people") ? "default" : "outline"}
            size="sm"
            onClick={() => navigate("/people")}
            className="gap-1.5"
          >
            <Users className="h-4 w-4" />
            People
          </Button>
          <Button
            variant={isActive("/sync") ? "default" : "outline"}
            size="sm"
            onClick={() => navigate("/sync")}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${sync.status === "running" ? "animate-spin" : ""}`} />
            Sync
            {sync.status === "running" && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
