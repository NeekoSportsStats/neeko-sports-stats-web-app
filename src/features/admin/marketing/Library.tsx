import { useState, useEffect } from "react";
import { FileText, Image as ImageIcon, Video, Search, Trash2, Copy, Check, Library as LibraryIcon } from "lucide-react";

type ContentType = "all" | "script" | "image" | "video";

interface SavedItem {
  id: string;
  type: "script" | "image" | "video";
  title: string;
  content: string;
  player?: string;
  angle?: string;
  savedAt: string;
}

const STORAGE_KEY = "neeko_marketing_library";

function loadItems(): SavedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaults();
  } catch {
    return getDefaults();
  }
}

function getDefaults(): SavedItem[] {
  return [
    {
      id: "demo-1",
      type: "script",
      title: "Buy Post — Example",
      content: "📈 BUY: [Player Name] is the trade of the round. Projected 110+ pts, ceiling 135, form through the roof. Get on before everyone else does. #AFLFantasy #NeekoSports",
      angle: "buy",
      savedAt: new Date().toISOString(),
    },
    {
      id: "demo-2",
      type: "script",
      title: "Trap Warning — Example",
      content: "🪤 TRAP: Everyone's rushing in. Here's why our data says wait. The ceiling looks great but the floor is brutal — don't get caught. #AFLFantasy",
      angle: "trap",
      savedAt: new Date().toISOString(),
    },
  ];
}

const TYPE_ICONS: Record<ContentType, React.ElementType> = {
  all: LibraryIcon,
  script: FileText,
  image: ImageIcon,
  video: Video,
};

const TYPE_COLORS: Record<string, string> = {
  script: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  image: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  video: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

export default function Library() {
  const [items, setItems] = useState<SavedItem[]>(loadItems);
  const [filter, setFilter] = useState<ContentType>("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = items.filter((item) => {
    const matchType = filter === "all" || item.type === filter;
    const matchSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase()) ||
      (item.player ?? "").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const deleteItem = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const copyItem = (item: SavedItem) => {
    navigator.clipboard.writeText(item.content);
    setCopied(item.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const countByType = (type: ContentType) =>
    type === "all" ? items.length : items.filter((i) => i.type === type).length;

  return (
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

        <div className="flex gap-1">
          {(["all", "script", "image", "video"] as ContentType[]).map((t) => {
            const Icon = TYPE_ICONS[t];
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors capitalize ${
                  filter === t
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t} ({countByType(t)})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LibraryIcon className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? "No saved content yet" : "No results match your filter"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Scripts saved from the Content Engine will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group border border-border rounded-md p-4 bg-background hover:border-foreground/20 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[item.type]}`}
                  >
                    {item.type}
                  </span>
                  <p className="text-sm font-medium truncate">{item.title}</p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => copyItem(item)}
                    className="p-1.5 rounded hover:bg-accent transition-colors"
                  >
                    {copied === item.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 rounded hover:bg-accent hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {item.content}
              </p>

              <div className="flex items-center justify-between pt-1">
                {item.player && (
                  <span className="text-xs text-muted-foreground/70">{item.player}</span>
                )}
                {item.angle && (
                  <span className="text-xs text-muted-foreground/70 capitalize">{item.angle}</span>
                )}
                <span className="text-[10px] text-muted-foreground/50 ml-auto">{fmtDate(item.savedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
