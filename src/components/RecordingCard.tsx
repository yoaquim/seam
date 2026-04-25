import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  MessageSquare,
  Users,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { Recording, TranscriptSegment } from "@/types/recording";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${s}s`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TranscriptView({ segments }: { segments: TranscriptSegment[] }) {
  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        const showSpeaker = i === 0 || seg.speaker !== segments[i - 1].speaker;
        return (
          <div key={i}>
            {showSpeaker && (
              <div className="flex items-center gap-2 mt-2 mb-1">
                <span className="text-xs font-semibold text-foreground">{seg.speaker}</span>
                <span className="text-xs text-muted-foreground">{formatTimestamp(seg.start)}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed pl-2 border-l-2 border-muted">
              {seg.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    meeting: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    brainstorm: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    interview: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    lecture: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    conversation: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  };
  return colors[type] || colors.conversation;
}

interface RecordingCardProps {
  recording: Recording;
  onOpenMindMap: (recording: Recording) => void;
}

export function RecordingCard({ recording, onOpenMindMap }: RecordingCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, analysis } = recording;
  const date = data.created_at?.slice(0, 10) || "Unknown";
  const tags = (data.tags || []).map((t) => (typeof t === "string" ? t : t.name));

  return (
    <Card className="transition-shadow hover:shadow-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger render={<CardHeader />} className="cursor-pointer select-none">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                {data.title}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-3 flex-wrap">
                <span>{date}</span>
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
              </CardDescription>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              {analysis?.type && (
                <Badge variant="secondary" className={getTypeColor(analysis.type)}>
                  {analysis.type}
                </Badge>
              )}
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Executive Summary */}
            {analysis?.executive_summary && (
              <div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {analysis.executive_summary}
                </p>
              </div>
            )}

            {/* Key Takeaways */}
            {analysis?.takeaways && analysis.takeaways.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Key Takeaways</h4>
                <ul className="space-y-1">
                  {analysis.takeaways.map((t, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Action Items */}
              {analysis?.action_items && analysis.action_items.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Action Items
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.action_items.map((item, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        {item.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <span>
                          {item.task}
                          {item.owner && (
                            <span className="text-muted-foreground"> — {item.owner}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Decisions */}
              {analysis?.decisions && analysis.decisions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Decisions</h4>
                  <ul className="space-y-2">
                    {analysis.decisions.map((d, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{d.decision}</span>
                        <span className="text-muted-foreground"> — {d.by}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Open Questions */}
            {analysis?.open_questions && analysis.open_questions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  Open Questions
                </h4>
                <ul className="space-y-1">
                  {analysis.open_questions.map((q, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5">?</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Quotes */}
            {analysis?.key_quotes && analysis.key_quotes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Key Quotes
                </h4>
                <div className="space-y-2">
                  {analysis.key_quotes.map((q, i) => (
                    <blockquote
                      key={i}
                      className="text-sm border-l-2 border-muted pl-3 italic text-muted-foreground"
                    >
                      "{q.text}"
                      <span className="not-italic block text-xs mt-0.5">— {q.speaker}</span>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* Links row */}
            <div className="flex items-center gap-4">
              {/* Transcript Dialog */}
              {data.transcript && data.transcript.length > 0 && (
                <Dialog>
                  <DialogTrigger
                    render={
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-primary hover:underline cursor-pointer flex items-center gap-1.5"
                      />
                    }
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View Transcript ({data.transcript.length} segments)
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>{data.title} — Transcript</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] pr-4">
                      <TranscriptView segments={data.transcript} />
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              )}

              {/* Mind Map Button */}
              {analysis?.mind_map?.nodes && analysis.mind_map.nodes.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMindMap(recording);
                  }}
                  className="text-sm text-primary hover:underline cursor-pointer"
                >
                  View Mind Map →
                </button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
