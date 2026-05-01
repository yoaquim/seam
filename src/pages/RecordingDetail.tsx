import { useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { useRecordings } from "@/hooks/useRecordings";
import { usePeople } from "@/hooks/usePeople";
import { MindMapView } from "@/components/MindMapView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Clock,
  Users,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  MessageSquare,
  Loader2,
  FileText,
  GitBranch,
  Lightbulb,
  ListChecks,
  Copy,
  Check,
} from "lucide-react";
import { tagClassName } from "@/lib/tag-colors";
import type { TranscriptSegment } from "@/types/recording";

const TABS = [
  { id: "summary", label: "Summary", icon: Lightbulb, color: "bg-emerald-500" },
  { id: "actions", label: "Actions", icon: ListChecks, color: "bg-amber-500" },
  { id: "transcript", label: "Transcript", icon: FileText, color: "bg-blue-500" },
  { id: "mindmap", label: "Mind Map", icon: GitBranch, color: "bg-purple-500" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ${s}s`;
  }
  return `${m}m ${s}s`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  speakerMap?: Record<string, string>;
  people?: string[];
  onAssignSpeaker?: (segmentIndex: number, speaker: string) => void;
}

function TranscriptView({ segments, speakerMap, people, onAssignSpeaker }: TranscriptViewProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      {segments.map((seg, i) => {
        // Apply speaker_map override
        const speaker = speakerMap?.[String(i)] || seg.speaker || "Unknown";
        const prevSpeaker =
          i > 0 ? speakerMap?.[String(i - 1)] || segments[i - 1].speaker || "Unknown" : null;
        const showSpeaker = speaker !== prevSpeaker;
        const isUnknown = speaker === "Unknown";

        return (
          <div key={i}>
            {showSpeaker && (
              <div className="flex items-center gap-2 mt-3 mb-1">
                {editingIdx === i ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    {(people || []).map((name) => (
                      <button
                        key={name}
                        onClick={() => {
                          onAssignSpeaker?.(i, name);
                          setEditingIdx(null);
                        }}
                        className="text-xs px-2 py-0.5 rounded border border-border hover:bg-foreground hover:text-background transition-colors cursor-pointer"
                      >
                        {name}
                      </button>
                    ))}
                    <button
                      onClick={() => setEditingIdx(null)}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer ml-1"
                    >
                      cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className={`text-sm font-semibold ${isUnknown ? "text-muted-foreground italic" : ""}`}
                    >
                      {speaker}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(seg.start)}
                    </span>
                    {onAssignSpeaker && (
                      <button
                        onClick={() => setEditingIdx(i)}
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Assign speaker"
                      >
                        [edit]
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed pl-3 border-l-2 border-muted">
              {seg.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1"
      title={label || "Copy to clipboard"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CopySectionButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1 ml-auto"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

export function RecordingDetail() {
  const { dirName } = useParams<{ dirName: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { recordings, loading } = useRecordings();
  const { people } = usePeople();
  const peopleNames = useMemo(() => people.map((p) => p.name), [people]);

  const recording = useMemo(
    () => recordings.find((r) => r.dirName === dirName),
    [recordings, dirName],
  );

  const activeTab = (searchParams.get("tab") as TabId) || "summary";

  const setTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Recording not found.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${recording.data.title}"? This cannot be undone.`)) return;
    try {
      await fetch(`http://localhost:3001/api/recordings/${dirName}`, { method: "DELETE" });
      navigate("/");
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const { data, analysis } = recording;
  // Prefer recording_at (when recorded) over created_at (when processed)
  const recordedTs = data.recording_at || data.created_at;
  const date = recordedTs
    ? new Date(recordedTs).toLocaleDateString("en-CA")
    : dirName?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null;
  const processedDate =
    data.recording_at && data.created_at
      ? new Date(data.created_at).toLocaleDateString("en-CA")
      : null;
  const tags = (data.tags || []).map((t) => (typeof t === "string" ? t : t.name));

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Recording info + tabs — sticky */}
      <div className="shrink-0 max-w-5xl w-full mx-auto px-6 pt-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{data.title}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
              {date && <span>{date}</span>}
              {processedDate && processedDate !== date && (
                <span className="text-muted-foreground/60">processed {processedDate}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(data.duration)}
              </span>
              {analysis?.participants && analysis.participants.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {analysis.participants.join(", ")}
                </span>
              )}
              {analysis?.type && (
                <Badge variant="secondary" className="text-xs">
                  {analysis.type}
                </Badge>
              )}
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className={`text-xs ${tagClassName(tag)}`}>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border -mx-6 px-6">
          {TABS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === id
                  ? `${color} text-white rounded-t-md`
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {activeTab === "summary" && <SummaryTab analysis={analysis} />}
          {activeTab === "actions" && <ActionsTab analysis={analysis} dirName={dirName!} />}
          {activeTab === "transcript" && (
            <TranscriptTab
              segments={data.transcript || []}
              speakerMap={analysis?.speaker_map}
              people={peopleNames}
              dirName={dirName!}
            />
          )}
          {activeTab === "mindmap" && <MindMapTab data={analysis?.mind_map} title={data.title} />}
        </div>
      </main>
    </div>
  );
}

