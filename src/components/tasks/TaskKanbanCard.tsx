import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, MessageCircle, AlertTriangle, Target, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Task = Tables<"tasks">;
type TaskMetadata = {
  ai_role?: string;
  crm_funcao?: string;
  criterio_conclusao?: string;
};
const normalizeRole = (r?: string | null) => (r || "").toLowerCase().trim();

interface TaskKanbanCardProps {
  task: Task;
  leadName?: string;
  assigneeName?: string;
  checklistTotal?: number;
  checklistDone?: number;
  commentCount?: number;
  onClick: (task: Task) => void;
  onLeadClick: (leadId: string) => void;
}

export function TaskKanbanCard({
  task,
  leadName,
  assigneeName,
  checklistTotal = 0,
  checklistDone = 0,
  commentCount = 0,
  onClick,
  onLeadClick,
}: TaskKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  const isCompleted = task.status === "completed";
  const isOverdue = task.due_date && !isCompleted && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const isDueToday = task.due_date && !isCompleted && isToday(new Date(task.due_date));

  const initials = assigneeName
    ? assigneeName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  // Status dot color
  const dotColor = isOverdue
    ? "bg-destructive"
    : isDueToday
    ? "bg-yellow-500"
    : isCompleted
    ? "bg-green-500"
    : "bg-muted-foreground/30";

  // Relative time label
  const timeLabel = (() => {
    if (!task.due_date) return null;
    const dueDate = new Date(task.due_date);
    if (isCompleted) return null;
    try {
      const dist = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
      return { text: dist, overdue: isOverdue };
    } catch {
      return null;
    }
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all hover:shadow-md space-y-2",
        isDragging && "opacity-50 shadow-lg",
        isOverdue && !isCompleted && "border-destructive/30"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(task);
      }}
    >
      {/* Title row with status dot */}
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", dotColor)} />
        <p className="text-sm font-medium leading-tight line-clamp-2 flex-1">{task.title}</p>
        {isCompleted && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        )}
      </div>

      {/* Lead link */}
      {leadName && task.lead_id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLeadClick(task.lead_id!);
          }}
          className="text-[11px] text-muted-foreground hover:text-primary hover:underline truncate block max-w-full text-left pl-4"
        >
          {leadName}
        </button>
      )}
      {!task.lead_id && (
        <p className="text-[11px] text-muted-foreground/70 italic pl-4">Tarefa interna</p>
      )}

      {/* Description snippet */}
      {task.description && (
        <p className="text-[11px] text-muted-foreground/70 line-clamp-2 pl-4">{task.description}</p>
      )}

      {/* Tags row */}
      <div className="flex items-center gap-1.5 flex-wrap pl-4">
        {task.type === "lead" && (
          <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-[10px] font-medium">
            Franqueado
          </span>
        )}
        {assigneeName && (
          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium truncate max-w-[120px]">
            {assigneeName}
          </span>
        )}
        {task.priority === "high" && (
          <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-medium">
            Alta
          </span>
        )}
        {(() => {
          const meta = (task.metadata as TaskMetadata) || {};
          const aiRole = meta.ai_role;
          const crmFuncao = meta.crm_funcao;
          const hasDoD = !!meta.criterio_conclusao;
          const mismatch =
            aiRole && crmFuncao &&
            normalizeRole(aiRole) !== "lead" &&
            normalizeRole(aiRole) !== normalizeRole(crmFuncao);
          if (!aiRole && !crmFuncao && !hasDoD) return null;
          return (
            <TooltipProvider delayDuration={150}>
              {aiRole && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 text-[10px] font-medium">
                      <Sparkles className="h-2.5 w-2.5" />
                      {aiRole}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Papel sugerido pela IA: {aiRole}</TooltipContent>
                </Tooltip>
              )}
              {crmFuncao && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-medium">
                      {crmFuncao}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Função do executor no CRM: {crmFuncao}</TooltipContent>
                </Tooltip>
              )}
              {mismatch && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>Papel sugerido pela IA difere da função do executor no CRM</TooltipContent>
                </Tooltip>
              )}
              {hasDoD && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Target className="h-3 w-3 text-green-600" />
                  </TooltipTrigger>
                  <TooltipContent>Tarefa possui Critério de Conclusão definido</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          );
        })()}
      </div>

      {/* Bottom row: meta + avatar */}
      <div className="flex items-center justify-between gap-1 pl-4">
        <div className="flex items-center gap-2.5">
          {/* Checklist */}
          {checklistTotal > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              {checklistDone}/{checklistTotal} ✓
            </span>
          )}

          {/* Comments */}
          {commentCount > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" /> {commentCount}
            </span>
          )}

          {/* Time label */}
          {timeLabel && (
            <span
              className={cn(
                "text-[11px] flex items-center gap-0.5",
                timeLabel.overdue ? "text-destructive font-medium" : "text-muted-foreground"
              )}
            >
              <Clock className="h-3 w-3" />
              {timeLabel.text}
            </span>
          )}
        </div>

        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[9px] bg-muted">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
