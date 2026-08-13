import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRankingEnabled } from "@/hooks/useRankingEnabled";
import { useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { TaskKanbanColumn } from "./TaskKanbanColumn";
import { TaskKanbanCard } from "./TaskKanbanCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { FilterField } from "@/components/ui/filter-field";
import { isPast, isToday } from "date-fns";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;

interface TaskKanbanBoardProps {
  tasks: Task[];
  showAssignee: boolean;
  onTaskClick: (task: Task) => void;
}

type ColumnId = "todo" | "in_progress" | "overdue" | "completed";

function getColumnForTask(task: Task): ColumnId {
  if (task.status === "completed") return "completed";
  if (task.status === "in_progress") return "in_progress";
  if (task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))) {
    return "overdue";
  }
  return "todo";
}

function getStatusForColumn(columnId: ColumnId): string {
  switch (columnId) {
    case "todo": return "pending";
    case "in_progress": return "in_progress";
    case "overdue": return "pending";
    case "completed": return "completed";
  }
}

export function TaskKanbanBoard({ tasks, showAssignee, onTaskClick }: TaskKanbanBoardProps) {
  const { user, hasElevatedAccess } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rankingEnabled = useRankingEnabled();

  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  const { data: usersMap = {} } = useQuery({
    queryKey: ["users-map"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name");
      const map: Record<string, string> = {};
      data?.forEach((u) => (map[u.id] = u.name));
      return map;
    },
  });

  const leadIds = useMemo(() => [...new Set(tasks.map((t) => t.lead_id).filter(Boolean))], [tasks]);
  const { data: leadsMap = {} } = useQuery({
    queryKey: ["leads-map-kanban", leadIds],
    queryFn: async () => {
      if (!leadIds.length) return {};
      const { data } = await supabase.from("leads").select("id, name").in("id", leadIds);
      const map: Record<string, string> = {};
      data?.forEach((l) => (map[l.id] = l.name || "Sem nome"));
      return map;
    },
    enabled: leadIds.length > 0,
  });

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const { data: checklistMap = {} } = useQuery({
    queryKey: ["checklist-counts", taskIds],
    queryFn: async () => {
      if (!taskIds.length) return {};
      const { data } = await supabase
        .from("task_checklist_items")
        .select("task_id, completed")
        .in("task_id", taskIds);
      const map: Record<string, { total: number; done: number }> = {};
      data?.forEach((item) => {
        if (!map[item.task_id]) map[item.task_id] = { total: 0, done: 0 };
        map[item.task_id].total++;
        if (item.completed) map[item.task_id].done++;
      });
      return map;
    },
    enabled: taskIds.length > 0,
  });

  const { data: commentMap = {} } = useQuery({
    queryKey: ["comment-counts", taskIds],
    queryFn: async () => {
      if (!taskIds.length) return {};
      const { data } = await supabase
        .from("task_comments")
        .select("task_id")
        .in("task_id", taskIds);
      const map: Record<string, number> = {};
      data?.forEach((c) => {
        map[c.task_id] = (map[c.task_id] || 0) + 1;
      });
      return map;
    },
    enabled: taskIds.length > 0,
  });

  const leadOptions = useMemo(() => {
    const entries = Object.entries(leadsMap);
    return entries.sort((a, b) => a[1].localeCompare(b[1]));
  }, [leadsMap]);

  const userOptions = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.assigned_to))];
    return ids.map((id) => ({ id, name: usersMap[id] || id })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, usersMap]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (userFilter !== "all" && t.assigned_to !== userFilter) return false;
      if (leadFilter !== "all" && t.lead_id !== leadFilter) return false;
      return true;
    });
  }, [tasks, search, userFilter, leadFilter]);

  const columns = useMemo(() => {
    const cols: Record<ColumnId, Task[]> = { todo: [], in_progress: [], overdue: [], completed: [] };
    filtered.forEach((t) => {
      cols[getColumnForTask(t)].push(t);
    });
    return cols;
  }, [filtered]);

  const moveMutation = useMutation({
    mutationFn: async ({ task, targetColumn }: { task: Task; targetColumn: ColumnId }) => {
      const newStatus = getStatusForColumn(targetColumn);
      if (targetColumn === "completed") {
        return "open_detail";
      }
      if (task.status === "completed") {
        const { data: reopenData, error: reopenError } = await supabase.from("tasks").update({
          status: newStatus,
          completed_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", task.id).select("id");
        if (reopenError) throw reopenError;
        if (!reopenData || reopenData.length === 0) {
          throw new Error("Sem permissão para mover esta tarefa (apenas o responsável, criador ou admin podem alterar).");
        }

        if (rankingEnabled) {
          const monthYear = new Date().toISOString().slice(0, 7);
          const { data: existing } = await supabase
            .from("user_scores")
            .select("*")
            .eq("user_id", task.assigned_to)
            .eq("month_year", monthYear)
            .maybeSingle();
          if (existing) {
            await supabase.from("user_scores").update({
              points_earned: Math.max(0, existing.points_earned - 10),
              tasks_completed: Math.max(0, existing.tasks_completed - 1),
            }).eq("id", existing.id);
          }
        }

        await supabase.from("task_history").insert({
          task_id: task.id,
          user_id: user!.id,
          action: "reopened",
          details: `Tarefa reaberta para ${targetColumn === "in_progress" ? "Em Andamento" : "A Fazer"}`,
        });

        return "moved";
      }

      const { data: updData, error: updError } = await supabase.from("tasks").update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", task.id).select("id");
      if (updError) throw updError;
      if (!updData || updData.length === 0) {
        throw new Error("Sem permissão para mover esta tarefa (apenas o responsável, criador ou admin podem alterar).");
      }

      await supabase.from("task_history").insert({
        task_id: task.id,
        user_id: user!.id,
        action: "status_changed",
        details: `Status alterado para ${newStatus}`,
      });

      return "moved";
    },
    onSuccess: (result, { task }) => {
      if (result === "open_detail") {
        onTaskClick(task);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-scores"] });
      toast.success("Tarefa movida");
    },
    onError: (err: Error) => toast.error(err?.message || "Erro ao mover tarefa"),
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task;
    setDraggingTask(task || null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = active.data.current?.task as Task;
    const targetColumn = over.id as ColumnId;

    if (!task || !["todo", "in_progress", "overdue", "completed"].includes(targetColumn)) return;

    const currentColumn = getColumnForTask(task);
    if (currentColumn === targetColumn) return;

    moveMutation.mutate({ task, targetColumn });
  }, [moveMutation]);

  const handleLeadClick = useCallback((leadId: string) => {
    navigate(`/leads?openLead=${leadId}`);
  }, [navigate]);

  const renderCard = (task: Task) => (
    <TaskKanbanCard
      key={task.id}
      task={task}
      leadName={leadsMap[task.lead_id]}
      assigneeName={usersMap[task.assigned_to]}
      checklistTotal={checklistMap[task.id]?.total}
      checklistDone={checklistMap[task.id]?.done}
      commentCount={commentMap[task.id]}
      onClick={onTaskClick}
      onLeadClick={handleLeadClick}
    />
  );

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-end gap-2 flex-wrap">
        <FilterField label="Buscar">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[220px] h-9 text-sm"
            />
          </div>
        </FilterField>

        {hasElevatedAccess && (
          <FilterField label="Responsável">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {user && <SelectItem value={user.id}>Minhas tarefas</SelectItem>}
                {userOptions.filter((u) => u.id !== user?.id).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        )}

        <FilterField label="Lead">
          <Select value={leadFilter} onValueChange={setLeadFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Lead" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os leads</SelectItem>
              {leadOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          <TaskKanbanColumn id="todo" title="A Fazer" count={columns.todo.length} variant="default">
            {columns.todo.map(renderCard)}
          </TaskKanbanColumn>

          <TaskKanbanColumn id="in_progress" title="Em Andamento" count={columns.in_progress.length} variant="warning">
            {columns.in_progress.map(renderCard)}
          </TaskKanbanColumn>

          <TaskKanbanColumn id="overdue" title="Atrasadas" count={columns.overdue.length} variant="danger">
            {columns.overdue.map(renderCard)}
          </TaskKanbanColumn>

          <TaskKanbanColumn id="completed" title="Concluídas" count={columns.completed.length} variant="success">
            {columns.completed.map(renderCard)}
          </TaskKanbanColumn>
        </div>

        <DragOverlay>
          {draggingTask && (
            <div className="rounded-lg border bg-card p-3 shadow-lg opacity-90 w-[260px]">
              <p className="text-sm font-medium">{draggingTask.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
