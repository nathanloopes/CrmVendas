import { useState, useCallback, memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, MapPin, Plus, X, User, CheckCircle2, AlertCircle, Calendar, Video, TrendingUp, Globe, Briefcase, DollarSign, CalendarClock, UserCheck, GripVertical, ArrowRightLeft, Clock, MessageCircle } from "lucide-react";
import { EventDialog } from "@/components/calendar/EventDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { resolveStageColor } from "@/lib/stage-colors";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { format, isPast, isToday, differenceInHours, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useRankingEnabled } from "@/hooks/useRankingEnabled";
import { isMeetingStage } from "@/lib/macro-stages";

type Lead = Tables<"leads">;

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  onScoreClick?: (lead: Lead) => void;
  stageColor?: string;
  stages?: string[];
  customLabels?: Record<string, any>;
  onStageChange?: (lead: Lead, newStage: string) => void;
  selected?: boolean;
  onSelect?: (leadId: string, selected: boolean) => void;
  stageEntryTime?: string;
  stageName?: string;
  density?: "compact" | "comfortable";
  pipelineIndex?: number;
  pipelineTotal?: number;
}

function formatDuration(entryTime: string): { label: string; days: number } {
  const entry = new Date(entryTime);
  const now = new Date();
  const totalHours = differenceInHours(now, entry);
  const days = differenceInDays(now, entry);
  const hours = totalHours - days * 24;
  if (days > 0) {
    return { label: `${days}d ${hours}h`, days };
  }
  return { label: `${totalHours}h`, days: 0 };
}

