import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TaskList } from "@/components/tasks/TaskList";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { AITaskDialog } from "@/components/tasks/AITaskDialog";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { TaskKanbanBoard } from "@/components/tasks/TaskKanbanBoard";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Sun, CheckCircle2, List, LayoutGrid, AlertTriangle, ClipboardCheck, Clock, CalendarClock, Sparkles } from "lucide-react";
import { startOfDay, endOfDay, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

type Task = Tables<"tasks">;

const VIEW_MODE_KEY = "tasks-view-mode";

export default function Tasks() {
  const { user, hasElevatedAccess } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return saved === "kanban" ? "kanban" : "list";
  });

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Deep-link: open task from URL param
  useEffect(() => {
    const openTaskId = searchParams.get("openTask");
    if (openTaskId) {
      supabase
        .from("tasks")
        .select("*")
        .eq("id", openTaskId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedTask(data);
        });
      setSearchParams((prev) => {
        prev.delete("openTask");
        return prev;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const today = useMemo(() => new Date(), []);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", hasElevatedAccess, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (!hasElevatedAccess && user) {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Count pending tasks for "Meu Dia" badge (overdue + today, excluding lead type)
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["my-day-pending", user?.id],
    queryFn: async () => {
      const startDay = startOfDay(today).toISOString();
      const endDay = endOfDay(today).toISOString();

      const { data: overdue } = await supabase
        .from("tasks")
        .select("id")
        .eq("assigned_to", user!.id)
        .neq("status", "completed")
        .neq("type", "lead")
        .lt("due_date", startDay);

      const { data: todayT } = await supabase
        .from("tasks")
        .select("id")
        .eq("assigned_to", user!.id)
        .neq("status", "completed")
        .neq("type", "lead")
        .gte("due_date", startDay)
        .lte("due_date", endDay);

      return (overdue?.length || 0) + (todayT?.length || 0);
    },
    enabled: !!user,
  });

  // KPI calculations
  const kpis = useMemo(() => {
    const myTasks = tasks.filter((t) => t.assigned_to === user?.id && t.status !== "completed");
    const overdue = tasks.filter(
      (t) => t.status !== "completed" && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
    );
    const dueToday = tasks.filter(
      (t) => t.status !== "completed" && t.due_date && isToday(new Date(t.due_date))
    );
    const completed = tasks.filter((t) => t.status === "completed");
    return { myTasks: myTasks.length, overdue: overdue.length, dueToday: dueToday.length, completed: completed.length };
  }, [tasks, user?.id]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === "overdue") {
        return t.status !== "completed" && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
      }
      if (statusFilter === "today") {
        return t.status !== "completed" && t.due_date && isToday(new Date(t.due_date));
      }
      if (statusFilter === "completed") return t.status === "completed";
      if (statusFilter === "pending") return t.status !== "completed";
      return true;
    });
  }, [tasks, statusFilter]);

  const filterPills = useMemo(() => [
    { key: "all", label: "Todas", count: tasks.length, emoji: "" },
    { key: "overdue", label: "Vencidas", count: kpis.overdue, emoji: "🔴" },
    { key: "today", label: "Hoje", count: kpis.dueToday, emoji: "📅" },
    { key: "pending", label: "Pendentes", count: tasks.filter((t) => t.status !== "completed").length, emoji: "⏳" },
    { key: "completed", label: "Concluídas", count: kpis.completed, emoji: "✅" },
  ], [tasks, kpis]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5 bg-card border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Minhas Tarefas</span>
          </div>
          <p className="text-3xl font-bold text-primary">{kpis.myTasks}</p>
          <p className="text-xs text-muted-foreground mt-0.5">atribuídas a você</p>
        </Card>

        <Card className="p-5 bg-card border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vencidas</span>
          </div>
          <p className="text-3xl font-bold text-destructive">{kpis.overdue}</p>
          <p className="text-xs text-muted-foreground mt-0.5">ação urgente</p>
        </Card>

        <Card className="p-5 bg-card border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="h-4 w-4 text-orange-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vencem Hoje</span>
          </div>
          <p className="text-3xl font-bold text-orange-500">{kpis.dueToday}</p>
          <p className="text-xs text-muted-foreground mt-0.5">prazo até 18h</p>
        </Card>

        <Card className="p-5 bg-card border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Concluídas</span>
          </div>
          <p className="text-3xl font-bold text-green-500">{kpis.completed}</p>
          <p className="text-xs text-muted-foreground mt-0.5">total geral</p>
        </Card>
      </div>

      {/* Overdue alert banner */}
      {kpis.overdue > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 border-l-4 border-l-destructive">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">
            🚨 {kpis.overdue} tarefa{kpis.overdue > 1 ? "s" : ""} vencida{kpis.overdue > 1 ? "s" : ""} — ação imediata necessária.
          </p>
        </div>
      )}

      {/* Filter bar */}
      <Card className="p-3 bg-card border shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {filterPills.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setStatusFilter(pill.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === pill.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {pill.emoji && <span>{pill.emoji}</span>}
                {pill.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0 text-[10px] font-semibold min-w-[18px] text-center",
                  statusFilter === pill.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                )}>
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "kanban" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
            </div>

            <Button size="sm" variant="outline" onClick={() => setAiOpen(true)} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> IA
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nova Tarefa
            </Button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {viewMode === "list" && (
        <Card>
          <TaskList tasks={filtered} showAssignee={hasElevatedAccess} onTaskClick={setSelectedTask} />
        </Card>
      )}

      {viewMode === "kanban" && (
        <TaskKanbanBoard
          tasks={tasks}
          showAssignee={hasElevatedAccess}
          onTaskClick={setSelectedTask}
        />
      )}

      <AddTaskDialog open={addOpen} onOpenChange={setAddOpen} />
      <AITaskDialog open={aiOpen} onOpenChange={setAiOpen} />
      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
