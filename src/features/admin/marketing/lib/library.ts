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

export type NewLibraryItem = Omit<LibraryItem, "id" | "createdAt">;

export const LIBRARY_KEY = "neeko-marketing-library";

export function loadLibrary(): LibraryItem[] {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "[]") as LibraryItem[];
  } catch {
    return [];
  }
}

export function saveLibrary(items: LibraryItem[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
}

export function addToLibrary(item: NewLibraryItem): LibraryItem {
  const newItem: LibraryItem = {
    ...item,
    id:        crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const updated = [newItem, ...loadLibrary()];
  saveLibrary(updated);
  if (typeof window !== "undefined" && typeof window.__onLibraryAdd === "function") {
    window.__onLibraryAdd(newItem);
  }
  return newItem;
}

declare global {
  interface Window {
    __onLibraryAdd?: (item: LibraryItem) => void;
  }
}
