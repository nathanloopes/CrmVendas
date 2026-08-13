import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useRankingEnabled } from "@/hooks/useRankingEnabled";

type Task = Tables<"tasks">;

interface TaskListProps {
  tasks: Task[];
  showAssignee?: boolean;
  onTaskClick?: (task: Task) => void;
}

export function TaskList({ tasks, showAssignee = false, onTaskClick }: TaskListProps) {
  const queryClient = useQueryClient();
  const rankingEnabled = useRankingEnabled();

  const { data: usersMap = {} } = useQuery({
    queryKey: ["users-map"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name");
      const map: Record<string, string> = {};
      (data || []).forEach((u) => { map[u.id] = u.name; });
      return map;
    },
    enabled: showAssignee,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed, assignedTo, dueDate, taskType }: { id: string; completed: boolean; assignedTo: string; dueDate: string | null; taskType: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: completed ? "completed" : "pending",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;

      // Don't score lead-responsibility tasks
      if (rankingEnabled && completed && assignedTo && taskType !== "lead") {
        const isLate = dueDate ? isPast(new Date(dueDate)) : false;
        await supabase.rpc("upsert_user_score", {
          p_user_id: assignedTo,
          p_earned: isLate ? 3 : 10,
          p_deducted: isLate ? 5 : 0,
          p_completed: 1,
          p_late: isLate ? 1 : 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
    },
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (task: Task) => {
      // Delete linked calendar event if exists
      if ((task as any).calendar_event_id) {
        await supabase.from("calendar_events").delete().eq("id", (task as any).calendar_event_id);
      }
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["lead-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Tarefa excluída");
    },
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  if (tasks.length === 0) {
    return <p className="text-center text-muted-foreground py-12">Nenhuma tarefa encontrada.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead>Título</TableHead>
          {showAssignee && <TableHead>Responsável</TableHead>}
          <TableHead>Vencimento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const isCompleted = task.status === "completed";
          const isOverdue = task.due_date && !isCompleted && isPast(new Date(task.due_date));

          return (
            <TableRow key={task.id} className={`${isCompleted ? "opacity-60" : ""} cursor-pointer hover:bg-muted/50`} onClick={() => onTaskClick?.(task)}>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ id: task.id, completed: !!checked, assignedTo: task.assigned_to, dueDate: task.due_date, taskType: task.type })
                  }
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className={isCompleted ? "line-through" : ""}>{task.title}</span>
                  {task.type === "lead" && task.lead_id && (
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-0 text-xs px-1.5 py-0">Lead</Badge>
                  )}
                  {!task.lead_id && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">Interna</Badge>
                  )}
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{task.description}</p>
                )}
              </TableCell>
              {showAssignee && (
                <TableCell>
                  <span className="text-sm">{usersMap[task.assigned_to] || "—"}</span>
                </TableCell>
              )}
              <TableCell>
                {task.due_date ? (
                  <div>
                    <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      {isOverdue && " ⚠️"}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(task.due_date), "HH:mm")}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={isCompleted ? "secondary" : "outline"}>
                  {isCompleted ? "Concluída" : "Pendente"}
                </Badge>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(task)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
