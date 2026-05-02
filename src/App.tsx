import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useRecordings } from "@/hooks/useRecordings";
import { useSettings } from "@/hooks/useSettings";
import { RecordingGridCard } from "@/components/RecordingGridCard";
import { SearchBar } from "@/components/SearchBar";
import {
  RecordingToolbar,
  sortAndFilter,
  groupByDate,
  type SortField,
  type SortDir,
} from "@/components/RecordingToolbar";
import { Loader2, AlertCircle } from "lucide-react";

function formatDateHeading(dateStr: string): string {
  if (dateStr === "Unknown") return dateStr;
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

  if (dateOnly(date) === dateOnly(today)) return "Today";
  if (dateOnly(date) === dateOnly(yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export default function App() {
  const { recordings, loading, error } = useRecordings();
  const { settings, loading: settingsLoading } = useSettings();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterType, setFilterType] = useState("");
  const [filterTag, setFilterTag] = useState("");

  const filtered = useMemo(() => {
    let result = recordings;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const searchable = [
          r.data.title,
          r.data.description,
          r.analysis?.executive_summary || "",
          ...(r.analysis?.takeaways || []),
          ...(r.analysis?.open_questions || []),
          ...(r.analysis?.action_items?.map((a) => a.task) || []),
          ...(r.analysis?.decisions?.map((d) => d.decision) || []),
          ...(r.analysis?.key_quotes?.map((kq) => kq.text) || []),
          ...(r.data.transcript?.map((s) => s.text) || []),
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
    }

    return sortAndFilter(result, sortField, sortDir, filterType, filterTag);
  }, [recordings, search, sortField, sortDir, filterType, filterTag]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            Run <code>python3 scripts/build-manifest.py</code> to generate the dashboard data.
          </p>
        </div>
      </div>
    );
  }

  const stats = {
    totalRecordings: recordings.length,
    totalDuration: recordings.reduce((s, r) => s + (r.data.duration || 0), 0),
    totalActions: recordings.reduce((s, r) => s + (r.analysis?.action_items?.length || 0), 0),
    openQuestions: recordings.reduce((s, r) => s + (r.analysis?.open_questions?.length || 0), 0),
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <main className="flex-1 overflow-hidden flex flex-col max-w-6xl mx-auto px-6 py-6 w-full">
        {/* First-run banner */}
        {!settingsLoading && settings && !settings.configured && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-amber-200">Configure your Pocket API key to get started.</p>
            <button
              onClick={() => navigate("/settings")}
              className="text-sm font-medium text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
            >
              Open Settings &rarr;
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Recordings", value: stats.totalRecordings },
            { label: "Total Time", value: `${Math.round(stats.totalDuration / 60)}m` },
            { label: "Action Items", value: stats.totalActions },
            { label: "Open Questions", value: stats.openQuestions },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border bg-primary p-4 text-center text-primary-foreground"
            >
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs opacity-70">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Search + Toolbar */}
        <div className="space-y-4 mb-6">
          <SearchBar value={search} onChange={setSearch} />
          <RecordingToolbar
            recordings={recordings}
            sortField={sortField}
            sortDir={sortDir}
            filterType={filterType}
            filterTag={filterTag}
            onSortFieldChange={(f) => {
              setSortField(f);
              setSortDir("desc");
            }}
            onSortDirToggle={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            onFilterTypeChange={setFilterType}
            onFilterTagChange={setFilterTag}
          />
        </div>

        {/* Grid — scrollable */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search || filterType || filterTag
                ? "No recordings match your filters."
                : "No recordings yet. Run a sync to get started."}
            </div>
          ) : (
            <div className="space-y-8">
              {[...grouped.entries()].map(([date, recs]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {formatDateHeading(date)}
                    </h3>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {recs.length} recording{recs.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recs.map((recording) => (
                      <RecordingGridCard
                        key={recording.dirName}
                        recording={recording}
                        onDelete={async (dirName) => {
                          await fetch(`/api/recordings/${dirName}`, {
                            method: "DELETE",
                          });
                          window.location.reload();
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
