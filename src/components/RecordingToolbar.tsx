import { Badge } from "@/components/ui/badge";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  Clock,
  Tag,
  Filter,
} from "lucide-react";
import { tagClassName } from "@/lib/tag-colors";
import type { Recording } from "@/types/recording";

export type SortField = "date" | "duration" | "title";
export type SortDir = "asc" | "desc";

interface RecordingToolbarProps {
  recordings: Recording[];
  sortField: SortField;
  sortDir: SortDir;
  filterType: string;
  filterTag: string;
  onSortFieldChange: (field: SortField) => void;
  onSortDirToggle: () => void;
  onFilterTypeChange: (type: string) => void;
  onFilterTagChange: (tag: string) => void;
}

export function RecordingToolbar({
  recordings,
  sortField,
  sortDir,
  filterType,
  filterTag,
  onSortFieldChange,
  onSortDirToggle,
  onFilterTypeChange,
  onFilterTagChange,
}: RecordingToolbarProps) {
  // Collect unique types and tags
  const types = [...new Set(
    recordings
      .map((r) => r.analysis?.type)
      .filter(Boolean) as string[]
  )].sort();

  const tags = [...new Set(
    recordings.flatMap((r) =>
      (r.data.tags || []).map((t) => (typeof t === "string" ? t : t.name))
    )
  )].sort();

  const SortIcon = sortDir === "asc" ? ArrowUpAZ : ArrowDownAZ;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Sort controls */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground text-xs">Sort:</span>
        {(["date", "duration", "title"] as SortField[]).map((field) => {
          const icons: Record<SortField, typeof Calendar> = {
            date: Calendar,
            duration: Clock,
            title: ArrowDownAZ,
          };
          const Icon = icons[field];
          const active = sortField === field;
          return (
            <button
              key={field}
              onClick={() => {
                if (active) {
                  onSortDirToggle();
                } else {
                  onSortFieldChange(field);
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors cursor-pointer ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {field}
              {active && <SortIcon className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-border" />

      {/* Type filter */}
      {types.length > 0 && (
        <div className="flex items-center gap-1.5 text-sm">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <button
            onClick={() => onFilterTypeChange("")}
            className={`px-2 py-1 rounded text-xs border transition-colors cursor-pointer ${
              filterType === ""
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground"
            }`}
          >
            All
          </button>
          {types.map((type) => (
            <button
              key={type}
              onClick={() => onFilterTypeChange(filterType === type ? "" : type)}
              className={`px-2 py-1 rounded text-xs border transition-colors cursor-pointer ${
                filterType === type
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Tag filter */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 text-sm">
          <Tag className="h-3 w-3 text-muted-foreground" />
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant={filterTag === tag ? "default" : "secondary"}
              className={`cursor-pointer text-xs ${filterTag === tag ? "" : tagClassName(tag)}`}
              onClick={() => onFilterTagChange(filterTag === tag ? "" : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Sort + filter logic, reusable
export function sortAndFilter(
  recordings: Recording[],
  sortField: SortField,
  sortDir: SortDir,
  filterType: string,
  filterTag: string,
): Recording[] {
  let result = [...recordings];

  // Filter by type
  if (filterType) {
    result = result.filter((r) => r.analysis?.type === filterType);
  }

  // Filter by tag
  if (filterTag) {
    result = result.filter((r) =>
      (r.data.tags || []).some((t) =>
        (typeof t === "string" ? t : t.name) === filterTag
      )
    );
  }

  // Sort
  result.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "date":
        cmp = getRecordingDate(a).localeCompare(getRecordingDate(b));
        break;
      case "duration":
        cmp = (a.data.duration || 0) - (b.data.duration || 0);
        break;
      case "title":
        cmp = (a.data.title || "").localeCompare(b.data.title || "");
        break;
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  return result;
}

/** Extract local date from recording — prefers recording_at (when recorded) over created_at (when processed) */
export function getRecordingDate(r: Recording): string {
  const ts = r.data.recording_at || r.data.created_at;
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
    }
  }
  return r.dirName.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
    || "Unknown date";
}

// Group recordings by date for the timeline
export function groupByDate(recordings: Recording[]): Map<string, Recording[]> {
  const groups = new Map<string, Recording[]>();
  for (const r of recordings) {
    const date = getRecordingDate(r);
    const list = groups.get(date) || [];
    list.push(r);
    groups.set(date, list);
  }
  return groups;
}
