import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Clock, User, Calendar, Eye, Plus, X } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DuplicateTask } from "@/lib/task-duplicates";

interface DuplicateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateTask[];
  onViewExisting: (task: DuplicateTask) => void;
  onCreateAnyway: () => void;
  isCreating?: boolean;
}

function getStatusBadge(task: DuplicateTask) {
  const isCompleted = task.status === "completed";
  if (isCompleted) return { label: "Concluída", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" };
  if (task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))) {
    return { label: "Atrasada", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
  }
  if (task.status === "in_progress") return { label: "Em Andamento", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
  return { label: "A Fazer", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
}

export function DuplicateTaskDialog({
  open,
  onOpenChange,
  duplicates,
  onViewExisting,
  onCreateAnyway,
  isCreating,
}: DuplicateTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[200] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[201] grid w-full max-w-xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Tarefa parecida já existe
            </DialogTitle>
            <DialogDescription>
              Encontramos {duplicates.length} tarefa{duplicates.length > 1 ? "s" : ""} pendente{duplicates.length > 1 ? "s" : ""} com título semelhante neste lead. Verifique antes de criar uma nova.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
            {duplicates.map((task) => {
              const status = getStatusBadge(task);
              return (
                <Card key={task.id} className="p-3 border-2 hover:border-primary/40 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-tight">{task.title}</p>
                      <Badge variant="outline" className={`text-[10px] shrink-0 border-0 ${status.className}`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      {task.assignee_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.assignee_name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.due_date), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Criada em {format(new Date(task.created_at), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 h-8"
                      onClick={() => onViewExisting(task)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver tarefa existente
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={onCreateAnyway} disabled={isCreating} variant="secondary" className="gap-2">
              <Plus className="h-4 w-4" />
              {isCreating ? "Criando..." : "Criar mesmo assim"}
            </Button>
          </DialogFooter>

          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
