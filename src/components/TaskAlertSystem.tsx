import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRankingEnabled } from "@/hooks/useRankingEnabled";

export function TaskAlertSystem() {
  const { user, hasElevatedAccess } = useAuth();
  const rankingEnabled = useRankingEnabled();
  const notifiedTaskIds = useRef<Set<string>>(new Set());
  const notifiedOverdueIds = useRef<Set<string>>(new Set());

  // Poll tasks due in next 15 minutes for the current user
  const { data: upcomingTasks = [] } = useQuery({
    queryKey: ["task-alerts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const now = new Date();
      const soon = new Date(now.getTime() + 15 * 60 * 1000);

      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, assigned_to, status")
        .eq("status", "pending")
        .eq("assigned_to", user.id)
        .gte("due_date", now.toISOString())
        .lte("due_date", soon.toISOString());

      return data || [];
    },
    refetchInterval: 60000,
    enabled: !!user,
  });

  // Poll overdue tasks to notify admins
  const { data: overdueTasks = [] } = useQuery({
    queryKey: ["overdue-task-alerts"],
    queryFn: async () => {
      if (!user) return [];
      const now = new Date();

      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, assigned_to, status")
        .eq("status", "pending")
        .lt("due_date", now.toISOString())
        .not("due_date", "is", null);

      return data || [];
    },
    refetchInterval: 120000,
    enabled: !!user,
  });

  // Show toast for upcoming tasks
  useEffect(() => {
    upcomingTasks.forEach((task) => {
      if (!notifiedTaskIds.current.has(task.id)) {
        notifiedTaskIds.current.add(task.id);
        toast.warning(`⏰ Tarefa próxima do vencimento: "${task.title}"`, {
          duration: 10000,
          description: task.due_date
            ? `Vence em ${new Date(task.due_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : undefined,
        });
      }
    });
  }, [upcomingTasks]);

  // Notify admin about overdue tasks
  useEffect(() => {
    if (!hasElevatedAccess || overdueTasks.length === 0) return;

    overdueTasks.forEach(async (task) => {
      if (notifiedOverdueIds.current.has(task.id)) return;
      notifiedOverdueIds.current.add(task.id);

      // Check if notification already exists for this task
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("source_id", task.id)
        .eq("type", "task_overdue")
        .limit(1);

      if (existing && existing.length > 0) return;

      // Get assignee name
      const { data: assignee } = await supabase
        .from("users")
        .select("name")
        .eq("id", task.assigned_to)
        .single();

      // Insert notification for the current admin
      if (user) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "task_overdue",
          source_id: task.id,
          message: `Tarefa atrasada: "${task.title}" — Responsável: ${assignee?.name || "Desconhecido"}`,
          metadata: { task_id: task.id, assigned_to: task.assigned_to },
        });

        // Also apply score penalty
        if (rankingEnabled) {
          await supabase.rpc("upsert_user_score", {
            p_user_id: task.assigned_to,
            p_earned: 0,
            p_deducted: 5,
            p_completed: 0,
            p_late: 1,
          });
        }
      }
    });
  }, [overdueTasks, hasElevatedAccess, user]);

  return null;
}
