import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRankingEnabled } from "@/hooks/useRankingEnabled";
import { useRecalculateLeadScore } from "@/hooks/useRecalculateLeadScore";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format, isPast, isToday, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Clock, AlertTriangle, ExternalLink, Plus,
  Trash2, Edit2, Play, Send, Calendar, User, UserPlus, FileText, Briefcase, Sparkles, Target
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getStageLabel } from "@/lib/stage-labels";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Task = Tables<"tasks">;

type TaskMetadata = {
  ai_role?: string;
  crm_funcao?: string;
  criterio_conclusao?: string;
  passos_execucao?: string[];
  descricao_detalhada?: string;
};

const normalizeRole = (r?: string | null) => (r || "").toLowerCase().trim();
const isLeadRole = (r?: string | null) => normalizeRole(r) === "lead";

interface TaskDetailSheetProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailSheet({ task: taskProp, onClose }: TaskDetailSheetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recalcScore = useRecalculateLeadScore();
  const rankingEnabled = useRankingEnabled();
  const [newCheckItem, setNewCheckItem] = useState("");
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", due_date: "", assigned_to: "" });

  // Fetch fresh task data to keep UI in sync after edits
  const { data: freshTask } = useQuery({
    queryKey: ["task-detail", taskProp?.id],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("id", taskProp!.id).single();
      return data as Task | null;
    },
    enabled: !!taskProp?.id,
  });

  const task = freshTask ?? taskProp;

  const isOpen = !!task;
  const isCompleted = task?.status === "completed";
  const isOverdue = task?.due_date && !isCompleted && isPast(new Date(task.due_date));
  const isDueToday = task?.due_date && !isCompleted && isToday(new Date(task.due_date));
  const isUrgent = isOverdue || isDueToday;

  // Lead data (name + stage)
  const { data: leadData } = useQuery({
    queryKey: ["lead-detail-for-task", task?.lead_id],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, name, stage, board_id").eq("id", task!.lead_id).single();
      return data;
    },
    enabled: !!task?.lead_id,
  });

  const leadName = leadData?.name || "Sem nome";

  // Stages for lead's board
  const { data: stagesData } = useQuery({
    queryKey: ["lead-board-stages", leadData?.board_id],
    queryFn: async () => {
      if (leadData?.board_id) {
        const { data } = await supabase.from("kanban_boards").select("stage_order, custom_labels").eq("id", leadData.board_id).single();
        return { stages: data?.stage_order || [], customLabels: (data?.custom_labels as Record<string, string>) || {} };
      }
      const { data } = await supabase.from("global_kanban_settings").select("stage_order, custom_labels").eq("id", "00000000-0000-0000-0000-000000000000").single();
      return { stages: data?.stage_order || [], customLabels: (data?.custom_labels as Record<string, string>) || {} };
    },
    enabled: !!leadData,
  });

  // Lead stage change mutation
  const changeLeadStage = useMutation({
    mutationFn: async (newStage: string) => {
      if (!leadData || !user) return;
      const oldStage = leadData.stage || "";
      await supabase.from("leads").update({ stage: newStage, updated_at: new Date().toISOString() }).eq("id", leadData.id);
      if (oldStage && oldStage !== newStage) {
        await supabase.from("lead_stage_history").insert({
          lead_id: leadData.id,
          old_stage: oldStage,
          new_stage: newStage,
          changed_by: user.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-detail-for-task", task?.lead_id] });
      // Regra automática: stage mudou → score recalcula
      if (leadData?.id) recalcScore.mutate(leadData.id);
      toast.success("Status do lead atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status do lead"),
  });

  // Users map
  const { data: usersRaw = [] } = useQuery({
    queryKey: ["users-map-detail"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name");
      return data || [];
    },
    enabled: isOpen,
  });

  const safeUsersRaw = Array.isArray(usersRaw) ? usersRaw : [];

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    safeUsersRaw.forEach((u) => { map[u.id] = u.name; });
    return map;
  }, [safeUsersRaw]);

  // Users list for edit
  const { data: usersList = [] } = useQuery({
    queryKey: ["users-select"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
    enabled: editing,
  });

  // Checklist
  const { data: checkItems = [] } = useQuery({
    queryKey: ["task-checklist", task?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", task!.id)
        .order("sort_order");
      return data || [];
    },
    enabled: isOpen,
  });

  // Comments
  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", task?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", task!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isOpen,
  });

  // History
  const { data: history = [] } = useQuery({
    queryKey: ["task-history", task?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_history")
        .select("*")
        .eq("task_id", task!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isOpen,
  });

  const checklistProgress = useMemo(() => {
    if (checkItems.length === 0) return 0;
    return Math.round((checkItems.filter((i) => i.completed).length / checkItems.length) * 100);
  }, [checkItems]);

  const timeOpen = useMemo(() => {
    if (!task?.created_at) return "";
    const days = differenceInDays(new Date(), new Date(task.created_at));
    const hours = differenceInHours(new Date(), new Date(task.created_at)) % 24;
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  }, [task?.created_at]);

  // --- Mutations ---

  const hasUncheckedItems = checkItems.length > 0 && checkItems.some(i => !i.completed);

  const toggleCheckItem = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await supabase.from("task_checklist_items").update({
        completed,
        completed_by: completed ? user!.id : null,
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", id);

      // If unchecking an item on a completed task, reopen it
      if (!completed && task?.status === "completed" && user) {
        await supabase.from("tasks").update({
          status: "in_progress",
          completed_at: null,
        }).eq("id", task.id);

        await supabase.from("task_history").insert({
          task_id: task.id,
          user_id: user.id,
          action: "status_change",
          details: "Tarefa reaberta automaticamente — checklist incompleto",
        });

        // Revert ranking points if enabled
        if (rankingEnabled && task.type !== "lead") {
          const wasLate = task.due_date ? isPast(new Date(task.due_date)) : false;
          await supabase.rpc("upsert_user_score", {
            p_user_id: task.assigned_to,
            p_earned: wasLate ? -3 : -10,
            p_deducted: wasLate ? -5 : 0,
            p_completed: -1,
            p_late: wasLate ? -1 : 0,
          });
        }

        toast.info("Tarefa reaberta — checklist incompleto");
      }
    },
    onMutate: async ({ id, completed }) => {
      // Optimistic update so hasUncheckedItems reflects immediately
      await queryClient.cancelQueries({ queryKey: ["task-checklist", task?.id] });
      const previous = queryClient.getQueryData<any[]>(["task-checklist", task?.id]);
      queryClient.setQueryData(["task-checklist", task?.id], (old: any[] | undefined) =>
        old?.map((item) => item.id === id ? { ...item, completed } : item) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["task-checklist", task?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-history", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
    },
  });

  const addCheckItem = useMutation({
    mutationFn: async () => {
      if (!newCheckItem.trim() || !task) return;
      await supabase.from("task_checklist_items").insert({
        task_id: task.id,
        text: newCheckItem.trim(),
        created_by: user!.id,
        sort_order: checkItems.length,
      });
    },
    onSuccess: () => {
      setNewCheckItem("");
      queryClient.invalidateQueries({ queryKey: ["task-checklist", task?.id] });
    },
  });

  const deleteCheckItem = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("task_checklist_items").delete().eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-checklist", task?.id] }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!comment.trim() || !task || !user) return;
      const commentText = comment.trim();
      await supabase.from("task_comments").insert({
        task_id: task.id,
        user_id: user.id,
        content: commentText,
      });
      // History
      await supabase.from("task_history").insert({
        task_id: task.id,
        user_id: user.id,
        action: "comment",
        details: commentText,
      });
      // Notify assigned_to (only if not mentioned separately)
      if (task.assigned_to && task.assigned_to !== user.id && !mentionedUserIds.includes(task.assigned_to)) {
        await supabase.rpc("create_notification", {
          p_user_id: task.assigned_to,
          p_type: "system",
          p_message: `Novo comentário na tarefa "${task.title}"`,
          p_source_id: task.id,
          p_metadata: { type: "task_comment", task_id: task.id },
        });
      }
      // Notify mentioned users
      const myName = usersMap[user.id] || "Alguém";
      for (const uid of mentionedUserIds) {
        if (uid === user.id) continue;
        await supabase.rpc("create_notification", {
          p_user_id: uid,
          p_type: "mention",
          p_message: `${myName} mencionou você em um comentário da tarefa "${task.title}"`,
          p_source_id: task.id,
          p_metadata: { type: "task_comment_mention", task_id: task.id },
        });
      }
    },
    onSuccess: () => {
      setComment("");
      setMentionedUserIds([]);
      setShowMentionDropdown(false);
      queryClient.invalidateQueries({ queryKey: ["task-comments", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["task-history", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const changeStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!task || !user) return;
      const updates: any = { status: newStatus };
      if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }
      const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
      if (error) throw error;

      // History
      await supabase.from("task_history").insert({
        task_id: task.id,
        user_id: user.id,
        action: "status_change",
        details: `Status alterado para ${newStatus === "completed" ? "concluída" : newStatus === "in_progress" ? "em andamento" : "pendente"}${feedback ? ` — Feedback: ${feedback}` : ""}`,
      });

      // Ranking score on complete
      if (newStatus === "completed" && rankingEnabled && task.type !== "lead") {
        const isLate = task.due_date ? isPast(new Date(task.due_date)) : false;
        await supabase.rpc("upsert_user_score", {
          p_user_id: task.assigned_to,
          p_earned: isLate ? 3 : 10,
          p_deducted: isLate ? 5 : 0,
          p_completed: 1,
          p_late: isLate ? 1 : 0,
        });
        setPointsEarned(isLate ? 3 : 10);
        setShowPoints(true);
        setTimeout(() => setShowPoints(false), 3000);
      }

      // Notify creator
      if (newStatus === "completed" && task.created_by !== user.id) {
        await supabase.rpc("create_notification", {
          p_user_id: task.created_by,
          p_type: "system",
          p_message: `Tarefa "${task.title}" foi concluída`,
          p_source_id: task.id,
          p_metadata: { type: "task_completed" },
        });
      }
    },
    onSuccess: (_, newStatus) => {
      setShowFeedback(false);
      setFeedback("");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-history", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(newStatus === "completed" ? "Tarefa concluída!" : "Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      if (task.calendar_event_id) {
        await supabase.from("calendar_events").delete().eq("id", task.calendar_event_id);
      }
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Tarefa excluída");
      onClose();
    },
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!task || !user) return;
      const { error } = await supabase.from("tasks").update({
        title: editForm.title,
        description: editForm.description || null,
        due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
        assigned_to: editForm.assigned_to || task.assigned_to,
      }).eq("id", task.id);
      if (error) throw error;
      await supabase.from("task_history").insert({
        task_id: task.id,
        user_id: user.id,
        action: "edited",
        details: "Tarefa editada",
      });
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-detail", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["task-history", task?.id] });
      toast.success("Tarefa atualizada");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const handleStartEdit = () => {
    if (!task) return;
    setEditForm({
      title: task.title,
      description: task.description || "",
      due_date: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd'T'HH:mm") : "",
      assigned_to: task.assigned_to,
    });
    setEditing(true);
  };

  const statusBadge = () => {
    if (isCompleted) return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">Concluída</Badge>;
    if (isOverdue) return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0">Atrasada</Badge>;
    if (task?.status === "in_progress") return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0">Em andamento</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  // --- Mention logic ---
  const filteredMentionUsers = useMemo(() => {
    if (!showMentionDropdown) return [];
    const filter = mentionFilter.toLowerCase();
    return safeUsersRaw.filter((u) => u.name.toLowerCase().includes(filter));
  }, [showMentionDropdown, mentionFilter, safeUsersRaw]);

  const handleCommentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComment(value);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " ";
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      const hasSpace = textAfterAt.includes("\n");

      if ((charBeforeAt === " " || charBeforeAt === "\n" || atIndex === 0) && !hasSpace) {
        setShowMentionDropdown(true);
        setMentionFilter(textAfterAt);
        setMentionStartIndex(atIndex);
        setSelectedMentionIndex(0);
        return;
      }
    }

    setShowMentionDropdown(false);
  }, []);

  const selectMention = useCallback((u: { id: string; name: string }) => {
    const before = comment.slice(0, mentionStartIndex);
    const after = comment.slice((textareaRef.current?.selectionStart || mentionStartIndex) );
    const newComment = `${before}@${u.name} ${after}`;
    setComment(newComment);
    if (!mentionedUserIds.includes(u.id)) {
      setMentionedUserIds((prev) => [...prev, u.id]);
    }
    setShowMentionDropdown(false);
    textareaRef.current?.focus();
  }, [comment, mentionStartIndex, mentionedUserIds]);

  const handleCommentKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown && filteredMentionUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => Math.min(prev + 1, filteredMentionUsers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filteredMentionUsers[selectedMentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !showMentionDropdown) {
      e.preventDefault();
      addComment.mutate();
    }
  }, [showMentionDropdown, filteredMentionUsers, selectedMentionIndex, selectMention, addComment]);

  const renderCommentWithMentions = useCallback((text: string) => {
    const userNames = safeUsersRaw.map((u) => u.name).filter(Boolean);
    if (userNames.length === 0) return text;
    const escaped = userNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(@(?:${escaped.join("|")}))`, "g");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.startsWith("@") && userNames.some((n) => part === `@${n}`) ? (
        <span key={i} className="text-primary font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }, [safeUsersRaw]);

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <DialogHeader className="space-y-3">
              <div className="flex items-start gap-2 flex-wrap">
                {statusBadge()}
                {isUrgent && !isCompleted && (
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-0 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {isOverdue ? "Atrasada" : "Vence hoje"}
                  </Badge>
                )}
                {task.type === "lead" && (
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-0">Lead</Badge>
                )}
              </div>
              <DialogTitle className="text-xl text-left">{task.title}</DialogTitle>
            </DialogHeader>

            {/* Points animation */}
            {showPoints && (
              <div className="text-center animate-bounce text-2xl font-bold text-green-500">
                +{pointsEarned} pontos 🎉
              </div>
            )}

            {/* Info */}
            <div className="space-y-3 text-sm">
              {task.lead_id ? (
                <>
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Lead:</span>
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/leads?openLead=${task.lead_id}`);
                      }}
                      className="text-primary hover:underline font-medium text-left"
                    >
                      {leadName || "..."}
                    </button>
                  </div>
                  {/* Lead stage selector */}
                  {leadData?.stage && stagesData?.stages && stagesData.stages.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground ml-6">Status do Lead:</span>
                      <Select
                        value={leadData.stage}
                        onValueChange={(val) => changeLeadStage.mutate(val)}
                      >
                        <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stagesData.stages.map((s: string) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {getStageLabel(s, stagesData.customLabels)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Vínculo:</span>
                  <span className="font-medium italic">Tarefa interna (sem lead)</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Responsável:</span>
                <span className="font-medium">{usersMap[task.assigned_to] || "—"}</span>
                {(() => {
                  const meta = (task.metadata as TaskMetadata) || {};
                  const aiRole = meta.ai_role;
                  const crmFuncao = meta.crm_funcao;
                  if (!aiRole && !crmFuncao) return null;
                  const mismatch =
                    aiRole && crmFuncao &&
                    !isLeadRole(aiRole) &&
                    normalizeRole(aiRole) !== normalizeRole(crmFuncao);
                  return (
                    <TooltipProvider delayDuration={150}>
                      {aiRole && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="gap-1 text-[10px] border-purple-300 text-purple-700 dark:text-purple-300 dark:border-purple-700/60">
                              <Sparkles className="h-3 w-3" />
                              IA: {aiRole}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Papel sugerido pela IA durante a extração da tarefa</TooltipContent>
                        </Tooltip>
                      )}
                      {crmFuncao && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="gap-1 text-[10px] border-blue-300 text-blue-700 dark:text-blue-300 dark:border-blue-700/60">
                              <Briefcase className="h-3 w-3" />
                              CRM: {crmFuncao}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Função real do executor no CRM</TooltipContent>
                        </Tooltip>
                      )}
                      {mismatch && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="gap-1 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-0">
                              <AlertTriangle className="h-3 w-3" />
                              Divergência
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>O papel sugerido pela IA difere da função do executor no CRM</TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Criado por:</span>
                <span>{usersMap[task.created_by] || "—"}</span>
                <span className="text-muted-foreground">em {format(new Date(task.created_at!), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Vencimento:</span>
                {task.due_date ? (
                  <span className={isOverdue ? "text-destructive font-medium" : isDueToday ? "text-orange-600 font-medium" : ""}>
                    {format(new Date(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sem prazo</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Aberta há:</span>
                <span>{timeOpen}</span>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h3 className="font-semibold mb-2">Descrição</h3>
              {task.description ? (
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Sem descrição</p>
              )}
            </div>

            {(() => {
              const meta = (task.metadata as TaskMetadata) || {};
              if (!meta.criterio_conclusao) return null;
              return (
                <div className="rounded-lg border border-green-200 dark:border-green-800/60 bg-green-50/60 dark:bg-green-900/20 p-3">
                  <div className="flex items-center gap-2 mb-1 text-green-700 dark:text-green-300">
                    <Target className="h-4 w-4" />
                    <h3 className="font-semibold text-sm">Critério de Conclusão</h3>
                  </div>
                  <p className="text-sm text-green-900 dark:text-green-100 whitespace-pre-wrap">
                    {meta.criterio_conclusao}
                  </p>
                </div>
              );
            })()}

            <Separator />

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Checklist</h3>
                <span className="text-xs text-muted-foreground">
                  {checkItems.filter(i => i.completed).length}/{checkItems.length}
                </span>
              </div>
              {checkItems.length > 0 && (
                <Progress value={checklistProgress} className="h-2 mb-3" />
              )}
              <div className="space-y-2">
                {checkItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={(checked) =>
                        toggleCheckItem.mutate({ id: item.id, completed: !!checked })
                      }
                    />
                    <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                      {item.text}
                    </span>
                    {item.completed && item.completed_by && (
                      <span className="text-xs text-muted-foreground">
                        {usersMap[item.completed_by]?.split(" ")[0]}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCheckItem.mutate(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="Novo sub-item..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCheckItem.mutate()}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => addCheckItem.mutate()}
                  disabled={!newCheckItem.trim()}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {hasUncheckedItems && !isCompleted && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Complete todos os itens do checklist para concluir a tarefa
                </p>
              )}
            </div>

            <Separator />

            {/* Comments */}
            <div>
              <h3 className="font-semibold mb-3">Comentários</h3>
              <div className="relative mb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Adicionar comentário... Use @ para mencionar alguém"
                      value={comment}
                      onChange={handleCommentChange}
                      onKeyDown={handleCommentKeyDown}
                      className="min-h-[36px] max-h-[100px] text-sm resize-none"
                      rows={1}
                    />
                    {showMentionDropdown && filteredMentionUsers.length > 0 && (
                      <div
                        ref={dropdownRef}
                        className="absolute bottom-full left-0 mb-1 w-full bg-popover border border-border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto"
                      >
                        {filteredMentionUsers.map((u, idx) => (
                          <button
                            key={u.id}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 ${idx === selectedMentionIndex ? "bg-accent" : ""}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectMention(u);
                            }}
                          >
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {u.name[0]}
                            </div>
                            <span>{u.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="h-9 self-end"
                    onClick={() => addComment.mutate()}
                    disabled={!comment.trim() || addComment.isPending}
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Nenhum comentário</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {(usersMap[c.user_id] || "?")[0]}
                        </div>
                        <span className="text-sm font-medium">{usersMap[c.user_id] || "—"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at!), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{renderCommentWithMentions(c.content)}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* History */}
            <div>
              <h3 className="font-semibold mb-3">Histórico</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Nenhum registro</p>
                )}
                {history.map((h) => (
                  <div key={h.id} className="flex gap-2 text-xs text-muted-foreground">
                    <span>📅</span>
                    <span>{format(new Date(h.created_at!), "dd/MM HH:mm", { locale: ptBR })}</span>
                    <span>—</span>
                    <span className="flex-1">{h.details || h.action}</span>
                    <span>— {usersMap[h.user_id]?.split(" ")[0] || "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Feedback on complete */}
            {showFeedback && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <Label className="text-sm">Como foi a execução? (opcional)</Label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Descreva brevemente o que foi feito..."
                  className="min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => changeStatus.mutate("completed")}
                    disabled={changeStatus.isPending || hasUncheckedItems}
                    title={hasUncheckedItems ? "Complete todos os itens do checklist antes de concluir" : undefined}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Confirmar conclusão
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowFeedback(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Edit form */}
            {editing && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="grid gap-2">
                  <Label className="text-sm">Título</Label>
                  <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Descrição</Label>
                  <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Vencimento</Label>
                  <Input type="datetime-local" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Responsável</Label>
                  <Select value={editForm.assigned_to} onValueChange={(v) => setEditForm({ ...editForm, assigned_to: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {usersList.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!editForm.title || saveMutation.isPending}>
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Actions */}
            {!editing && !showFeedback && (
              <div className="flex flex-wrap gap-2">
                {!isCompleted && task.status !== "in_progress" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus.mutate("in_progress")}
                    disabled={changeStatus.isPending}
                    className="gap-1"
                  >
                    <Play className="h-3 w-3" /> Em andamento
                  </Button>
                )}
                {!isCompleted && (
                  <Button
                    size="sm"
                    onClick={() => setShowFeedback(true)}
                    disabled={hasUncheckedItems}
                    title={hasUncheckedItems ? "Complete todos os itens do checklist antes de concluir" : undefined}
                    className="gap-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Concluir
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleStartEdit} className="gap-1">
                  <Edit2 className="h-3 w-3" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Tem certeza que deseja excluir esta tarefa?")) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" /> Excluir
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
