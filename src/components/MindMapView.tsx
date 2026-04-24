import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MindMapData } from "@/types/recording";

const NODE_COLORS: Record<string, { bg: string; border: string }> = {
  topic: { bg: "#3b82f6", border: "#2563eb" },
  subtopic: { bg: "#6366f1", border: "#4f46e5" },
  decision: { bg: "#10b981", border: "#059669" },
  action: { bg: "#f59e0b", border: "#d97706" },
  question: { bg: "#ef4444", border: "#dc2626" },
};

function layoutNodes(data: MindMapData): { nodes: Node[]; edges: Edge[] } {
  // Build adjacency from edges to determine tree structure
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const edge of data.edges) {
    const list = children.get(edge.source) || [];
    list.push(edge.target);
    children.set(edge.source, list);
    hasParent.add(edge.target);
  }

  // Find root(s) — nodes with no parent
  const roots = data.nodes
    .map((n) => n.id)
    .filter((id) => !hasParent.has(id));
  const root = roots[0] || data.nodes[0]?.id;

  // BFS to assign positions
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number; index: number; siblings: number }> = [];

  if (root) {
    queue.push({ id: root, depth: 0, index: 0, siblings: 1 });
  }

  const depthCounts = new Map<number, number>();

  // First pass: count nodes at each depth
  const bfsOrder: Array<{ id: string; depth: number }> = [];
  const tempQueue = [...queue];
  const tempVisited = new Set<string>();

  while (tempQueue.length > 0) {
    const item = tempQueue.shift()!;
    if (tempVisited.has(item.id)) continue;
    tempVisited.add(item.id);
    bfsOrder.push({ id: item.id, depth: item.depth });
    depthCounts.set(item.depth, (depthCounts.get(item.depth) || 0) + 1);
    const kids = children.get(item.id) || [];
    for (const kid of kids) {
      if (!tempVisited.has(kid)) {
        tempQueue.push({ id: kid, depth: item.depth + 1, index: 0, siblings: 1 });
      }
    }
  }

  // Second pass: assign positions
  const depthIndices = new Map<number, number>();
  const X_GAP = 280;
  const Y_GAP = 100;

  for (const { id, depth } of bfsOrder) {
    if (visited.has(id)) continue;
    visited.add(id);
    const count = depthCounts.get(depth) || 1;
    const idx = depthIndices.get(depth) || 0;
    depthIndices.set(depth, idx + 1);

    const totalHeight = (count - 1) * Y_GAP;
    const y = -totalHeight / 2 + idx * Y_GAP;
    positions.set(id, { x: depth * X_GAP, y });
  }

  // Any unpositioned nodes (disconnected)
  let fallbackY = 300;
  for (const node of data.nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: 0, y: fallbackY });
      fallbackY += Y_GAP;
    }
  }

  const nodes: Node[] = data.nodes.map((n) => {
    const pos = positions.get(n.id) || { x: 0, y: 0 };
    const colors = NODE_COLORS[n.type || "topic"] || NODE_COLORS.topic;
    return {
      id: n.id,
      position: pos,
      data: { label: n.label },
      style: {
        background: colors.bg,
        color: "#fff",
        border: `2px solid ${colors.border}`,
        borderRadius: "8px",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 500,
        minWidth: "120px",
        textAlign: "center" as const,
      },
    };
  });

  const edges: Edge[] = data.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
    labelStyle: { fontSize: 11, fill: "#64748b" },
  }));

  return { nodes, edges };
}

interface MindMapViewProps {
  data: MindMapData;
  title: string;
}

export function MindMapView({ data, title }: MindMapViewProps) {
  const layout = useMemo(() => layoutNodes(data), [data]);
  const [nodes, , onNodesChange] = useNodesState(layout.nodes);
  const [edges, , onEdgesChange] = useEdgesState(layout.edges);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
  }, []);

  if (!data.nodes.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No mind map data available
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="px-4 py-2 border-b bg-background">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex gap-3 mt-1">
          {Object.entries(NODE_COLORS).map(([type, colors]) => (
            <span key={type} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span
                className="inline-block w-3 h-3 rounded"
                style={{ background: colors.bg }}
              />
              {type}
            </span>
          ))}
        </div>
      </div>
      <div className="h-[calc(100%-60px)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={onInit}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => (node.style?.background as string) || "#3b82f6"}
            maskColor="rgba(0,0,0,0.1)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
