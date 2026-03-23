import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2, Copy, Check, FileText, Plus } from "lucide-react";

interface Draft {
  id: string;
  title: string;
  content: string;
  notes: string;
  savedAt: string;
}

const STORAGE_KEY = "neeko_marketing_drafts";

function loadDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: Draft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export default function Editor() {
  const [drafts, setDrafts] = useState<Draft[]>(loadDrafts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const activeDraft = drafts.find((d) => d.id === activeId) ?? null;

  useEffect(() => {
    if (activeDraft) {
      setTitle(activeDraft.title);
      setContent(activeDraft.content);
      setNotes(activeDraft.notes);
    }
  }, [activeId]);

  const newDraft = () => {
    const id = crypto.randomUUID();
    const draft: Draft = { id, title: "Untitled", content: "", notes: "", savedAt: new Date().toISOString() };
    const updated = [draft, ...drafts];
    setDrafts(updated);
    saveDrafts(updated);
    setActiveId(id);
    setTitle("Untitled");
    setContent("");
    setNotes("");
  };

  const save = () => {
    if (!activeId) {
      toast({ title: "No draft selected", variant: "destructive" });
      return;
    }
    const updated = drafts.map((d) =>
      d.id === activeId ? { ...d, title, content, notes, savedAt: new Date().toISOString() } : d
    );
    setDrafts(updated);
    saveDrafts(updated);
    toast({ title: "Draft saved" });
  };

  const deleteDraft = (id: string) => {
    const updated = drafts.filter((d) => d.id !== id);
    setDrafts(updated);
    saveDrafts(updated);
    if (activeId === id) {
      setActiveId(null);
      setTitle("");
      setContent("");
      setNotes("");
    }
  };

  const copyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="md:col-span-1 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Drafts</p>
          <button
            onClick={newDraft}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {drafts.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No drafts yet</p>
            <button onClick={newDraft} className="text-xs text-foreground underline mt-1">
              Create one
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {drafts.map((d) => (
              <div
                key={d.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm ${
                  activeId === d.id ? "bg-accent text-foreground" : "hover:bg-accent/50 text-muted-foreground"
                }`}
                onClick={() => setActiveId(d.id)}
              >
                <span className="flex-1 truncate font-medium">{d.title || "Untitled"}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteDraft(d.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="md:col-span-3 space-y-3">
        {!activeId ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Select a draft or create a new one</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={newDraft}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Draft
            </Button>
          </div>
        ) : (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Draft title..."
              className="w-full text-base font-semibold bg-transparent border-b border-border pb-2 outline-none"
            />

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your script, caption, or post copy here..."
              rows={12}
              className="w-full text-sm border border-border rounded-md p-3 bg-background resize-y leading-relaxed"
            />

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (not published)..."
              rows={3}
              className="w-full text-xs border border-border rounded-md p-3 bg-muted/30 resize-none text-muted-foreground"
            />

            <div className="flex items-center gap-2 justify-between">
              {activeDraft && (
                <p className="text-xs text-muted-foreground">
                  Last saved {fmtDate(activeDraft.savedAt)}
                </p>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={copyContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs hover:bg-accent transition-colors"
                >
                  {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                </button>
                <Button size="sm" onClick={save}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
