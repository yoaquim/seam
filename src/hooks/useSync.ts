import { useState, useEffect, useRef, useCallback } from "react";

export type SyncStatus = "idle" | "running" | "done" | "error" | "stopped";

export interface SyncState {
  status: SyncStatus;
  startedAt: string | null;
  finishedAt: string | null;
  lastSyncedAt: string | null;
  logs: string[];
  error: string | null;
}

const API = "http://localhost:3001";

export function useSync() {
  const [state, setState] = useState<SyncState>({
    status: "idle",
    startedAt: null,
    finishedAt: null,
    lastSyncedAt: null,
    logs: [],
    error: null,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API}/api/sync/stream`);
    eventSourceRef.current = es;

    es.addEventListener("state", (e) => {
      const data = JSON.parse(e.data) as SyncState;
      setState(data);
    });

    es.addEventListener("log", (e) => {
      const { line } = JSON.parse(e.data);
      setState((prev) => ({ ...prev, logs: [...prev.logs, line] }));
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setState((prev) => ({ ...prev, ...data }));
    });

    es.onerror = () => {};

    return () => es.close();
  }, []);

  const startSync = useCallback(async () => {
    if (state.status === "running") return;
    try {
      await fetch(`${API}/api/sync`, { method: "POST" });
    } catch (e) {
      console.error("Failed to start sync:", e);
    }
  }, [state.status]);

  const stopSync = useCallback(async () => {
    if (state.status !== "running") return;
    try {
      await fetch(`${API}/api/sync`, { method: "DELETE" });
    } catch (e) {
      console.error("Failed to stop sync:", e);
    }
  }, [state.status]);

  return { ...state, startSync, stopSync };
}
