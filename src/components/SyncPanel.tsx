import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, XCircle, Clock, Terminal } from "lucide-react";
import type { SyncStatus } from "@/hooks/useSync";

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case "running":
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "done":
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Done
        </Badge>
      );
    case "error":
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-800 gap-1">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Idle
        </Badge>
      );
  }
}

interface SyncPanelProps {
  status: SyncStatus;
  startedAt: string | null;
  finishedAt: string | null;
  lastSyncedAt: string | null;
  logs: string[];
  error: string | null;
  onSync: () => void;
}

export function SyncPanel({
  status,
  startedAt,
  finishedAt,
  lastSyncedAt,
  logs,
  error,
  onSync,
}: SyncPanelProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const duration =
    startedAt && finishedAt
      ? `${((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000).toFixed(1)}s`
      : startedAt
        ? "..."
        : null;

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <RefreshCw className={`h-4 w-4 ${status === "running" ? "animate-spin" : ""}`} />
        Sync
        {status === "running" && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Sync
            <StatusBadge status={status} />
          </DialogTitle>
        </DialogHeader>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Last synced</div>
            <div className="font-medium">{formatTime(lastSyncedAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Started</div>
            <div className="font-medium">{startedAt ? formatTime(startedAt) : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Duration</div>
            <div className="font-medium">{duration || "—"}</div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-md p-3 border border-red-200">
            {error}
          </div>
        )}

        <Separator />

        {/* Log output */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Terminal className="h-3 w-3" />
          Logs
          {logs.length > 0 && <span>({logs.length} lines)</span>}
        </div>
        <ScrollArea className="h-64 rounded-md border bg-[#1e1e1e] p-3">
          <pre className="text-xs font-mono text-[#d4d4d4] whitespace-pre-wrap">
            {logs.length === 0 ? (
              <span className="text-[#737373]">No logs yet. Click sync to start.</span>
            ) : (
              logs.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith("[stderr]")
                      ? "text-red-400"
                      : line.includes("===")
                        ? "text-[#569cd6] font-bold"
                        : line.includes("ERROR")
                          ? "text-red-400"
                          : line.includes("Done") || line.includes("completed")
                            ? "text-green-400"
                            : ""
                  }
                >
                  {line}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </pre>
        </ScrollArea>

        {/* Sync button */}
        <div className="flex justify-end">
          <Button onClick={onSync} disabled={status === "running"} size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${status === "running" ? "animate-spin" : ""}`} />
            {status === "running" ? "Syncing..." : "Start Sync"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
