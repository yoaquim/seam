import { useState, useEffect } from "react";
import type { Recording } from "@/types/recording";

interface Manifest {
  recordings: Recording[];
}

export function useRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/manifest.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load manifest: ${r.status}`);
        return r.json() as Promise<Manifest>;
      })
      .then((data) => {
        setRecordings(data.recordings);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return { recordings, loading, error };
}
