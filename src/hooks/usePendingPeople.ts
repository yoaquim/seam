import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:3001";

export interface PendingPerson {
  id: string;
  name: string;
  seenIn: string[];
  count: number;
  suggestedMatch: string | null;
  createdAt: string;
}

export function usePendingPeople() {
  const [pending, setPending] = useState<PendingPerson[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch(`${API}/api/people/pending`)
      .then((r) => r.json())
      .then((data) => {
        setPending(data.pending || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const confirm = useCallback(async (id: string) => {
    const res = await fetch(`${API}/api/people/pending/${id}/confirm`, { method: "POST" });
    if (res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== id));
      return await res.json();
    }
    return null;
  }, []);

  const merge = useCallback(async (id: string, targetPersonId: string) => {
    const res = await fetch(`${API}/api/people/pending/${id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPersonId }),
    });
    if (res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== id));
      return await res.json();
    }
    return null;
  }, []);

  const dismiss = useCallback(async (id: string) => {
    const res = await fetch(`${API}/api/people/pending/${id}/dismiss`, { method: "POST" });
    if (res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== id));
    }
  }, []);

  return { pending, loading, confirm, merge, dismiss, refresh };
}