function LeadCardImpl({ lead, onClick, onScoreClick, stageColor, stages = [], customLabels = {}, onStageChange, selected = false, onSelect, stageEntryTime, stageName, density = "comfortable", pipelineIndex = 0, pipelineTotal = 0 }: LeadCardProps) {
  const isCompact = density === "compact";
  const [newTag, setNewTag] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [selectedMeetingEvent, setSelectedMeetingEvent] = useState<any>(null);
  
  const [tasksPopoverOpen, setTasksPopoverOpen] = useState(false);
  const [sdrPopoverOpen, setSdrPopoverOpen] = useState(false);
  const [commercialPopoverOpen, setCommercialPopoverOpen] = useState(false);
  const [adminPopoverOpen, setAdminPopoverOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rankingEnabled = useRankingEnabled();

  const { data: staleAlertDays } = useQuery({
    queryKey: ["stale-lead-alert-days"],
    queryFn: async () => {
      const { data } = await supabase
        .from("global_kanban_settings")
        .select("custom_labels")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .single();
      const labels = data?.custom_labels as Record<string, any> | null;
      return labels?.__stale_lead_alert_days__ ? Number(labels.__stale_lead_alert_days__) : 7;
    },
    staleTime: 300000,
  });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const { data: usersMap = {} } = useQuery({
    queryKey: ["users-map"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name");
      const map: Record<string, string> = {};
      data?.forEach((u) => (map[u.id] = u.name));
      return map;
    },
    staleTime: 60000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["lead-tasks-summary", lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, assigned_to")
        .eq("lead_id", lead.id)
        .order("due_date", { ascending: true });
      return data || [];
    },
    staleTime: 120000,
  });

  const { data: nextMeeting } = useQuery({
    queryKey: ["lead-next-meeting", lead.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("calendar_events")
        .select("id, title, start_datetime, end_datetime, responsible_user_id")
        .eq("lead_id", lead.id)
        .eq("status", "scheduled")
        .gte("start_datetime", today)
        .order("start_datetime", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 30000,
  });

  const pendingTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const hasTasks = tasks.length > 0;
  const allCompleted = hasTasks && pendingTasks.length === 0;

  const toggleTaskMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["lead-tasks-summary", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
    },
    onError: () => toast.error("Erro ao atualizar tarefa"),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const assigneeName = lead.assigned_to ? usersMap[lead.assigned_to] : null;
  const sdrName = lead.sdr_responsible_id ? usersMap[lead.sdr_responsible_id] : null;
  const commercialName = lead.commercial_responsible_id ? usersMap[lead.commercial_responsible_id] : null;
  const adminId = (lead as any).administrative_responsible_id as string | null | undefined;
  const adminName = adminId ? usersMap[adminId] : null;

  const tags = lead.tags || [];

  const updateTags = async (updatedTags: string[]) => {
    await supabase.from("leads").update({ tags: updatedTags }).eq("id", lead.id);
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault();
      const trimmed = newTag.trim();
      if (!tags.includes(trimmed)) {
        updateTags([...tags, trimmed]);
      }
      setNewTag("");
      setPopoverOpen(false);
    }
  };

  const handleRemoveTag = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    updateTags(tags.filter((t) => t !== tag));
  };

  const borderColor = stageColor || "#6b7280";
  const locationLabel = [lead.city_of_interest || lead.city, lead.state_of_interest || lead.state]
    .filter(Boolean)
    .join(" / ");

  // Meeting today check
  const meetingToday = nextMeeting ? isToday(new Date(nextMeeting.start_datetime)) : false;
  const meetingPast = meetingToday && nextMeeting ? isPast(new Date(nextMeeting.end_datetime)) : false;

  const handleOpenMeetingDialog = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (nextMeeting) {
      setSelectedMeetingEvent(nextMeeting);
      setMeetingDialogOpen(true);
    }
  }, [nextMeeting]);

  const handleCopyPhone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.phone) return;
    navigator.clipboard.writeText(lead.phone).then(() => toast.success("Telefone copiado"));
  }, [lead.phone]);

  const handleQuickWhatsapp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.phone) return;
    const cleaned = lead.phone.replace(/\D/g, "");
    const number = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${number}`, "_blank");
  }, [lead.phone]);

  const pipelinePct = pipelineTotal > 0 && pipelineIndex >= 0
    ? Math.round(((pipelineIndex + 1) / pipelineTotal) * 100)
    : 0;
  const showPipelineBar = pipelinePct > 0 && lead.stage !== "ganho" && lead.stage !== "perdido" && !stageName?.toLowerCase().includes("reuniao do dia");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={"group relative bg-white dark:bg-[#131C2E] rounded-xl shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden border " + (selected ? "border-primary ring-2 ring-primary/40 bg-primary/[0.04]" : "border-gray-100 dark:border-white/[0.05] dark:hover:border-white/[0.1]")}
      onClick={() => onClick(lead)}
    >
      <div
        className={"absolute left-0 top-0 bottom-0 rounded-l-lg " + (selected ? "w-[4px]" : "w-[3px]")}
        style={{ backgroundColor: borderColor, opacity: selected ? 1 : 0.8 }}
      />

      {lead.phone && (
        <div
          className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-[#131C2E]/95 rounded-md border border-border/50 shadow-sm px-0.5 py-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleQuickWhatsapp}
            className="h-6 w-6 flex items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10"
            title="Abrir WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleCopyPhone}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-accent"
            title="Copiar telefone"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className={isCompact ? "pl-3 pr-2 py-1.5 space-y-1" : "pl-3.5 pr-2.5 py-2.5 space-y-1.5"}>
        {/* Header: Name + Score */}
        <div className="flex items-start justify-between gap-1">
          {onSelect && (
            <div className="pt-0.5 pr-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(lead.id, !!checked)}
                className="h-3.5 w-3.5"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {locationLabel ? (
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wide leading-tight break-words">
                {locationLabel}
              </p>
            ) : null}
            <p className="text-xs font-medium text-foreground break-words leading-tight">
              {lead.name || "Sem nome"}
            </p>
            {lead.city_available != null && (
              <span
                className={`inline-flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  lead.city_available
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                }`}
                title={lead.city_available ? "Cidade de interesse disponível" : "Cidade de interesse indisponível"}
              >
                <MapPin className="h-2.5 w-2.5" />
                {lead.city_available ? "Cidade disponível" : "Indisponível"}
              </span>
            )}
          </div>
          {lead.lead_score != null && (
            <span
              className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 cursor-pointer hover:-translate-y-0.5 transition-transform ${
                lead.lead_score >= 70
                  ? "bg-green-100 text-green-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : lead.lead_score >= 40
                  ? "bg-yellow-100 text-yellow-700 dark:bg-amber-500/10 dark:text-amber-300"
                  : "bg-red-100 text-red-700 dark:bg-rose-500/10 dark:text-rose-300"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onScoreClick?.(lead);
              }}
            >
              <TrendingUp className="h-2.5 w-2.5" />
              {lead.lead_score}
            </span>
          )}
        </div>

        {/* Timers row: time in column + time with agent */}
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap items-center gap-1.5">
            {stageEntryTime && (() => {
              const { label, days } = formatDuration(stageEntryTime);
              const isReuniao = isMeetingStage(stageName, { custom_labels: customLabels });
              const threshold = staleAlertDays ?? 7;
              const isStale = !isReuniao && days >= threshold;
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        isStale
                          ? "bg-red-100 text-red-700 dark:bg-rose-500/10 dark:text-rose-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {label}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Tempo parado nesta coluna{isReuniao ? " (sem alerta em reuniões)" : ` · alerta após ${threshold}d`}
                  </TooltipContent>
                </Tooltip>
              );
            })()}

            {lead.created_at && (() => {
              const { label } = formatDuration(lead.created_at);
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      <MessageCircle className="h-2.5 w-2.5" />
                      {label}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Tempo desde o primeiro contato com a agente
                  </TooltipContent>
                </Tooltip>
              );
            })()}
          </div>
        </TooltipProvider>


        {/* Meeting today badge */}
        {meetingToday && nextMeeting && (
          <div
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:-translate-y-0.5 transition-transform ${
              meetingPast
                ? "bg-red-600 text-white dark:bg-rose-500/15 dark:text-rose-300 dark:border dark:border-rose-500/40 animate-slow-pulse"
                : "bg-orange-500 text-white dark:bg-amber-500/15 dark:text-amber-300 dark:border dark:border-amber-500/40 animate-pulse"
            }`}
            onClick={handleOpenMeetingDialog}
          >
            <Video className="h-3 w-3" />
            Reunião do Dia
          </div>
        )}

        {/* Scheduled meeting badge (future, not today) */}
        {!meetingToday && !meetingPast && nextMeeting && (
          <div
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white bg-blue-500 dark:bg-blue-500/15 dark:text-blue-300 dark:border dark:border-blue-500/30 cursor-pointer hover:-translate-y-0.5 transition-transform"
            onClick={handleOpenMeetingDialog}
          >
            <Calendar className="h-3 w-3" />
            Reunião Agendada
          </div>
        )}

        {/* Meeting info */}
        {nextMeeting && (
          <div
            className={`space-y-0.5 cursor-pointer rounded-md px-2 py-1.5 ${
              meetingPast
                ? "bg-red-100 border border-red-300 dark:bg-rose-500/[0.06] dark:border-rose-500/20"
                : meetingToday
                ? "bg-orange-100 border border-orange-300 dark:bg-amber-500/[0.06] dark:border-amber-500/20"
                : "bg-blue-50 border border-blue-200 dark:bg-white/[0.03] dark:border-white/[0.06]"
            }`}
            onClick={handleOpenMeetingDialog}
          >
            <div className={`flex items-center gap-1.5 text-[11px] ${
              meetingPast
                ? "text-red-700 dark:text-rose-300 font-bold"
                : meetingToday
                ? "text-orange-700 dark:text-amber-300 font-bold"
                : "text-muted-foreground"
            }`}>
              <Calendar className={`h-3 w-3 shrink-0 ${meetingPast ? "animate-slow-pulse" : meetingToday ? "animate-pulse" : ""}`} />
              <span>
                {meetingToday ? "Hoje " : ""}
                {format(new Date(nextMeeting.start_datetime), meetingToday ? "HH:mm" : "dd/MM/yyyy HH:mm", { locale: ptBR })}
                {" - "}
                {format(new Date(nextMeeting.end_datetime), "HH:mm")}
              </span>
            </div>
            {nextMeeting.responsible_user_id && usersMap[nextMeeting.responsible_user_id] && (
              <div className={`flex items-center gap-1.5 text-[11px] ${
                meetingPast
                  ? "text-red-600 dark:text-rose-300/90 font-medium"
                  : meetingToday
                  ? "text-orange-600 dark:text-amber-300/90 font-medium"
                  : "text-muted-foreground"
              }`}>
                <User className="h-3 w-3 shrink-0" />
                <span>Reunião: {usersMap[nextMeeting.responsible_user_id]}</span>
              </div>
            )}
          </div>
        )}

        {/* SDR / Commercial responsible */}
        <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <UserCheck className="h-3 w-3 shrink-0" />
            {sdrName ? (
              <Popover open={sdrPopoverOpen} onOpenChange={setSdrPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="truncate hover:text-foreground hover:-translate-y-0.5 transition-all text-left font-medium">
                    SDR: {sdrName}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    {Object.entries(usersMap).map(([id, name]) => (
                      <button
                        key={id}
                        className="text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from("leads").update({ sdr_responsible_id: id }).eq("id", lead.id);
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                          setSdrPopoverOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Popover open={sdrPopoverOpen} onOpenChange={setSdrPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="text-primary hover:text-primary/80 hover:-translate-y-0.5 font-medium transition-all text-[11px]">
                    Atribuir SDR
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    {Object.entries(usersMap).map(([id, name]) => (
                      <button
                        key={id}
                        className="text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from("leads").update({ sdr_responsible_id: id }).eq("id", lead.id);
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                          setSdrPopoverOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <UserCheck className="h-3 w-3 shrink-0" />
            {commercialName ? (
              <Popover open={commercialPopoverOpen} onOpenChange={setCommercialPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="truncate hover:text-foreground hover:-translate-y-0.5 transition-all text-left font-medium">
                    Comercial: {commercialName}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    {Object.entries(usersMap).map(([id, name]) => (
                      <button
                        key={id}
                        className="text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from("leads").update({ commercial_responsible_id: id }).eq("id", lead.id);
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                          setCommercialPopoverOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Popover open={commercialPopoverOpen} onOpenChange={setCommercialPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="text-primary hover:text-primary/80 hover:-translate-y-0.5 font-medium transition-all text-[11px]">
                    Atribuir Comercial
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    {Object.entries(usersMap).map(([id, name]) => (
                      <button
                        key={id}
                        className="text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from("leads").update({ commercial_responsible_id: id }).eq("id", lead.id);
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                          setCommercialPopoverOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <UserCheck className="h-3 w-3 shrink-0" />
            {adminName ? (
              <Popover open={adminPopoverOpen} onOpenChange={setAdminPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="truncate hover:text-foreground hover:-translate-y-0.5 transition-all text-left font-medium">
                    Adm: {adminName}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    {Object.entries(usersMap).map(([id, name]) => (
                      <button
                        key={id}
                        className="text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from("leads").update({ administrative_responsible_id: id }).eq("id", lead.id);
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                          setAdminPopoverOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Popover open={adminPopoverOpen} onOpenChange={setAdminPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="text-primary hover:text-primary/80 hover:-translate-y-0.5 font-medium transition-all text-[11px]">
                    Atribuir Administrativo
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col">
                    {Object.entries(usersMap).map(([id, name]) => (
                      <button
                        key={id}
                        className="text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from("leads").update({ administrative_responsible_id: id }).eq("id", lead.id);
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                          setAdminPopoverOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Contact dates */}
        {(lead.last_contact || lead.next_contact) && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3 shrink-0" />
            <span>
              {lead.last_contact && `Últ: ${format(new Date(lead.last_contact), "dd/MM", { locale: ptBR })}`}
              {lead.last_contact && lead.next_contact && " · "}
              {lead.next_contact && `Próx: ${format(new Date(lead.next_contact), "dd/MM", { locale: ptBR })}`}
            </span>
          </div>
        )}

        {/* Phone + WhatsApp */}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{lead.phone}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const cleaned = lead.phone!.replace(/\D/g, '');
                const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                window.open(`https://wa.me/${number}`, '_blank');
              }}
              className="ml-0.5 text-green-500 hover:text-green-600 transition-colors"
              title="Abrir WhatsApp"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>
          </div>
        )}

        {/* Tasks badge */}
        {hasTasks && !allCompleted && (
          <div onClick={(e) => e.stopPropagation()}>
            <Popover open={tasksPopoverOpen} onOpenChange={setTasksPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-all hover:-translate-y-0.5 bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-400">
                  <AlertCircle className="h-3 w-3" /> {pendingTasks.length} pendente{pendingTasks.length > 1 ? "s" : ""}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-semibold mb-2 text-foreground">
                  Tarefas ({completedTasks.length}/{tasks.length})
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {tasks.map((task) => {
                    const isCompleted = task.status === "completed";
                    const isOverdue = task.due_date && !isCompleted && new Date(task.due_date) < new Date();
                    return (
                      <div key={task.id} className="flex items-start gap-2 p-1.5 rounded border bg-card">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={(checked) =>
                            toggleTaskMutation.mutate({
                              taskId: task.id,
                              completed: !!checked,
                              assignedTo: task.assigned_to,
                              dueDate: task.due_date,
                            })
                          }
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.title}
                          </p>
                          {task.due_date && (
                            <span className={`text-[10px] ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              {isOverdue && "⚠ "}
                              {format(new Date(task.due_date), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Lost reason */}
        {lead.stage === "perdido" && lead.lost_reason && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">
            Perda: {lead.lost_reason}
          </Badge>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
            {tags.map((tag) => (
              <Badge
                key={tag}
                className="text-[10px] px-1.5 py-0 gap-0.5 cursor-default bg-yellow-400 text-yellow-900 border-yellow-500 hover:bg-yellow-500 dark:bg-yellow-500/80 dark:text-yellow-950 dark:border-yellow-600 dark:hover:bg-yellow-500 hover:-translate-y-0.5 transition-transform"
              >
                {tag}
                <button
                  onClick={(e) => handleRemoveTag(e, tag)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className="h-4 w-4 rounded-full flex items-center justify-center bg-muted hover:bg-muted-foreground/20 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="h-2.5 w-2.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Nova etiqueta..."
                  className="h-7 text-xs"
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
        {/* Move stage select */}
        {stages.length > 0 && onStageChange && (
          <div className="pt-1.5 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Mudar Status</span>
            <Select
              value={lead.stage || stages[0] || "captação"}
              onValueChange={(newStage) => onStageChange(lead, newStage)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => {
                  const label = (customLabels?.[stage] as string) || stage.replace(/-/g, " ").split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                  return (
                    <SelectItem key={stage} value={stage} className="text-xs">
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {showPipelineBar && (
        <div className="px-2.5 pb-1.5">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pipelinePct}%`, backgroundColor: borderColor }} />
          </div>
        </div>
      )}

      {meetingDialogOpen && selectedMeetingEvent && (
        <EventDialog
          open={meetingDialogOpen}
          onOpenChange={(open) => {
            setMeetingDialogOpen(open);
            if (!open) setSelectedMeetingEvent(null);
          }}
          event={{
            ...selectedMeetingEvent,
            status: selectedMeetingEvent.status || "scheduled",
            attendees: selectedMeetingEvent.attendees || null,
            color: selectedMeetingEvent.color || null,
            created_at: selectedMeetingEvent.created_at || "",
            created_by: selectedMeetingEvent.created_by || null,
            description: selectedMeetingEvent.description || null,
            event_type: selectedMeetingEvent.event_type || "meeting",
            google_calendar_event_id: selectedMeetingEvent.google_calendar_event_id || null,
            google_calendar_sync_status: selectedMeetingEvent.google_calendar_sync_status || null,
            google_meet_link: selectedMeetingEvent.google_meet_link || null,
            last_sync_error: selectedMeetingEvent.last_sync_error || null,
            lead_id: selectedMeetingEvent.lead_id || lead.id,
            location: selectedMeetingEvent.location || null,
            updated_at: selectedMeetingEvent.updated_at || "",
          }}
        />
      )}
    </div>
  );
}

export const LeadCard = memo(LeadCardImpl, (prev, next) => {
  return (
    prev.lead.id === next.lead.id &&
    prev.lead.updated_at === next.lead.updated_at &&
    prev.lead.lead_score === next.lead.lead_score &&
    prev.lead.stage === next.lead.stage &&
    prev.lead.tags === next.lead.tags &&
    prev.selected === next.selected &&
    prev.stageColor === next.stageColor &&
    prev.stageEntryTime === next.stageEntryTime &&
    prev.stageName === next.stageName &&
    prev.density === next.density &&
    prev.pipelineIndex === next.pipelineIndex &&
    prev.pipelineTotal === next.pipelineTotal &&
    prev.onClick === next.onClick &&
    prev.onScoreClick === next.onScoreClick &&
    prev.onStageChange === next.onStageChange &&
    prev.onSelect === next.onSelect
  );
});
