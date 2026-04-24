import { useState } from "react";
// Page rendered inside Layout with shared Navbar
import { usePeople } from "@/hooks/usePeople";
import { useRecordings } from "@/hooks/useRecordings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Mic,
} from "lucide-react";
import type { Person } from "@/types/people";

export function PeoplePage() {
  const { people, addPerson, updatePerson, deletePerson } = usePeople();
  const { recordings } = useRecordings();
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Count recordings per person (from analysis participants + transcript speakers)
  const recordingCounts = new Map<string, number>();
  for (const r of recordings) {
    const names = new Set<string>();
    for (const p of r.analysis?.participants || []) names.add(p.toLowerCase());
    for (const seg of r.data.transcript || []) {
      if (seg.speaker && seg.speaker !== "Unknown") names.add(seg.speaker.toLowerCase());
    }
    for (const name of names) {
      recordingCounts.set(name, (recordingCounts.get(name) || 0) + 1);
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addPerson(newName, newRole || undefined);
    setNewName("");
    setNewRole("");
  };

  const handleEdit = (person: Person) => {
    setEditing(person);
    setEditName(person.name);
    setEditRole(person.role || "");
    setEditNotes(person.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    await updatePerson(editing.id, {
      name: editName,
      role: editRole || undefined,
      notes: editNotes || undefined,
    });
    setEditing(null);
  };

  const getRecordingCount = (name: string) =>
    recordingCounts.get(name.toLowerCase()) || 0;

  const SOURCE_COLORS: Record<string, string> = {
    manual: "bg-blue-100 text-blue-800",
    pocket: "bg-green-100 text-green-800",
    inferred: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            People
          </h1>
          <p className="text-xs text-muted-foreground">
            {people.length} people — used for speaker inference in transcript analysis
          </p>
        </div>
        {/* Add person */}
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Input
            placeholder="Role (optional)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-48"
          />
          <Button onClick={handleAdd} disabled={!newName.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* People list */}
        {people.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No people yet. Add people above so Seam can attribute speakers in transcripts.
          </div>
        ) : (
          <div className="space-y-2">
            {people.map((person) => (
              <Card key={person.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{person.name}</span>
                      {person.role && (
                        <span className="text-xs text-muted-foreground">
                          {person.role}
                        </span>
                      )}
                      <Badge
                        variant="secondary"
                        className={`text-xs ${SOURCE_COLORS[person.source] || ""}`}
                      >
                        {person.source}
                      </Badge>
                    </div>
                    {person.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {person.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mic className="h-3 w-3" />
                      {getRecordingCount(person.name)} recording{getRecordingCount(person.name) !== 1 ? "s" : ""}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(person)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePerson(person.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit dialog */}
        {editing && (
          <Dialog open onOpenChange={() => setEditing(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Person</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <Input
                  placeholder="Role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                />
                <Input
                  placeholder="Notes (e.g., 'usually discusses engineering topics')"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
