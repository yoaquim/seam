import { useState, useEffect, useCallback } from "react";
import type { Person } from "@/types/people";

const API = "http://localhost:3001";

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch(`${API}/api/people`)
      .then((r) => r.json())
      .then((data) => {
        setPeople(data.people || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addPerson = useCallback(async (name: string, role?: string, notes?: string) => {
    const res = await fetch(`${API}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, notes }),
    });
    if (res.ok) {
      const person = await res.json();
      setPeople((prev) => [...prev, person]);
      return person;
    }
    return null;
  }, []);

  const updatePerson = useCallback(async (id: string, updates: Partial<Pick<Person, "name" | "role" | "notes">>) => {
    const res = await fetch(`${API}/api/people/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setPeople((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
  }, []);

  const deletePerson = useCallback(async (id: string) => {
    const res = await fetch(`${API}/api/people/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPeople((prev) => prev.filter((p) => p.id !== id));
    }
  }, []);

  return { people, loading, addPerson, updatePerson, deletePerson, refresh };
}
