import { useState } from "react";
import { usePeople } from "@/hooks/usePeople";
import { useRecordings } from "@/hooks/useRecordings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Users,
  Mic,
  Save,
} from "lucide-react";
import { tagClassName } from "@/lib/tag-colors";
import type { Person } from "@/types/people";

export function PeoplePage() {
  const { people, addPerson, updatePerson, deletePerson } = usePeople();
  const { recordings } = useRecordings();
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newTags, setNewTags] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // Selected person for view/edit modal
  const [selected, setSelected] = useState<Person | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAliases, setEditAliases] = useState("");
  const [editTags, setEditTags] = useState("");
  const [dirty, setDirty] = useState(false);

  // Count recordings per person
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

  const openPerson = (person: Person) => {
    setSelected(person);
    setEditName(person.name);
    setEditRole(person.role || "");
    setEditNotes(person.notes || "");
    setEditAliases((person.aliases || []).join(", "));
    setEditTags((person.tags || []).join(", "));
    setDirty(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    const aliases = editAliases.split(",").map((a) => a.trim()).filter(Boolean);
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    await updatePerson(selected.id, {
      name: editName,
      role: editRole || undefined,
      notes: editNotes || undefined,
      aliases: aliases.length > 0 ? aliases : undefined,
      tags: tags.length > 0 ? tags : undefined,
    } as any);
    setDirty(false);
    // Update selected with new values
    setSelected({
      ...selected,
      name: editName,
      role: editRole || undefined,
      notes: editNotes || undefined,
      aliases: aliases.length > 0 ? aliases : undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleDelete = async (person: Person) => {
    if (!confirm(`Delete "${person.name}"?`)) return;
    await deletePerson(person.id);
    setSelected(null);
  };

  const markDirty = () => setDirty(true);

  const getRecordingCount = (person: Person) => {
    let count = recordingCounts.get(person.name.toLowerCase()) || 0;
    for (const alias of person.aliases || []) {
      count += recordingCounts.get(alias.toLowerCase()) || 0;
    }
    return count;
  };

  const allTags = [...new Set(people.flatMap((p) => p.tags || []))].sort();
  const filteredPeople = filterTag
    ? people.filter((p) => p.tags?.includes(filterTag))
    : people;

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
            placeholder="Tags (comma-sep)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-44"
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
            {allTags.map((tag) => {
              const colors = tagClassName(tag);
              return (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
                  className={`text-xs px-2 py-1 rounded transition-colors cursor-pointer ${
                    filterTag === tag
                      ? "bg-foreground text-background border border-foreground"
                      : `${colors} hover:opacity-80`
                  }`}
                >
                  {tag} ({people.filter((p) => p.tags?.includes(tag)).length})
                </button>
              );
            })}
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
              <Card
                key={person.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openPerson(person)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{person.name}</span>
                      {person.role && (
                        <span className="text-xs text-muted-foreground">{person.role}</span>
                      )}
                      {person.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className={`text-xs px-1.5 py-0 ${tagClassName(tag)}`}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {person.aliases && person.aliases.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        aka {person.aliases.join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Mic className="h-3 w-3" />
                    {getRecordingCount(person)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View/Edit modal */}
        {selected && (
          <Dialog open onOpenChange={() => setSelected(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Editable fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Name</label>
                    <Input
                      value={editName}
                      onChange={(e) => { setEditName(e.target.value); markDirty(); }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Role</label>
                    <Input
                      placeholder="e.g. CTO, Engineer, Client"
                      value={editRole}
                      onChange={(e) => { setEditRole(e.target.value); markDirty(); }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Aliases (comma-separated)</label>
                    <Input
                      placeholder="e.g. Joaquin, J, joaquim"
                      value={editAliases}
                      onChange={(e) => { setEditAliases(e.target.value); markDirty(); }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Tags (comma-separated)</label>
                    <Input
                      placeholder="e.g. engineering, leadership"
                      value={editTags}
                      onChange={(e) => { setEditTags(e.target.value); markDirty(); }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                    <Input
                      placeholder="e.g. usually discusses backend architecture"
                      value={editNotes}
                      onChange={(e) => { setEditNotes(e.target.value); markDirty(); }}
                    />
                  </div>
                </div>

                <Separator />

                {/* Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mic className="h-3 w-3" />
                    {getRecordingCount(selected)} recording{getRecordingCount(selected) !== 1 ? "s" : ""}
                  </span>
                  <span>Source: {selected.source}</span>
                </div>

                {/* Actions */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(selected)}
                    className="text-destructive hover:text-destructive gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!dirty}
                    className="gap-1"
                  >
                    <Save className="h-3.5 w-3.5" />
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
