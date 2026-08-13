import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getNotificationRoute,
  getNotificationTitle,
  getNotificationVariant,
} from "@/lib/notification-routing";

export function RealtimeSync() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const channel = supabase
      .channel("global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-leads"] });
        queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
        queryClient.invalidateQueries({ queryKey: ["lead-cities"] });
        queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-all-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["lead-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["lead-tasks-summary"] });
        queryClient.invalidateQueries({ queryKey: ["briefing-team-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["briefing-overdue-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["briefing-today-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["briefing-completed-today-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["briefing-lead-tasks"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_notes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-notes"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-notes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => {
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
        queryClient.invalidateQueries({ queryKey: ["lead-next-meeting"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_boards" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kanban-boards"] });
        queryClient.invalidateQueries({ queryKey: ["kanban-boards-full"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_stage_history" }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-stage-history"] });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_documents" }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-documents"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_materials" }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-materials"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_score_results" }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-score-results"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload: any) => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["unread-suggestion-completed"] });

        if (payload.eventType !== "INSERT" || payload.new?.user_id !== user?.id) return;

        const n = payload.new;
        const variant = getNotificationVariant(n.type);
        const title = getNotificationTitle(n.type);
        const description = n.message ?? "";
        const route = getNotificationRoute(n);

        const onClick = route
          ? async () => {
              try {
                await supabase.from("notifications").update({ read: true }).eq("id", n.id);
              } catch {
                // ignore — navigation should still happen
              }
              navigate(route);
            }
          : undefined;

        const opts = {
          id: n.id as string,
          description,
          duration: 7000,
          ...(onClick ? { onClick } : {}),
        };

        if (variant === "success") toast.success(title, opts);
        else if (variant === "error") toast.error(title, opts);
        else if (variant === "warning") toast.warning(title, opts);
        else if (variant === "info") toast.info(title, opts);
        else toast(title, opts);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "global_kanban_settings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["global-kanban-settings"] });
        queryClient.invalidateQueries({ queryKey: ["lost-reasons"] });
        queryClient.invalidateQueries({ queryKey: ["stage-order"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_scores" }, () => {
        queryClient.invalidateQueries({ queryKey: ["ranking"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "doc_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["doc-requests"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "doc_request_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["doc-request-comments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "doc_request_files" }, () => {
        queryClient.invalidateQueries({ queryKey: ["doc-request-files"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "doc_request_checklist" }, () => {
        queryClient.invalidateQueries({ queryKey: ["doc-request-checklist"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "doc_request_history" }, () => {
        queryClient.invalidateQueries({ queryKey: ["doc-request-history"] });
        queryClient.invalidateQueries({ queryKey: ["doc-requests"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "doc_kanban_settings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["doc-kanban-settings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_database" }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-database"] });
        queryClient.invalidateQueries({ queryKey: ["lead-database-kpis"] });
        queryClient.invalidateQueries({ queryKey: ["lead-database-tags"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "prospeccao_leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["prospeccao-leads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "prospeccao_custom_options" }, () => {
        queryClient.invalidateQueries({ queryKey: ["prospeccao-custom-options"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id, navigate]);

  return null;
}
