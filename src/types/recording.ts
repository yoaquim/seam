export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface RecordingData {
  id: string;
  title: string;
  description: string;
  duration: number | null;
  language: string | null;
  created_at: string;
  tags: Array<{ name: string } | string>;
  transcript: TranscriptSegment[];
  summary: {
    summary?: {
      title?: string;
      emoji?: string;
      markdown?: string;
      bulletPoints?: string[];
    };
    action_items?: {
      actionItems?: ActionItemRaw[];
    };
    mind_map?: MindMapData;
    processing_status?: string;
    created_at?: string;
  };
}

export interface ActionItemRaw {
  id: string;
  title: string;
  dueDate?: string;
  status?: string;
  isCompleted?: boolean;
  is_completed?: boolean;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export interface MindMapNode {
  id: string;
  label: string;
  type?: string;
}

export interface MindMapEdge {
  source: string;
  target: string;
  label?: string | null;
}

export interface AnalysisData {
  recording_id: string;
  title: string;
  date: string;
  duration_seconds: number | null;
  type: string;
  participants: string[];
  executive_summary: string;
  takeaways: string[];
  decisions: Array<{
    decision: string;
    by: string;
    rationale: string;
  }>;
  action_items: Array<{
    task: string;
    owner: string | null;
    due: string | null;
    completed: boolean;
  }>;
  open_questions: string[];
  key_quotes: Array<{
    text: string;
    speaker: string;
    timestamp_seconds: number | null;
  }>;
  topics: Array<{
    name: string;
    duration_minutes: number | null;
    description: string;
  }>;
  mind_map: MindMapData;
  sentiment: string;
  tags_suggested: string[];
  /** Maps segment index (as string) to inferred speaker name */
  speaker_map?: Record<string, string>;
}

export interface Recording {
  dirName: string;
  data: RecordingData;
  analysis: AnalysisData | null;
  markdown: string;
  analysisMarkdown: string | null;
}
