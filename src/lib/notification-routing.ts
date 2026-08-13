/**
 * Shared routing logic for notifications.
 * Used by both NotificationBell (click handler) and RealtimeSync (toast click).
 */

export interface NotificationLike {
  id: string;
  type: string;
  source_id?: string | null;
  metadata?: Record<string, any> | null;
  message?: string | null;
}

export type NotificationVariant = "success" | "error" | "warning" | "info" | "default";

/** Returns the route path to navigate to when a notification is clicked, or null if no destination. */
export function getNotificationRoute(n: NotificationLike): string | null {
  const meta = (n.metadata ?? {}) as Record<string, any>;

  if (!n.source_id) return null;

  if (meta.type === "task_comment_mention" && meta.task_id) {
    return `/tasks?openTask=${meta.task_id}`;
  }
  if (meta.type === "task_comment" && meta.task_id) {
    return `/tasks?openTask=${meta.task_id}`;
  }
  if (meta.type === "task_completed") {
    return `/tasks?openTask=${n.source_id}`;
  }
  if (n.type === "stage_move" || n.type === "stage_change") {
    return `/leads?openLead=${n.source_id}&openTab=dados`;
  }
  return `/leads?openLead=${n.source_id}&openTab=notas`;
}

/** Maps a notification type to the visual variant for the toast. */
export function getNotificationVariant(type: string): NotificationVariant {
  if (type === "task_completed") return "success";
  if (type === "task_overdue") return "error";
  if (
    type === "mention" ||
    type === "stage_move" ||
    type === "stage_change" ||
    type === "task_due" ||
    type === "task_assigned"
  ) {
    return "info";
  }
  return "default";
}

/** Returns a short, friendly title for the toast based on type. */
export function getNotificationTitle(type: string): string {
  if (type === "mention") return "Você foi mencionado";
  if (type === "task_overdue") return "Tarefa atrasada";
  if (type === "task_due") return "Tarefa próxima do prazo";
  if (type === "task_assigned") return "Nova tarefa atribuída";
  if (type === "task_completed") return "Tarefa concluída";
  if (type === "stage_move" || type === "stage_change") return "Lead movimentado";
  if (type === "new_lead") return "Novo lead";
  return "Nova notificação";
}
