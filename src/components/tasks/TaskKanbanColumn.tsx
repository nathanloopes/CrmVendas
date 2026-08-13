import { useDroppable } from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TaskKanbanColumnProps {
  id: string;
  title: string;
  count: number;
  variant?: "default" | "danger" | "success" | "warning" | "purple";
  children: React.ReactNode;
}

const variantStyles = {
  default: {
    border: "border-t-primary",
    title: "text-primary",
    badge: "bg-primary/10 text-primary",
  },
  warning: {
    border: "border-t-yellow-500",
    title: "text-yellow-600",
    badge: "bg-yellow-500/10 text-yellow-600",
  },
  danger: {
    border: "border-t-destructive",
    title: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
  purple: {
    border: "border-t-purple-500",
    title: "text-purple-600",
    badge: "bg-purple-500/10 text-purple-600",
  },
  success: {
    border: "border-t-green-500",
    title: "text-green-600",
    badge: "bg-green-500/10 text-green-600",
  },
};

export function TaskKanbanColumn({ id, title, count, variant = "default", children }: TaskKanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const styles = variantStyles[variant];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl bg-muted/30 min-w-[280px] w-[280px] shrink-0 border-t-4 overflow-hidden",
        styles.border,
        isOver && "ring-2 ring-primary/30 bg-primary/5"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className={cn("text-[11px] font-bold uppercase tracking-wider", styles.title)}>
          {title}
        </h3>
        <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5", styles.badge)}>
          {count}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-340px)]">
        <div className="px-2 pb-2 space-y-2 min-h-[60px]">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
