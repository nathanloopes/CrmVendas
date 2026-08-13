import { useState, useMemo } from "react";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { DuplicateTaskDialog } from "@/components/tasks/DuplicateTaskDialog";
import { findDuplicateTasks, type DuplicateTask } from "@/lib/task-duplicates";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, ChevronDown, ChevronRight, CheckCircle2, Trash2, Plus,
  AlertTriangle, Clock, Calendar, Flame, TrendingUp, Phone, MessageCircle,
  Video, FileText, Search, ArrowRight, Users, BarChart3, AlertCircle, Zap
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, differenceInDays, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useRankingEnabled } from "@/hooks/useRankingEnabled";

interface LeadTasksProps {
  leadId: string;
  leadName?: string | null;
}

const TASK_TYPES = [
  { value: "call", label: "Ligação", icon: Phone, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  { value: "meeting", label: "Reunião", icon: Video, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { value: "proposal", label: "Proposta", icon: FileText, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "contract", label: "Contrato", icon: FileText, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  { value: "research", label: "Pesquisa", icon: Search, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  { value: "follow_up", label: "Follow-up", icon: ArrowRight, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  { value: "financial", label: "Financeiro", icon: BarChart3, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { value: "documentation", label: "Documentação", icon: FileText, color: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300" },
];

const PRIORITY_CONFIG = {
  high: { label: "Alta", border: "border-l-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", dot: "bg-red-500" },
  medium: { label: "Média", border: "border-l-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dot: "bg-amber-500" },
  low: { label: "Baixa", border: "border-l-blue-400", badge: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300", dot: "bg-blue-400" },
};

function getTaskTypeConfig(type: string | null) {
  if (!type) return null;
  return TASK_TYPES.find(t => t.value === type || t.label.toLowerCase() === type.toLowerCase());
}

function getDueDateInfo(dueDate: string | null, isCompleted: boolean) {
  if (!dueDate || isCompleted) return null;
  const date = new Date(dueDate);
  const now = new Date();
  const diffDays = differenceInCalendarDays(date, now);

  if (diffDays < 0) return { text: `Atrasada há ${Math.abs(diffDays)} dia${Math.abs(diffDays) > 1 ? "s" : ""}`, color: "text-red-600 dark:text-red-400", urgent: true };
  if (diffDays === 0) return { text: "Vence hoje", color: "text-orange-600 dark:text-orange-400", urgent: true };
  if (diffDays === 1) return { text: "Vence amanhã", color: "text-amber-600 dark:text-amber-400", urgent: false };
  return { text: `${diffDays} dias restantes`, color: "text-muted-foreground", urgent: false };
}

function isAncientTask(createdAt: string) {
  const year = new Date(createdAt).getFullYear();
  const currentYear = new Date().getFullYear();
  return currentYear - year >= 2;
}

function TaskCard({ task, onToggle, onDelete, usersMap, onClickTask }: {
  task: any;
  onToggle: (taskId: string, completed: boolean, assignedTo: string, dueDate: string | null) => void;
  onDelete: (task: any) => void;
  usersMap: Record<string, string>;
  onClickTask?: (task: any) => void;
}) {
  const isCompleted = task.status === "completed";
  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const typeConfig = getTaskTypeConfig(task.type);
  const dueDateInfo = getDueDateInfo(task.due_date, isCompleted);
  const ancient = isAncientTask(task.created_at);
  const isLeadType = task.type === "lead";
  const TypeIcon = typeConfig?.icon;

  return (
    <div
      className={`group relative flex items-start gap-3 p-3.5 rounded-xl border-l-4 bg-card border border-border/60 transition-all duration-200 hover:shadow-md hover:border-border cursor-pointer ${
        isCompleted ? "opacity-50 border-l-green-400" : priority.border
      }`}
      onClick={() => onClickTask?.(task)}
    >
      {ancient && !isCompleted && (
        <div className="absolute -top-2 right-3 flex items-center gap-1 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px] font-medium px-2 py-0.5 rounded-full">
          <AlertTriangle className="h-3 w-3" /> Tarefa antiga
        </div>
      )}

      <div className="pt-0.5">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={(checked) => onToggle(task.id, !!checked, task.assigned_to, task.due_date)}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 rounded-full border-2 transition-all duration-200 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
        />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-tight ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(task); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {!isCompleted && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 font-medium ${priority.badge}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${priority.dot}`} />
              {priority.label}
            </Badge>
          )}

          {typeConfig && !isLeadType && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 font-medium ${typeConfig.color}`}>
              {TypeIcon && <TypeIcon className="h-3 w-3 mr-0.5" />}
              {typeConfig.label}
            </Badge>
          )}

          {isLeadType && (
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-0 text-[10px] px-1.5 py-0">
              Lead
            </Badge>
          )}

          {task.due_date && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), "dd/MM/yy HH:mm", { locale: ptBR })}
            </span>
          )}

          {dueDateInfo && (
            <span className={`text-[11px] font-medium ${dueDateInfo.color}`}>
              {dueDateInfo.urgent && "🔥 "}{dueDateInfo.text}
            </span>
          )}

          {usersMap[task.assigned_to] && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <Users className="h-3 w-3" />
              {usersMap[task.assigned_to]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskSection({ title, icon: Icon, tasks, color, defaultOpen = true, onToggle, onDelete, usersMap, onClickTask }: {
  title: string;
  icon: any;
  tasks: any[];
  color: string;
  defaultOpen?: boolean;
  onToggle: (taskId: string, completed: boolean, assignedTo: string, dueDate: string | null) => void;
  onDelete: (task: any) => void;
  usersMap: Record<string, string>;
  onClickTask?: (task: any) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (tasks.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-1 text-sm font-semibold hover:bg-muted/40 rounded-lg transition-colors">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Icon className={`h-4 w-4 ${color}`} />
        <span>{title}</span>
        <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-5">{tasks.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-1 ml-1">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} usersMap={usersMap} onClickTask={onClickTask} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

type FilterType = "all" | "overdue" | "today" | "high" | string;

export function LeadTasks({ leadId, leadName }: LeadTasksProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const rankingEnabled = useRankingEnabled();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "", assigned_to: "", task_type: "" });
  const [duplicates, setDuplicates] = useState<DuplicateTask[]>([]);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [checkingDup, setCheckingDup] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["lead-tasks", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("lead_id", leadId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: usersMap = {} } = useQuery({
    queryKey: ["users-map-lead-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("status", "active");
      const map: Record<string, string> = {};
      (data || []).forEach((u) => { map[u.id] = u.name; });
      return map;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-select"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
    enabled: showAddDialog,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ taskId, completed, assignedTo, dueDate }: { taskId: string; completed: boolean; assignedTo: string; dueDate: string | null }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: completed ? "completed" : "pending",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", taskId);
      if (error) throw error;

      if (rankingEnabled && completed && assignedTo) {
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
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
    },
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (task: any) => {
      if (task.calendar_event_id) {
        await supabase.from("calendar_events").delete().eq("id", task.calendar_event_id);
      }
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Tarefa excluída");
    },
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const isLeadTask = form.assigned_to.startsWith("lead:");
      const assignee = isLeadTask ? user.id : (form.assigned_to || user.id);
      const { error } = await supabase.from("tasks").insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        lead_id: leadId,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assigned_to: assignee,
        created_by: user.id,
        type: isLeadTask ? "lead" : (form.task_type || "team"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada");
      setForm({ title: "", description: "", priority: "medium", due_date: "", assigned_to: "", task_type: "" });
      setShowAddDialog(false);
      setShowDupDialog(false);
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const handleCreateClick = async () => {
    if (!form.title) return;
    setCheckingDup(true);
    try {
      const dups = await findDuplicateTasks({ leadId, title: form.title });
      if (dups.length > 0) {
        setDuplicates(dups);
        setShowAddDialog(false);
        setShowDupDialog(true);
        return;
      }
      createMutation.mutate();
    } finally {
      setCheckingDup(false);
    }
  };

  const handleDupDialogChange = (open: boolean) => {
    setShowDupDialog(open);
    if (!open && form.title) {
      setShowAddDialog(true);
    }
  };

  const handleViewExistingDup = async (task: DuplicateTask) => {
    if (user && task.assigned_to && task.assigned_to !== user.id) {
      await supabase.rpc("create_notification", {
        p_user_id: task.assigned_to,
        p_type: "task_assigned",
        p_message: `Outro usuário tentou criar uma tarefa parecida no lead "${leadName || "Lead"}"`,
        p_source_id: task.id,
        p_metadata: { leadId, taskId: task.id, duplicate_attempt: true } as any,
      });
    }
    const { data: fullTask } = await supabase.from("tasks").select("*").eq("id", task.id).single();
    setShowDupDialog(false);
    if (fullTask) setSelectedTask(fullTask);
  };

  const handleToggle = (taskId: string, completed: boolean, assignedTo: string, dueDate: string | null) => {
    toggleMutation.mutate({ taskId, completed, assignedTo, dueDate });
  };

  // Computed data
  const computed = useMemo(() => {
    const now = new Date();
    const pending = tasks.filter(t => t.status !== "completed");
    const completed = tasks.filter(t => t.status === "completed");
    const overdue = pending.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    const today = pending.filter(t => t.due_date && isToday(new Date(t.due_date)));
    const upcoming = pending.filter(t => t.due_date && !isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    const noDue = pending.filter(t => !t.due_date);
    const hasFuture = pending.some(t => t.due_date && new Date(t.due_date) > now);

    // Next urgent action: overdue first, then today, sorted by date
    const nextAction = [...overdue, ...today].sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    })[0] || null;

    // Performance
    const executionRate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
    const completedWithTime = completed.filter(t => t.completed_at && t.created_at);
    const avgDays = completedWithTime.length > 0
      ? Math.round(completedWithTime.reduce((sum, t) => sum + differenceInDays(new Date(t.completed_at!), new Date(t.created_at)), 0) / completedWithTime.length)
      : 0;

    return { pending, completed, overdue, today, upcoming, noDue, nextAction, executionRate, avgDays, hasFuture };
  }, [tasks]);

  // Filter logic
  const getFilteredSections = () => {
    if (activeFilter === "overdue") return { overdue: computed.overdue, today: [], upcoming: [], noDue: [] };
    if (activeFilter === "today") return { overdue: [], today: computed.today, upcoming: [], noDue: [] };
    if (activeFilter === "high") {
      const f = (arr: any[]) => arr.filter(t => t.priority === "high");
      return { overdue: f(computed.overdue), today: f(computed.today), upcoming: f(computed.upcoming), noDue: f(computed.noDue) };
    }
    return { overdue: computed.overdue, today: computed.today, upcoming: computed.upcoming, noDue: computed.noDue };
  };

  const sections = getFilteredSections();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Total", value: tasks.length, color: "text-foreground", bg: "bg-muted/50" },
          { label: "Pendentes", value: computed.pending.length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
          { label: "Atrasadas", value: computed.overdue.length, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
          { label: "Hoje", value: computed.today.length, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
          { label: "Concluídas", value: computed.completed.length, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" },
        ].map(kpi => (
          <div key={kpi.label} className={`rounded-lg p-2.5 text-center ${kpi.bg}`}>
            <p className={`text-lg font-bold leading-none ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Next Action Banner */}
      {computed.nextAction && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-200/60 dark:border-red-800/40">
          <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <Flame className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Próxima ação</p>
            <p className="text-sm font-semibold text-foreground truncate">{computed.nextAction.title}</p>
            {computed.nextAction.due_date && (
              <p className="text-[11px] text-red-500 dark:text-red-400 font-medium">
                {getDueDateInfo(computed.nextAction.due_date, false)?.text}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
            onClick={() => handleToggle(computed.nextAction.id, true, computed.nextAction.assigned_to, computed.nextAction.due_date)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
          </Button>
        </div>
      )}

      {/* Smart Alerts */}
      {computed.pending.length > 0 && !computed.hasFuture && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Este lead está sem tarefa futura agendada</span>
        </div>
      )}
      {computed.overdue.length >= 3 && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 text-red-700 dark:text-red-300 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{computed.overdue.length} tarefas vencidas — ação urgente necessária</span>
        </div>
      )}

      {/* Filters + New Task */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "all", label: "Todas" },
            { key: "overdue", label: `Atrasadas (${computed.overdue.length})` },
            { key: "today", label: `Hoje (${computed.today.length})` },
            { key: "high", label: "Alta prioridade" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key as FilterType)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                activeFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} className="text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova Tarefa
        </Button>
      </div>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="text-center py-10 space-y-2">
          <div className="h-12 w-12 mx-auto rounded-full bg-muted/60 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma tarefa vinculada a este lead.</p>
          <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira tarefa
          </Button>
        </div>
      )}

      {/* Task Sections */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <TaskSection title="Atrasadas" icon={AlertTriangle} tasks={sections.overdue} color="text-red-500" onToggle={handleToggle} onDelete={(t) => deleteMutation.mutate(t)} usersMap={usersMap} onClickTask={setSelectedTask} />
          <TaskSection title="Hoje" icon={Zap} tasks={sections.today} color="text-orange-500" onToggle={handleToggle} onDelete={(t) => deleteMutation.mutate(t)} usersMap={usersMap} onClickTask={setSelectedTask} />
          <TaskSection title="Próximas" icon={Clock} tasks={sections.upcoming} color="text-blue-500" onToggle={handleToggle} onDelete={(t) => deleteMutation.mutate(t)} usersMap={usersMap} onClickTask={setSelectedTask} />
          <TaskSection title="Sem prazo" icon={Calendar} tasks={sections.noDue} color="text-muted-foreground" onToggle={handleToggle} onDelete={(t) => deleteMutation.mutate(t)} usersMap={usersMap} onClickTask={setSelectedTask} />

          {/* Completed (collapsible, filtered out when specific filter active) */}
          {activeFilter === "all" && computed.completed.length > 0 && (
            <TaskSection
              title="Concluídas"
              icon={CheckCircle2}
              tasks={computed.completed}
              color="text-green-500"
              defaultOpen={false}
              onToggle={handleToggle}
              onDelete={(t) => deleteMutation.mutate(t)}
              usersMap={usersMap}
              onClickTask={setSelectedTask}
            />
          )}
        </div>
      )}

      {/* Performance Panel */}
      {tasks.length >= 3 && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Performance
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Taxa de execução</span>
              <span className="font-bold text-foreground">{computed.executionRate}%</span>
            </div>
            <Progress value={computed.executionRate} className="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{computed.avgDays}d</p>
              <p className="text-[10px] text-muted-foreground">Tempo médio</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${computed.overdue.length > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{computed.overdue.length}</p>
              <p className="text-[10px] text-muted-foreground">Vencidas</p>
            </div>
          </div>
        </div>
      )}

      {/* New Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="z-[100] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Enviar proposta comercial" />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Observações adicionais..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 Alta</SelectItem>
                    <SelectItem value="medium">🟡 Média</SelectItem>
                    <SelectItem value="low">🔵 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Vencimento</Label>
              <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Responsável</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="Eu mesmo (padrão)" /></SelectTrigger>
                <SelectContent>
                  {leadName && (
                    <SelectItem value={`lead:${leadId}`}>
                      📋 {leadName} (Lead)
                    </SelectItem>
                  )}
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">— Equipe —</div>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateClick} disabled={!form.title || createMutation.isPending || checkingDup}>
              {checkingDup ? "Verificando..." : createMutation.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateTaskDialog
        open={showDupDialog}
        onOpenChange={handleDupDialogChange}
        duplicates={duplicates}
        onViewExisting={handleViewExistingDup}
        onCreateAnyway={() => createMutation.mutate()}
        isCreating={createMutation.isPending}
      />

      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
