import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Trash2 } from "lucide-react";
import type { Recording } from "@/types/recording";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const m = Math.floor(seconds / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m`;
}

const TYPE_COLORS: Record<string, string> = {
  meeting: "bg-blue-500",
  brainstorm: "bg-purple-500",
  interview: "bg-green-500",
  lecture: "bg-orange-500",
  conversation: "bg-gray-500",
  other: "bg-gray-500",
};

const TAB_BUTTONS = [
  { tab: "summary", label: "Summary", color: "bg-emerald-500 hover:bg-emerald-600" },
  { tab: "actions", label: "Actions", color: "bg-amber-500 hover:bg-amber-600" },
  { tab: "transcript", label: "Transcript", color: "bg-blue-500 hover:bg-blue-600" },
  { tab: "mindmap", label: "Mind Map", color: "bg-purple-500 hover:bg-purple-600" },
] as const;

interface RecordingGridCardProps {
  recording: Recording;
  onDelete?: (dirName: string) => void;
}

export function RecordingGridCard({ recording, onDelete }: RecordingGridCardProps) {
  const navigate = useNavigate();
  const { data, analysis } = recording;
  const tags = (data.tags || []).map((t) =>
    typeof t === "string" ? t : t.name
  );
  const type = analysis?.type || "other";
  const typeColor = TYPE_COLORS[type] || TYPE_COLORS.other;
  const actionCount = analysis?.action_items?.length || 0;
  const questionCount = analysis?.open_questions?.length || 0;

  return (
    <Card
      className="transition-all hover:shadow-md cursor-pointer group"
      onClick={() => navigate(`/recording/${recording.dirName}`)}
    >
      <CardHeader className="pb-2">
        {/* Type indicator bar */}
        <div className={`h-1 -mx-6 -mt-6 mb-3 rounded-t-lg ${typeColor}`} />
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight line-clamp-2">
            {data.title}
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="secondary" className="text-xs">
              {type}
            </Badge>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${data.title}"?`)) {
                    onDelete(recording.dirName);
                  }
                }}
                className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer opacity-0 group-hover:opacity-100 p-0.5"
                title="Delete recording"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(data.duration)}
          </span>
          {analysis?.participants && analysis.participants.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {analysis.participants.length}
            </span>
          )}
          {actionCount > 0 && (
            <span>{actionCount} action{actionCount !== 1 ? "s" : ""}</span>
          )}
          {questionCount > 0 && (
            <span>{questionCount} question{questionCount !== 1 ? "s" : ""}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Brief summary */}
        {analysis?.executive_summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {analysis.executive_summary}
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Tab buttons */}
        <div className="flex flex-wrap gap-1.5">
          {TAB_BUTTONS.map(({ tab, label, color }) => {
            // Only show buttons that have content
            const hasContent =
              tab === "summary" ? !!analysis?.executive_summary :
              tab === "actions" ? (actionCount > 0 || questionCount > 0) :
              tab === "transcript" ? (data.transcript?.length || 0) > 0 :
              tab === "mindmap" ? (analysis?.mind_map?.nodes?.length || 0) > 0 :
              false;

            if (!hasContent) return null;

            return (
              <button
                key={tab}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/recording/${recording.dirName}?tab=${tab}`);
                }}
                className={`text-xs text-white px-2 py-0.5 rounded cursor-pointer transition-colors ${color}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