function SummaryTab({
  analysis,
}: {
  analysis: ReturnType<() => import("@/types/recording").AnalysisData> | null;
}) {
  if (!analysis) {
    return <EmptyState message="No analysis available. Run a sync to analyze this recording." />;
  }

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <section>
        <p className="text-sm leading-relaxed">{analysis.executive_summary}</p>
        {analysis.sentiment && (
          <Badge variant="outline" className="mt-2">
            Sentiment: {analysis.sentiment}
          </Badge>
        )}
      </section>

      {/* Key Takeaways */}
      {analysis.takeaways.length > 0 && (
        <section>
          <SectionTitle>Key Takeaways</SectionTitle>
          <ul className="space-y-2">
            {analysis.takeaways.map((t, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 font-bold">•</span>
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Topics */}
      {analysis.topics.length > 0 && (
        <section>
          <SectionTitle>Topics Discussed</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.topics.map((topic, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{topic.name}</span>
                    {topic.duration_minutes && (
                      <span className="text-xs text-muted-foreground">
                        ~{topic.duration_minutes}m
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{topic.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Key Quotes */}
      {analysis.key_quotes.length > 0 && (
        <section>
          <SectionTitle icon={<MessageSquare className="h-4 w-4" />}>Key Quotes</SectionTitle>
          <div className="space-y-3">
            {analysis.key_quotes.map((q, i) => (
              <div key={i} className="flex items-start gap-2">
                <blockquote className="text-sm border-l-2 border-emerald-300 pl-4 italic text-muted-foreground flex-1">
                  "{q.text}"
                  <span className="not-italic block text-xs mt-1 font-medium">
                    — {q.speaker}
                    {q.timestamp_seconds != null && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        at {formatTimestamp(q.timestamp_seconds)}
                      </span>
                    )}
                  </span>
                </blockquote>
                <CopyButton text={`"${q.text}" — ${q.speaker}`} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface ActionsTabProps {
  analysis: import("@/types/recording").AnalysisData | null;
  dirName: string;
}

function ActionsTab({ analysis, dirName }: ActionsTabProps) {
  // Initialize from analysis
  const [actionStates, setActionStates] = useState<boolean[]>(
    () => analysis?.action_items?.map((a) => a.completed) ?? [],
  );

  if (!analysis) {
    return <EmptyState message="No analysis available." />;
  }

  const hasActions = analysis.action_items.length > 0;
  const hasDecisions = analysis.decisions.length > 0;
  const hasQuestions = analysis.open_questions.length > 0;

  if (!hasActions && !hasDecisions && !hasQuestions) {
    return <EmptyState message="No action items, decisions, or open questions found." />;
  }

  const toggleAction = async (index: number) => {
    const newState = !actionStates[index];
    setActionStates((prev) => {
      const next = [...prev];
      next[index] = newState;
      return next;
    });
    try {
      await fetch(`http://localhost:3001/api/recordings/${dirName}/actions/${index}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: newState }),
      });
    } catch (e) {
      console.error("Failed to save action state:", e);
    }
  };

  // Format for copy
  const allActionsText = analysis.action_items
    .map((item, i) => {
      const check = actionStates[i] ? "x" : " ";
      const owner = item.owner ? ` (@${item.owner})` : "";
      const due = item.due ? ` [due: ${item.due}]` : "";
      return `- [${check}] ${item.task}${owner}${due}`;
    })
    .join("\n");

  const allDecisionsText = analysis.decisions
    .map((d) => `- ${d.decision} (by ${d.by})${d.rationale ? ` — ${d.rationale}` : ""}`)
    .join("\n");

  const allQuestionsText = analysis.open_questions.map((q) => `- ${q}`).join("\n");

  const allText = [
    hasActions ? `Action Items:\n${allActionsText}` : "",
    hasDecisions ? `Decisions:\n${allDecisionsText}` : "",
    hasQuestions ? `Open Questions:\n${allQuestionsText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-8">
      {/* Copy all button */}
      <div className="flex justify-end">
        <CopySectionButton text={allText} label="Copy all" />
      </div>

      {/* Action Items */}
      {hasActions && (
        <section>
          <div className="flex items-center mb-3">
            <SectionTitle icon={<CheckCircle2 className="h-4 w-4" />}>
              Action Items ({analysis.action_items.length})
            </SectionTitle>
            <CopySectionButton text={allActionsText} label="Copy" />
          </div>
          <div className="space-y-2">
            {analysis.action_items.map((item, i) => {
              const done = actionStates[i] ?? item.completed;
              const itemText = `${done ? "[x]" : "[ ]"} ${item.task}${item.owner ? ` (@${item.owner})` : ""}${item.due ? ` [due: ${item.due}]` : ""}`;
              return (
                <Card key={i} className={done ? "opacity-60" : ""}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <button
                      onClick={() => toggleAction(i)}
                      className="shrink-0 mt-0.5 cursor-pointer"
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                        {item.task}
                      </p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {item.owner && <span>Owner: {item.owner}</span>}
                        {item.due && <span>Due: {item.due}</span>}
                      </div>
                    </div>
                    <CopyButton text={itemText} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Decisions */}
      {hasDecisions && (
        <section>
          <div className="flex items-center mb-3">
            <SectionTitle>Decisions ({analysis.decisions.length})</SectionTitle>
            <CopySectionButton text={allDecisionsText} label="Copy" />
          </div>
          <div className="space-y-2">
            {analysis.decisions.map((d, i) => {
              const itemText = `Decision: ${d.decision}\nBy: ${d.by}${d.rationale ? `\nRationale: ${d.rationale}` : ""}`;
              return (
                <Card key={i}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{d.decision}</p>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>By: {d.by}</span>
                        {d.rationale && <span>Why: {d.rationale}</span>}
                      </div>
                    </div>
                    <CopyButton text={itemText} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Open Questions */}
      {hasQuestions && (
        <section>
          <div className="flex items-center mb-3">
            <SectionTitle icon={<AlertCircle className="h-4 w-4" />}>
              Open Questions ({analysis.open_questions.length})
            </SectionTitle>
            <CopySectionButton text={allQuestionsText} label="Copy" />
          </div>
          <div className="space-y-2">
            {analysis.open_questions.map((q, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-start gap-3">
                  <span className="text-amber-500 font-bold shrink-0">?</span>
                  <p className="text-sm flex-1">{q}</p>
                  <CopyButton text={q} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface TranscriptTabProps {
  segments: TranscriptSegment[];
  speakerMap?: Record<string, string>;
  people: string[];
  dirName: string;
}

function TranscriptTab({ segments, speakerMap, people, dirName }: TranscriptTabProps) {
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [localSpeakerMap, setLocalSpeakerMap] = useState<Record<string, string>>(speakerMap || {});
  const [pendingAssign, setPendingAssign] = useState<{
    segmentIndex: number;
    speaker: string;
    originalSpeaker: string;
    allCount: number;
  } | null>(null);

  // Resolve speakers using map
  const resolvedSegments = useMemo(
    () =>
      segments.map((seg, i) => ({
        ...seg,
        speaker: localSpeakerMap[String(i)] || seg.speaker || "Unknown",
      })),
    [segments, localSpeakerMap],
  );

  // Get unique speakers with segment counts
  const speakerStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const seg of resolvedSegments) {
      counts.set(seg.speaker, (counts.get(seg.speaker) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [resolvedSegments]);

  const filtered = speakerFilter
    ? resolvedSegments.filter((s) => s.speaker === speakerFilter)
    : resolvedSegments;

  if (segments.length === 0) {
    return <EmptyState message="No transcript available." />;
  }

  const handleAssignSpeaker = async (segmentIndex: number, speaker: string) => {
    const originalSpeaker =
      localSpeakerMap[String(segmentIndex)] || segments[segmentIndex]?.speaker || "Unknown";

    // Count how many segments have this speaker
    let allCount = 0;
    for (let j = 0; j < segments.length; j++) {
      const currentResolved = localSpeakerMap[String(j)] || segments[j].speaker || "Unknown";
      if (currentResolved === originalSpeaker) allCount++;
    }

    if (allCount <= 1) {
      // Only one segment — just do it
      await applySpeakerAssignment({ [segmentIndex]: speaker });
    } else {
      // Ask user for scope
      setPendingAssign({ segmentIndex, speaker, originalSpeaker, allCount });
    }
  };

  const applySpeakerAssignment = async (assignments: Record<number, string>) => {
    setLocalSpeakerMap((prev) => ({ ...prev, ...assignments }));
    try {
      await fetch(`http://localhost:3001/api/recordings/${dirName}/speakers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
    } catch (e) {
      console.error("Failed to save speaker assignment:", e);
    }
  };

  const confirmAssignAll = async () => {
    if (!pendingAssign) return;
    const { originalSpeaker, speaker } = pendingAssign;
    const assignments: Record<number, string> = {};
    for (let j = 0; j < segments.length; j++) {
      const currentResolved = localSpeakerMap[String(j)] || segments[j].speaker || "Unknown";
      if (currentResolved === originalSpeaker) assignments[j] = speaker;
    }
    await applySpeakerAssignment(assignments);
    setPendingAssign(null);
  };

  const confirmAssignOne = async () => {
    if (!pendingAssign) return;
    await applySpeakerAssignment({ [pendingAssign.segmentIndex]: pendingAssign.speaker });
    setPendingAssign(null);
  };

  return (
    <div>
      {/* Speaker assignment confirmation */}
      {pendingAssign && (
        <div className="mb-4 p-3 rounded-lg border bg-muted/50 space-y-2">
          <p className="text-sm">
            Rename <strong>"{pendingAssign.originalSpeaker}"</strong> to{" "}
            <strong>"{pendingAssign.speaker}"</strong>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmAssignAll}
              className="text-xs px-3 py-1.5 rounded bg-foreground text-background cursor-pointer"
            >
              All {pendingAssign.allCount} segments
            </button>
            <button
              onClick={confirmAssignOne}
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted cursor-pointer"
            >
              Only this block
            </button>
            <button
              onClick={() => setPendingAssign(null)}
              className="text-xs px-3 py-1.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Speaker pills */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-xs text-muted-foreground">Speakers:</span>
        <button
          onClick={() => setSpeakerFilter(null)}
          className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
            speakerFilter === null
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground"
          }`}
        >
          All ({resolvedSegments.length})
        </button>
        {speakerStats.map(([speaker, count]) => (
          <button
            key={speaker}
            onClick={() => setSpeakerFilter(speakerFilter === speaker ? null : speaker)}
            className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
              speakerFilter === speaker
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground"
            }`}
          >
            {speaker} ({count})
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} segment{filtered.length !== 1 ? "s" : ""}
        {speakerFilter && <span> from {speakerFilter}</span>}
      </p>

      <TranscriptView
        segments={filtered}
        speakerMap={localSpeakerMap}
        people={people}
        onAssignSpeaker={handleAssignSpeaker}
      />
    </div>
  );
}

function MindMapTab({
  data,
  title,
}: {
  data: import("@/types/recording").MindMapData | undefined;
  title: string;
}) {
  if (!data?.nodes?.length) {
    return <EmptyState message="No mind map data available." />;
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
      <MindMapView data={data} title={title} />
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
      {icon}
      {children}
    </h3>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-16 text-muted-foreground text-sm">{message}</div>;
}
