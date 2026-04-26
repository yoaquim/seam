import { useState, useEffect, useRef } from "react";
import { useSync } from "@/hooks/useSync";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Terminal,
  Disc,
  Clock,
  Copy,
  Check,
} from "lucide-react";

const API = "http://localhost:3001";

interface SyncHistoryEntry {
  id: string;
  status: "done" | "error";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  recordingsPulled: number;
  error: string | null;
  logs: string[];
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatDate(iso: string): string {
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

function LogViewer({ logs }: { logs: string[] }) {
  return (
    <div className="rounded-md border bg-[#1e1e1e] p-3 mt-2 max-h-64 overflow-y-auto">
      <pre className="text-xs font-mono text-[#d4d4d4] whitespace-pre-wrap">
        {logs.map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith("[stderr]")
                ? "text-red-400"
                : line.includes("===")
                  ? "text-[#569cd6] font-bold"
                  : line.includes("ERROR")
                    ? "text-red-400"
                    : line.includes("Done") ||
                        line.includes("completed") ||
                        line.includes("successfully")
                      ? "text-green-400"
                      : ""
            }
          >
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}

function LiveSync({ sync }: { sync: ReturnType<typeof useSync> }) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sync.logs.length]);

  if (sync.status === "idle" && sync.logs.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-300">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Disc className="h-4 w-4 text-amber-500 animate-pulse" />
            <span className="text-sm font-semibold">Live</span>
            <Badge
              variant="secondary"
              className={
                sync.status === "running"
                  ? "bg-amber-100 text-amber-800"
                  : sync.status === "done"
                    ? "bg-green-100 text-green-800"
                    : sync.status === "error"
                      ? "bg-red-100 text-red-800"
                      : ""
              }
            >
              {sync.status}
            </Badge>
          </div>
          {sync.startedAt && (
            <span className="text-xs text-muted-foreground">
              Started {formatDate(sync.startedAt)}
              {sync.finishedAt &&
                ` — ${formatDuration(
                  new Date(sync.finishedAt).getTime() - new Date(sync.startedAt).getTime(),
                )}`}
            </span>
          )}
        </div>

        <div className="rounded-md border bg-[#1e1e1e] p-3 max-h-80 overflow-y-auto">
          <pre className="text-xs font-mono text-[#d4d4d4] whitespace-pre-wrap">
            {sync.logs.length === 0 ? (
              <span className="text-[#737373]">Waiting for output...</span>
            ) : (
              sync.logs.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith("[stderr]")
                      ? "text-red-400"
                      : line.includes("===")
                        ? "text-[#569cd6] font-bold"
                        : line.includes("ERROR")
                          ? "text-red-400"
                          : line.includes("Done") ||
                              line.includes("completed") ||
                              line.includes("successfully")
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
        </div>

        {sync.error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-md p-3 mt-3 border border-red-200">
            {sync.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryEntry({ entry }: { entry: SyncHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const isError = entry.status === "error";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={isError ? "border-red-200" : ""}>
        <CollapsibleTrigger className="w-full cursor-pointer">
          <CardContent className="p-4 flex items-center gap-4">
            {isError ? (
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            )}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formatDate(entry.startedAt)}</span>
                <Badge variant="secondary" className="text-xs">
                  {formatDuration(entry.durationMs)}
                </Badge>
                {entry.recordingsPulled > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {entry.recordingsPulled} recording{entry.recordingsPulled !== 1 ? "s" : ""}{" "}
                    pulled
                  </span>
                )}
              </div>
              {isError && entry.error && (
                <p className="text-xs text-red-500 mt-0.5">{entry.error}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              <Terminal className="h-3 w-3" />
              {entry.logs.length} lines
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <LogViewer logs={entry.logs} />
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CopyCommand({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-[#1e1e1e] text-[#d4d4d4] p-2 rounded font-mono overflow-x-auto">
          {command}
        </code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer p-1"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function AutoSyncSetup() {
  const [open, setOpen] = useState(false);
  const projectPath =
    window.location.hostname === "localhost" ? "~/Projects/seam" : "/path/to/seam";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full cursor-pointer">
        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Clock className="h-4 w-4" />
          <span>Set up automatic sync</span>
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-3">
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Copy one of these commands to set up automatic nightly sync. The sync pulls new
              recordings, analyzes them with Claude, and rebuilds the dashboard.
            </p>

            <CopyCommand
              label="macOS (crontab) — runs at 2am daily"
              command={`(crontab -l 2>/dev/null; echo "0 2 * * * cd ${projectPath} && ./scripts/pocket-run.sh >> .seam/seam.log 2>&1") | crontab -`}
            />

            <CopyCommand
              label="Linux (crontab) — runs at 2am daily"
              command={`(crontab -l 2>/dev/null; echo "0 2 * * * cd ${projectPath} && ./scripts/pocket-run.sh >> .seam/seam.log 2>&1") | crontab -`}
            />

            <CopyCommand
              label="macOS (launchd) — runs at 2am, catches up on wake"
              command={`cat > ~/Library/LaunchAgents/com.seam.sync.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.seam.sync</string>
  <key>ProgramArguments</key><array><string>${projectPath}/scripts/pocket-run.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>
  <key>WorkingDirectory</key><string>${projectPath}</string>
  <key>StandardOutPath</key><string>${projectPath}/.seam/seam.log</string>
  <key>StandardErrorPath</key><string>${projectPath}/.seam/seam.log</string>
</dict></plist>
EOF
launchctl load ~/Library/LaunchAgents/com.seam.sync.plist`}
            />

            <p className="text-xs text-muted-foreground">
              On macOS, launchd runs missed jobs when the machine wakes from sleep.
            </p>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SyncPage() {
  const sync = useSync();
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = () => {
    fetch(`${API}/api/sync/history`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(data.entries || []);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Refresh history when a sync completes
  useEffect(() => {
    if (sync.status === "done" || sync.status === "error") {
      fetchHistory();
    }
  }, [sync.status]);

  const successCount = history.filter((e) => e.status === "done").length;
  const errorCount = history.filter((e) => e.status === "error").length;
  const avgDuration =
    history.length > 0
      ? Math.round(history.reduce((s, e) => s + e.durationMs, 0) / history.length / 1000)
      : 0;

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync
            </h1>
            <p className="text-xs text-muted-foreground">
              {sync.lastSyncedAt ? `Last synced ${formatDate(sync.lastSyncedAt)}` : "Never synced"}
            </p>
          </div>
          <div className="flex gap-2">
            {sync.status === "running" ? (
              <Button
                onClick={sync.stopSync}
                size="sm"
                className="gap-2 bg-red-600 hover:bg-red-700 text-white"
              >
                <XCircle className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={sync.startSync} size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Start Sync
              </Button>
            )}
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Syncs", value: history.length },
            { label: "Successful", value: successCount },
            { label: "Failed", value: errorCount },
            { label: "Avg Duration", value: `${avgDuration}s` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-[#2b2b2b] p-3 text-center">
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-[#a3a3a3]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Live sync */}
        {(sync.status === "running" || (sync.logs.length > 0 && sync.status !== "idle")) && (
          <LiveSync sync={sync} />
        )}

        {/* Automatic sync setup */}
        <AutoSyncSetup />

        {/* History */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            History ({history.length})
          </h2>
          {loadingHistory ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No sync history yet. Start a sync above.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => (
                <HistoryEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
