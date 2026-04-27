import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:3001";

export interface Settings {
  configured: boolean;
  pocketApiKey: string;
  s3Bucket: string;
  s3Prefix: string;
  awsProfile: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    fetch(`${API}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (updates: {
      pocketApiKey?: string;
      s3Bucket?: string;
      s3Prefix?: string;
      awsProfile?: string;
    }) => {
      setSaving(true);
      try {
        const res = await fetch(`${API}/api/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          return true;
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const testConnection = useCallback(async () => {
    setTestResult(null);
    try {
      const res = await fetch(`${API}/api/s3/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(data);
      return data;
    } catch {
      const result = { ok: false, error: "Failed to reach server" };
      setTestResult(result);
      return result;
    }
  }, []);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch(`${API}/api/s3/sync`, { method: "POST" });
    } finally {
      // S3 sync is fire-and-forget, so we just show a brief indicator
      setTimeout(() => setSyncing(false), 2000);
    }
  }, []);

  return {
    settings,
    loading,
    saving,
    save,
    testConnection,
    testResult,
    triggerSync,
    syncing,
    refresh,
  };
}
