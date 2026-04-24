import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Save } from "lucide-react";

export function PromptEditor() {
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load from localStorage (in production, this would read from prompts/analyze.md)
    const stored = localStorage.getItem("seam-analyze-prompt");
    if (stored) {
      setPrompt(stored);
    } else {
      setPrompt(
        "# Default Analyze Prompt\n\nEdit this prompt to customize how Seam analyzes your recordings.\n\nThe prompt is sent to Claude along with each recording's transcript and metadata."
      );
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("seam-analyze-prompt", prompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        <Settings className="h-4 w-4 mr-2" />
        Prompt
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Analysis Prompt</DialogTitle>
          <DialogDescription>
            Customize the prompt Claude uses to analyze your recordings. Changes
            are saved locally and used on the next sync.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button onClick={handleSave} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saved ? "Saved!" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
