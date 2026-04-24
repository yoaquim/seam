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
  const [newTags, setNewTags] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAliases, setEditAliases] = useState("");
  const [editTags, setEditTags] = useState("");
  const [filterTag, setFilterTag] = useState("");

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
    const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    await addPerson(newName, newRole || undefined, undefined, tags.length > 0 ? tags : undefined);
    setNewName("");
    setNewRole("");
    setNewTags("");
  };

  const handleEdit = (person: Person) => {
    setEditing(person);
    setEditName(person.name);
    setEditRole(person.role || "");
    setEditNotes(person.notes || "");
    setEditAliases((person.aliases || []).join(", "));
    setEditTags((person.tags || []).join(", "));
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const aliases = editAliases.split(",").map((a) => a.trim()).filter(Boolean);
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    await updatePerson(editing.id, {
      name: editName,
      role: editRole || undefined,
      notes: editNotes || undefined,
      aliases: aliases.length > 0 ? aliases : undefined,
      tags: tags.length > 0 ? tags : undefined,
    } as any);
    setEditing(null);
  };

  const getRecordingCount = (person: Person) => {
    let count = recordingCounts.get(person.name.toLowerCase()) || 0;
    for (const alias of person.aliases || []) {
      count += recordingCounts.get(alias.toLowerCase()) || 0;
    }
    return count;
  };

  // Collect all unique tags
  const allTags = [...new Set(people.flatMap((p) => p.tags || []))].sort();

  const filteredPeople = filterTag
    ? people.filter((p) => p.tags?.includes(filterTag))
    : people;

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
            className="w-40"
          />
          <Input
            placeholder="Tags (optional, comma-sep)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-48"
          />
          <Button onClick={handleAdd} disabled={!newName.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-xs text-muted-foreground">Filter:</span>
            <button
              onClick={() => setFilterTag("")}
              className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                filterTag === ""
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              All ({people.length})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
                className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                  filterTag === tag
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:border-foreground"
                }`}
              >
                {tag} ({people.filter((p) => p.tags?.includes(tag)).length})
              </button>
            ))}
          </div>
        )}

        {/* People list */}
        {filteredPeople.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No people yet. Add people above so Seam can attribute speakers in transcripts.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPeople.map((person) => (
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
                    {person.aliases && person.aliases.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        aka {person.aliases.join(", ")}
                      </p>
                    )}
                    {person.tags && person.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {person.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {person.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {person.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mic className="h-3 w-3" />
                      {getRecordingCount(person)} recording{getRecordingCount(person) !== 1 ? "s" : ""}
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
                  placeholder="Aliases (comma-separated, e.g. 'Joaquin, J')"
                  value={editAliases}
                  onChange={(e) => setEditAliases(e.target.value)}
                />
                <Input
                  placeholder="Tags (comma-separated, e.g. 'engineering, leadership')"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
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
