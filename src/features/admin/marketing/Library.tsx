import { useState, useEffect, useCallback } from "react";
import {
  FileText, Image as ImageIcon, Video, Search,
  Trash2, Copy, Check, Library as LibraryIcon,
  Pencil, Tag, User, Plus,
} from "lucide-react";

export type LibraryItemType = "draft" | "script" | "image" | "video";

export interface LibraryItem {
  id:        string;
  type:      LibraryItemType;
  title:     string;
  content:   string;
  player:    string | null;
  tags:      string[];
  createdAt: string;
}

type FilterType = "all" | LibraryItemType;

const STORAGE_KEY = "neeko-marketing-library";

function loadLibrary(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LibraryItem[]) : getSeeds();
  } catch {
    return getSeeds();
  }
}

function getSeeds(): LibraryItem[] {
  return [
    {
      id:        "seed-1",
      type:      "script",
      title:     "Buy Post — Example",
      content:   "BUY: [Player Name] is the trade of the round. Projected 110+ pts, ceiling 135, form through the roof. Get on before everyone else does. #AFLFantasy #NeekoSports",
      player:    null,
      tags:      ["buy", "afl"],
      createdAt: new Date().toISOString(),
    },
    {
      id:        "seed-2",
      type:      "script",
      title:     "Trap Warning — Example",
      content:   "TRAP: Everyone's rushing in. Here's why our data says wait. The ceiling looks great but the floor is brutal — don't get caught. #AFLFantasy",
      player:    null,
      tags:      ["trap", "afl"],
      createdAt: new Date().toISOString(),
    },
    {
      id:        "seed-3",
      type:      "draft",
      title:     "Image Caption — Example",
      content:   "Round 5 trade targets are locked in. Swipe to see who's flying under the radar this week.",
      player:    null,
      tags:      ["caption", "social"],
      createdAt: new Date().toISOString(),
    },
  ];
}

function persistLibrary(items: LibraryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

declare global {
  interface Window {
    addToLibrary?: (item: Omit<LibraryItem, "id" | "createdAt">) => void;
  }
}

const TYPE_META: Record<FilterType, { label: string; icon: React.ElementType; color: string }> = {
  all:    { label: "All",     icon: LibraryIcon, color: "bg-muted text-muted-foreground" },
  draft:  { label: "Drafts",  icon: Pencil,      color: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  script: { label: "Scripts", icon: FileText,    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  image:  { label: "Images",  icon: ImageIcon,   color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  video:  { label: "Videos",  icon: Video,       color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function TypeBadge({ type }: { type: LibraryItemType }) {
  const { label, color } = TYPE_META[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

interface AddItemModalProps {
  onAdd: (item: Omit<LibraryItem, "id" | "createdAt">) => void;
  onClose: () => void;
}

function AddItemModal({ onAdd, onClose }: AddItemModalProps) {
  const [title,   setTitle]   = useState("");
  const [type,    setType]    = useState<LibraryItemType>("script");
  const [content, setContent] = useState("");
  const [player,  setPlayer]  = useState("");
  const [tags,    setTags]    = useState("");

  const submit = () => {
    if (!title.trim() || !content.trim()) return;
    onAdd({
      type,
      title:   title.trim(),
      content: content.trim(),
      player:  player.trim() || null,
      tags:    tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 bg-popover border border-border rounded-xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Add to Library</p>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Item title"
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background outline-none focus:border-foreground/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LibraryItemType)}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background outline-none focus:border-foreground/40"
            >
              <option value="draft">Draft</option>
              <option value="script">Script</option>
              <option value="image">Image Idea</option>
              <option value="video">Video Storyboard</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or write content..."
            rows={5}
            className="w-full text-sm border border-border rounded-md p-3 bg-background resize-none outline-none focus:border-foreground/40 leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Player (optional)</label>
            <input
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="e.g. Marcus Bontempelli"
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background outline-none focus:border-foreground/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. buy, r5, afl"
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background outline-none focus:border-foreground/40"
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!title.trim() || !content.trim()}
          className="w-full py-2 rounded-md text-sm font-medium bg-foreground text-background disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Save to Library
        </button>
      </div>
    </div>
  );
}

export default function Library() {
  const [items,      setItems]      = useState<LibraryItem[]>(loadLibrary);
  const [filter,     setFilter]     = useState<FilterType>("all");
  const [search,     setSearch]     = useState("");
  const [copiedId,   setCopiedId]   = useState<string | null>(null);
  const [showModal,  setShowModal]  = useState(false);

  const addItem = useCallback((data: Omit<LibraryItem, "id" | "createdAt">) => {
    const item: LibraryItem = {
      ...data,
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => {
      const updated = [item, ...prev];
      persistLibrary(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    window.addToLibrary = addItem;
    return () => { window.addToLibrary = undefined; };
  }, [addItem]);

  const deleteItem = (id: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      persistLibrary(updated);
      return updated;
    });
  };

  const copyItem = (item: LibraryItem) => {
    navigator.clipboard.writeText(item.content).catch(() => {});
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = items.filter((item) => {
    const matchType   = filter === "all" || item.type === filter;
    const q           = search.toLowerCase();
    const matchSearch = !q
      || item.title.toLowerCase().includes(q)
      || item.content.toLowerCase().includes(q)
      || (item.player ?? "").toLowerCase().includes(q)
      || item.tags.some((t) => t.toLowerCase().includes(q));
    return matchType && matchSearch;
  });

  const countFor = (f: FilterType) =>
    f === "all" ? items.length : items.filter((i) => i.type === f).length;

  const FILTERS: FilterType[] = ["all", "draft", "script", "image", "video"];

  return (
    <>
      {showModal && (
        <AddItemModal onAdd={addItem} onClose={() => setShowModal(false)} />
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 flex-1 bg-background">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library..."
              className="text-sm bg-transparent outline-none flex-1"
            />
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add Item
          </button>
        </div>

        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => {
            const { label, icon: Icon } = TYPE_META[f];
            const count = countFor(f);
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  filter === f
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <span className={`ml-0.5 ${filter === f ? "opacity-70" : "text-muted-foreground/60"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LibraryIcon className="h-8 w-8 text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0 ? "Library is empty" : "No results match your filter"}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              Add items manually or save from Content Engine, Editor, or Video Generator.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-xs underline text-muted-foreground hover:text-foreground transition-colors"
            >
              Add your first item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group relative border border-border rounded-lg p-4 bg-background hover:border-foreground/20 transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TypeBadge type={item.type} />
                    <p className="text-sm font-medium truncate">{item.title}</p>
                  </div>

                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyItem(item)}
                      title="Copy content"
                      className="p-1.5 rounded hover:bg-accent transition-colors"
                    >
                      {copiedId === item.id
                        ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                        : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      title="Delete"
                      className="p-1.5 rounded hover:bg-accent hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {item.content}
                </p>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.player && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <User className="h-3 w-3" /> {item.player}
                      </span>
                    )}
                    {item.tags.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <Tag className="h-3 w-3" />
                        {item.tags.slice(0, 3).join(", ")}
                        {item.tags.length > 3 && ` +${item.tags.length - 3}`}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/40 shrink-0">
                    {fmtDate(item.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <p className="text-[10px] text-muted-foreground/40 text-center pt-2">
            {items.length} item{items.length !== 1 ? "s" : ""} in library · stored locally in browser
          </p>
        )}
      </div>
    </>
  );
}
