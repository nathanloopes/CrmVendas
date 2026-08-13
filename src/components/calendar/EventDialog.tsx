import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LeadDetailDialog } from "@/components/leads/LeadDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pencil, MapPin, Calendar, Tag, User, Phone, Mail, MapPinned, Check, X, RefreshCw, Mic, Square, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useMeetingRecorder } from "@/hooks/use-meeting-recorder";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;

type OutcomeStep = null | "completed" | "cancelled" | "reschedule";
type RescheduleSubStep = "ask" | "pick_date";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  stages?: string[];
  customLabels?: Record<string, any>;
  onMeetingCompleted?: (leadId: string) => void;
}

const EVENT_TYPES = [
  { value: "meeting", label: "Reunião" },
  { value: "call", label: "Ligação" },
  { value: "task", label: "Tarefa" },
  { value: "other", label: "Outro" },
];

const getEventTypeLabel = (value: string) =>
  EVENT_TYPES.find((t) => t.value === value)?.label || value;

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  call: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  task: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  other: "bg-muted text-muted-foreground",
};

function formatStage(stage: string) {
  return stage.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EventDialog({ open, onOpenChange, event, defaultDate, stages = [], customLabels = {}, onMeetingCompleted }: EventDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEditing = !!event;
  const [viewMode, setViewMode] = useState(!!event);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);

  // Recording state
  const { isRecording, duration, partialTranscription, startRecording, stopRecording } = useMeetingRecorder();
  const [recordingActive, setRecordingActive] = useState(false);

  // Outcome flow state
  const [outcomeStep, setOutcomeStep] = useState<OutcomeStep>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelMoveStage, setCancelMoveStage] = useState("");
  const [rescheduleSubStep, setRescheduleSubStep] = useState<RescheduleSubStep>("ask");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("10:00");
  const [outcomeLoading, setOutcomeLoading] = useState(false);

  const { data: lead } = useQuery({
    queryKey: ["lead-for-event", event?.lead_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", event!.lead_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!event?.lead_id,
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    event_type: "meeting",
    location: "",
    start_date: "",
    start_time: "09:00",
    end_date: "",
    end_time: "10:00",
  });

  useEffect(() => {
    if (event) {
      setViewMode(true);
      const start = new Date(event.start_datetime);
      const end = new Date(event.end_datetime);
      setForm({
        title: event.title,
        description: event.description || "",
        event_type: event.event_type,
        location: event.location || "",
        start_date: format(start, "yyyy-MM-dd"),
        start_time: format(start, "HH:mm"),
        end_date: format(end, "yyyy-MM-dd"),
        end_time: format(end, "HH:mm"),
      });
    } else if (defaultDate) {
      setViewMode(false);
      const dateStr = format(defaultDate, "yyyy-MM-dd");
      setForm((f) => ({ ...f, title: "", description: "", event_type: "meeting", location: "", start_date: dateStr, end_date: dateStr, start_time: "09:00", end_time: "10:00" }));
    } else {
      setViewMode(false);
    }
    // Reset outcome state
    setOutcomeStep(null);
    setCancelReason("");
    setCancelMoveStage("");
    setRescheduleSubStep("ask");
    setRescheduleDate("");
    setRescheduleTime("09:00");
    setRescheduleEndTime("10:00");
    setRecordingActive(false);
  }, [event, defaultDate]);

  const handleStartMeetingRecording = async () => {
    await startRecording();
    setRecordingActive(true);
  };

  const handleStopMeetingRecording = async () => {
    if (!event || !user) return;
    setOutcomeLoading(true);
    try {
      const fullText = await stopRecording();
      setRecordingActive(false);

      // Mark event as completed
      const { error } = await supabase.from("calendar_events").update({ status: "completed" }).eq("id", event.id);
      if (error) throw error;

      // Save transcription as lead_material if there's text
      if (fullText?.trim() && event.lead_id) {
        await supabase.from("lead_materials").insert({
          lead_id: event.lead_id,
          title: `Transcrição - ${event.title}`,
          type: "transcricao",
          content: fullText,
          created_by: user.id,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-next-meeting"] });
      queryClient.invalidateQueries({ queryKey: ["lead-materials"] });
      toast.success("Reunião finalizada e transcrição salva!");
      handleClose(false);

      if (event.lead_id && onMeetingCompleted) {
        onMeetingCompleted(event.lead_id);
      }
    } catch {
      toast.error("Erro ao finalizar reunião");
    } finally {
      setOutcomeLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setViewMode(!!event);
      setOutcomeStep(null);
    }
    onOpenChange(o);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const payload = {
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        location: form.location || null,
        start_datetime: `${form.start_date}T${form.start_time}:00`,
        end_datetime: `${form.end_date}T${form.end_time}:00`,
        responsible_user_id: user.id,
        created_by: user.id,
      };

      if (isEditing && event) {
        const { error } = await supabase.from("calendar_events").update(payload).eq("id", event.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("calendar_events").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      toast.success(isEditing ? "Evento atualizado" : "Evento criado");
      handleClose(false);
    },
    onError: () => toast.error("Erro ao salvar evento"),
  });

  // --- Outcome handlers ---

  const handleCompleted = async () => {
    if (!event || !user) return;
    setOutcomeLoading(true);
    try {
      const { error } = await supabase.from("calendar_events").update({ status: "completed" }).eq("id", event.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-next-meeting"] });
      toast.success("Reunião marcada como realizada");
      handleClose(false);
      if (event.lead_id && onMeetingCompleted) {
        onMeetingCompleted(event.lead_id);
      }
    } catch {
      toast.error("Erro ao atualizar evento");
    } finally {
      setOutcomeLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!event || !user || !cancelReason.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }
    setOutcomeLoading(true);
    try {
      // Update event status
      const { error: evErr } = await supabase.from("calendar_events").update({
        status: "cancelled",
        description: (event.description ? event.description + "\n\n" : "") + `**Motivo do cancelamento:** ${cancelReason}`,
      }).eq("id", event.id);
      if (evErr) throw evErr;

      // Move lead if stage selected
      if (cancelMoveStage && event.lead_id) {
        const { error: leadErr } = await supabase.from("leads").update({ stage: cancelMoveStage, updated_at: new Date().toISOString() }).eq("id", event.lead_id);
        if (leadErr) throw leadErr;

        // Record stage change
        if (lead?.stage && lead.stage !== cancelMoveStage) {
          await supabase.from("lead_stage_history").insert({
            lead_id: event.lead_id,
            old_stage: lead.stage,
            new_stage: cancelMoveStage,
            changed_by: user.id,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-next-meeting"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Reunião cancelada");
      handleClose(false);
    } catch {
      toast.error("Erro ao cancelar reunião");
    } finally {
      setOutcomeLoading(false);
    }
  };

  const handleRescheduleNoDate = async () => {
    if (!event || !user) return;
    setOutcomeLoading(true);
    try {
      const { error: evErr } = await supabase.from("calendar_events").update({ status: "rescheduled" }).eq("id", event.id);
      if (evErr) throw evErr;

      // Move lead to Reagendamento
      if (event.lead_id) {
        const reagendamentoStage = stages.find(s => s.toLowerCase().includes("reagendamento")) || "Reagendamento";
        const { error: leadErr } = await supabase.from("leads").update({ stage: reagendamentoStage, updated_at: new Date().toISOString() }).eq("id", event.lead_id);
        if (leadErr) throw leadErr;

        if (lead?.stage && lead.stage !== reagendamentoStage) {
          await supabase.from("lead_stage_history").insert({
            lead_id: event.lead_id,
            old_stage: lead.stage,
            new_stage: reagendamentoStage,
            changed_by: user.id,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-next-meeting"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead movido para Reagendamento");
      handleClose(false);
    } catch {
      toast.error("Erro ao reagendar");
    } finally {
      setOutcomeLoading(false);
    }
  };

  const handleRescheduleWithDate = async () => {
    if (!event || !user || !rescheduleDate) {
      toast.error("Informe a nova data");
      return;
    }
    setOutcomeLoading(true);
    try {
      // Mark old event as rescheduled
      const { error: evErr } = await supabase.from("calendar_events").update({ status: "rescheduled" }).eq("id", event.id);
      if (evErr) throw evErr;

      // Create new event
      const { error: newErr } = await supabase.from("calendar_events").insert({
        title: event.title,
        description: event.description || null,
        event_type: event.event_type,
        location: event.location || null,
        lead_id: event.lead_id,
        start_datetime: `${rescheduleDate}T${rescheduleTime}:00`,
        end_datetime: `${rescheduleDate}T${rescheduleEndTime}:00`,
        responsible_user_id: event.responsible_user_id,
        created_by: user.id,
      });
      if (newErr) throw newErr;

      // Move lead to Reunião Agendada
      if (event.lead_id) {
        const reuniaoAgendadaStage = stages.find(s => s.toLowerCase().includes("reunião agendada") || s.toLowerCase().includes("reuniao agendada")) || "Reunião Agendada";
        const { error: leadErr } = await supabase.from("leads").update({ stage: reuniaoAgendadaStage, updated_at: new Date().toISOString() }).eq("id", event.lead_id);
        if (leadErr) throw leadErr;

        if (lead?.stage && lead.stage !== reuniaoAgendadaStage) {
          await supabase.from("lead_stage_history").insert({
            lead_id: event.lead_id,
            old_stage: lead.stage,
            new_stage: reuniaoAgendadaStage,
            changed_by: user.id,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-next-meeting"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Reunião reagendada com sucesso");
      handleClose(false);
    } catch {
      toast.error("Erro ao reagendar");
    } finally {
      setOutcomeLoading(false);
    }
  };

  const startFormatted = form.start_date ? format(new Date(`${form.start_date}T${form.start_time}`), "dd/MM/yyyy HH:mm") : "";
  const endFormatted = form.end_date ? format(new Date(`${form.end_date}T${form.end_time}`), "dd/MM/yyyy HH:mm") : "";

  const hasLead = !!event?.lead_id;
  const eventIsScheduled = event?.status === "scheduled";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditing ? (viewMode ? "Detalhes do Evento" : "Editar Evento") : "Novo Evento"}</DialogTitle>
            {isEditing && viewMode && !outcomeStep && (
              <Button variant="ghost" size="icon" onClick={() => setViewMode(false)} className="h-8 w-8">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {viewMode && event ? (
          <div className="space-y-4 py-2">
            <h3 className="text-xl font-bold text-foreground leading-tight">{event.title}</h3>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS.other}>
                <Tag className="h-3 w-3 mr-1" />
                {getEventTypeLabel(event.event_type)}
              </Badge>
              {event.status !== "scheduled" && (
                <Badge variant={event.status === "completed" ? "default" : "destructive"} className="text-xs">
                  {event.status === "completed" ? "Realizada" : event.status === "cancelled" ? "Cancelada" : event.status === "rescheduled" ? "Reagendada" : event.status}
                </Badge>
              )}
              {event.location && (
                <Badge variant="outline" className="font-normal">
                  <MapPin className="h-3 w-3 mr-1" />
                  {event.location}
                </Badge>
              )}
              <Badge variant="outline" className="font-normal">
                <Calendar className="h-3 w-3 mr-1" />
                {startFormatted} — {endFormatted}
              </Badge>
            </div>

            {lead && (
              <>
                <Separator />
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    <User className="h-3 w-3 inline mr-1" />
                    Lead
                  </h4>
                  <button
                    onClick={() => setLeadDialogOpen(true)}
                    className="group w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-semibold text-primary group-hover:underline">
                        {lead.name || "Sem nome"}
                      </span>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {lead.phone}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {lead.email}
                      </span>
                    )}
                    {lead.city_of_interest && (
                      <span className="flex items-center gap-1">
                        <MapPinned className="h-3 w-3" /> {lead.city_of_interest}
                      </span>
                    )}
                  </div>
                  {lead.stage && (
                    <Badge variant="outline" className="mt-2 text-xs">{lead.stage}</Badge>
                  )}
                </div>
              </>
            )}

            {/* Send Zoom link via WhatsApp */}
            {lead && (lead.link_zoom || (event.location && event.location.startsWith("http"))) && event.status === "scheduled" && (
              <Button
                variant="outline"
                className="w-full h-9 text-sm gap-2 font-semibold border-green-400 text-green-700 bg-green-50 hover:bg-green-100 dark:border-green-600 dark:text-green-400 dark:bg-green-950/20 dark:hover:bg-green-950/40"
                onClick={() => {
                  const zoomLink = lead.link_zoom || event.location;
                  if (!lead.phone) {
                    toast.error(`O lead "${lead.name || "sem nome"}" não tem número de WhatsApp cadastrado.`);
                    return;
                  }
                  const cleaned = lead.phone.replace(/\D/g, "");
                  const number = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
                  const start = new Date(event.start_datetime);
                  const dateStr = format(start, "dd/MM/yyyy");
                  const timeStr = format(start, "HH:mm");
                  const name = lead.name || "participante";
                  const message = `Olá ${name}! 👋\n\nSua reunião *${event.title}* está agendada para ${dateStr} às ${timeStr}.\n\n🔗 Acesse pelo link: ${zoomLink}\n\nNos vemos lá!`;
                  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank");
                  toast.success(`Link enviado para ${name} via WhatsApp`);
                }}
              >
                <Send className="h-4 w-4" />
                Enviar Link para os Leads
              </Button>
            )}

            {event.description && (
              <>
                <Separator />
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Descrição</h4>
                  <div className="prose prose-sm dark:prose-invert max-h-80 overflow-y-auto pr-1 max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {event.description}
                    </ReactMarkdown>
                  </div>
                </div>
              </>
            )}

            {/* Recording UI */}
            {recordingActive && (
              <div className="space-y-3 border border-red-500/30 rounded-lg p-4 bg-red-500/5">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                    Gravando — {formatDuration(duration)}
                  </span>
                </div>
                {partialTranscription && (
                  <div className="bg-background/50 rounded p-2 max-h-32 overflow-y-auto text-xs text-muted-foreground border">
                    {partialTranscription}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopMeetingRecording}
                  disabled={outcomeLoading}
                >
                  <Square className="h-4 w-4 mr-1" />
                  {outcomeLoading ? "Finalizando..." : "Finalizar Reunião"}
                </Button>
              </div>
            )}

            {/* Outcome flows */}
            {outcomeStep === "cancelled" && (
              <div className="space-y-3 border border-destructive/30 rounded-lg p-4 bg-destructive/5">
                <h4 className="text-sm font-semibold text-destructive">Cancelar Reunião</h4>
                <div className="grid gap-2">
                  <Label className="text-xs">Motivo do cancelamento *</Label>
                  <Textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Informe o motivo..."
                    className="min-h-[60px]"
                  />
                </div>
                {stages.length > 0 && (
                  <div className="grid gap-2">
                    <Label className="text-xs">Mover lead para qual status?</Label>
                    <Select value={cancelMoveStage} onValueChange={setCancelMoveStage}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione um status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {(customLabels?.[s] as string) || formatStage(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setOutcomeStep(null)} disabled={outcomeLoading}>
                    Voltar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleCancelConfirm} disabled={outcomeLoading || !cancelReason.trim()}>
                    {outcomeLoading ? "Salvando..." : "Confirmar Cancelamento"}
                  </Button>
                </div>
              </div>
            )}

            {outcomeStep === "reschedule" && rescheduleSubStep === "ask" && (
              <div className="space-y-3 border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Reagendar Reunião</h4>
                <p className="text-sm text-muted-foreground">Já tem uma nova data definida?</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRescheduleSubStep("pick_date")} disabled={outcomeLoading}>
                    Sim, informar data
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRescheduleNoDate} disabled={outcomeLoading}>
                    {outcomeLoading ? "Salvando..." : "Não, mover para Reagendamento"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setOutcomeStep(null)} disabled={outcomeLoading}>
                    Voltar
                  </Button>
                </div>
              </div>
            )}

            {outcomeStep === "reschedule" && rescheduleSubStep === "pick_date" && (
              <div className="space-y-3 border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Nova Data da Reunião</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs">Data *</Label>
                    <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Início</Label>
                    <Input type="time" value={rescheduleTime} onChange={(e) => {
                      const newTime = e.target.value;
                      const [h, m] = newTime.split(":").map(Number);
                      const d = new Date(2000, 0, 1, h, m);
                      d.setMinutes(d.getMinutes() + 60);
                      setRescheduleTime(newTime);
                      setRescheduleEndTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
                    }} className="h-8 text-xs" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Fim</Label>
                    <Input type="time" value={rescheduleEndTime} onChange={(e) => setRescheduleEndTime(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setRescheduleSubStep("ask")} disabled={outcomeLoading}>
                    Voltar
                  </Button>
                  <Button size="sm" onClick={handleRescheduleWithDate} disabled={outcomeLoading || !rescheduleDate}>
                    {outcomeLoading ? "Salvando..." : "Reagendar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Local</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Início</Label>
                <div className="flex gap-2">
                  <Input type="date" value={form.start_date} onChange={(e) => {
                    const newStartDate = e.target.value;
                    setForm((f) => ({ ...f, start_date: newStartDate, end_date: newStartDate }));
                  }} />
                  <Input type="time" value={form.start_time} onChange={(e) => {
                    const newStartTime = e.target.value;
                    const [h, m] = newStartTime.split(":").map(Number);
                    const startDate = new Date(2000, 0, 1, h, m);
                    startDate.setMinutes(startDate.getMinutes() + 60);
                    const endTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;
                    const crossesMidnight = startDate.getDate() !== 1;
                    setForm((f) => {
                      const endDate = crossesMidnight && f.start_date
                        ? format(new Date(new Date(f.start_date).getTime() + 86400000), "yyyy-MM-dd")
                        : f.start_date;
                      return { ...f, start_time: newStartTime, end_time: endTime, end_date: endDate };
                    });
                  }} className="w-28" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Fim</Label>
                <div className="flex gap-2">
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-28" />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {viewMode ? (
            <div className="flex w-full items-center gap-2 flex-wrap">
              {hasLead && eventIsScheduled && !outcomeStep && !recordingActive && (
                <>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleStartMeetingRecording}
                  >
                    <Mic className="h-4 w-4 mr-1" />
                    Iniciar Reunião
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleCompleted}
                    disabled={outcomeLoading}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {outcomeLoading ? "..." : "Realizada"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setOutcomeStep("cancelled")}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelada
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handleRescheduleNoDate}
                    disabled={outcomeLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {outcomeLoading ? "..." : "Reagendar"}
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => handleClose(false)} className="ml-auto">
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={() => isEditing ? setViewMode(true) : handleClose(false)}>Cancelar</Button>
              <Button onClick={() => mutation.mutate()} disabled={!form.title || !form.start_date || !form.end_date || mutation.isPending}>
                {mutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar Evento"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {lead && (
        <LeadDetailDialog
          lead={lead}
          open={leadDialogOpen}
          onOpenChange={setLeadDialogOpen}
        />
      )}
    </Dialog>
  );
}
