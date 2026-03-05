import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus, SquareCheck as CheckSquare, Square, Trash2, Pencil, Check, X, ListTodo } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "low" | "normal" | "high";

interface Task {
  id: string;
  task_text: string;
  priority: Priority;
  completed: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_OPTS: { id: Priority; label: string; color: string }[] = [
  { id: "high",   label: "High",   color: "#EF4444" },
  { id: "normal", label: "Normal", color: "#F59E0B" },
  { id: "low",    label: "Low",    color: "#6B7280" },
];

function priorityColor(p: Priority): string {
  return PRIORITY_OPTS.find((o) => o.id === p)?.color ?? "#6B7280";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminFounderTasks() {
  const { toast } = useToast();
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newText, setNewText]   = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [adding, setAdding]     = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("normal");
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("founder_tasks")
        .select("id, task_text, priority, completed, created_at")
        .order("completed", { ascending: true })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTasks((data ?? []) as Task[]);
    } catch (err) {
      toast({ title: "Failed to load tasks", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("founder_tasks")
        .insert({ task_text: text, priority: newPriority, completed: false })
        .select("id, task_text, priority, completed, created_at")
        .single();
      if (error) throw error;
      setTasks((prev) => [data as Task, ...prev.filter((t) => !t.completed), ...prev.filter((t) => t.completed)]);
      setNewText("");
      setNewPriority("normal");
      toast({ title: "Task added" });
    } catch (err) {
      toast({ title: "Failed to add task", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (task: Task) => {
    setTogglingId(task.id);
    const next = !task.completed;
    try {
      const { error } = await supabase
        .from("founder_tasks")
        .update({ completed: next })
        .eq("id", task.id);
      if (error) throw error;
      setTasks((prev) => {
        const updated = prev.map((t) => t.id === task.id ? { ...t, completed: next } : t);
        return [...updated.filter((t) => !t.completed), ...updated.filter((t) => t.completed)];
      });
    } catch (err) {
      toast({ title: "Failed to update", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditText(task.task_text);
    setEditPriority(task.priority);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (id: string) => {
    const text = editText.trim();
    if (!text) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("founder_tasks")
        .update({ task_text: text, priority: editPriority })
        .eq("id", id);
      if (error) throw error;
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, task_text: text, priority: editPriority } : t));
      setEditingId(null);
      toast({ title: "Task updated" });
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("founder_tasks").delete().eq("id", id);
      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "Task deleted" });
    } catch (err) {
      toast({ title: "Failed to delete", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const pending   = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            Founder Tasks
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Persistent task list — synced across devices.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{pending.length} pending</span>
          <span className="text-border">·</span>
          <span>{completed.length} done</span>
          <Button variant="outline" size="sm" className="h-8 text-xs ml-2" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Add Task */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Task</p>
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !adding && handleAdd()}
            placeholder="Enter task…"
            className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-border placeholder:text-muted-foreground/50"
          />
          <div className="flex gap-2">
            {PRIORITY_OPTS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setNewPriority(opt.id)}
                className="flex-1 sm:flex-none px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                style={
                  newPriority === opt.id
                    ? { background: `${opt.color}20`, borderColor: `${opt.color}60`, color: opt.color }
                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {opt.label}
              </button>
            ))}
            <Button
              size="sm"
              className="h-10 px-4 text-xs font-semibold shrink-0"
              onClick={handleAdd}
              disabled={adding || !newText.trim()}
            >
              {adding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />Loading tasks…
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No tasks yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pending ({pending.length})
              </p>
              <div className="space-y-1.5">
                {pending.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isEditing={editingId === task.id}
                    editText={editText}
                    editPriority={editPriority}
                    isSavingEdit={savingEdit}
                    isToggling={togglingId === task.id}
                    isDeleting={deletingId === task.id}
                    onToggle={() => handleToggle(task)}
                    onStartEdit={() => startEdit(task)}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={() => saveEdit(task.id)}
                    onDelete={() => handleDelete(task.id)}
                    onEditTextChange={setEditText}
                    onEditPriorityChange={setEditPriority}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Completed ({completed.length})
              </p>
              <div className="space-y-1.5 opacity-60">
                {completed.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isEditing={false}
                    editText=""
                    editPriority="normal"
                    isSavingEdit={false}
                    isToggling={togglingId === task.id}
                    isDeleting={deletingId === task.id}
                    onToggle={() => handleToggle(task)}
                    onStartEdit={() => startEdit(task)}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={() => saveEdit(task.id)}
                    onDelete={() => handleDelete(task.id)}
                    onEditTextChange={setEditText}
                    onEditPriorityChange={setEditPriority}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TaskRow sub-component ────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  isEditing: boolean;
  editText: string;
  editPriority: Priority;
  isSavingEdit: boolean;
  isToggling: boolean;
  isDeleting: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onEditTextChange: (v: string) => void;
  onEditPriorityChange: (v: Priority) => void;
}

function TaskRow({
  task, isEditing, editText, editPriority, isSavingEdit,
  isToggling, isDeleting,
  onToggle, onStartEdit, onCancelEdit, onSaveEdit, onDelete,
  onEditTextChange, onEditPriorityChange,
}: TaskRowProps) {
  const pc = priorityColor(task.priority);

  if (isEditing) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
        <input
          type="text"
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-border"
          autoFocus
        />
        <div className="flex items-center gap-2 flex-wrap">
          {PRIORITY_OPTS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onEditPriorityChange(opt.id)}
              className="px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all"
              style={
                editPriority === opt.id
                  ? { background: `${opt.color}20`, borderColor: `${opt.color}60`, color: opt.color }
                  : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
              }
            >
              {opt.label}
            </button>
          ))}
          <div className="flex gap-1.5 ml-auto">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-7 px-3 text-xs" onClick={onSaveEdit} disabled={isSavingEdit || !editText.trim()}>
              {isSavingEdit ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5 group hover:bg-muted/20 transition-colors">
      <button
        onClick={onToggle}
        disabled={isToggling}
        className="shrink-0 transition-opacity disabled:opacity-50"
      >
        {isToggling
          ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          : task.completed
          ? <CheckSquare className="h-4 w-4 text-emerald-500" />
          : <Square className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      <span
        className="flex-1 text-sm min-w-0 truncate"
        style={task.completed ? { textDecoration: "line-through", color: "hsl(var(--muted-foreground))" } : {}}
      >
        {task.task_text}
      </span>

      <Badge
        variant="outline"
        className="shrink-0 text-[10px] px-1.5 py-0"
        style={{ borderColor: `${pc}40`, color: pc }}
      >
        {task.priority}
      </Badge>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onStartEdit}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500 disabled:opacity-50"
          title="Delete"
        >
          {isDeleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
