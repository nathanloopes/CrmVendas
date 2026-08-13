import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, isToday, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Calendar, Clock, MapPin, Trash2, Edit2, X, CheckCircle2, XCircle, RefreshCw, CalendarClock, AlertTriangle, User, Mic, Square, Send } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useMeetingRecorder } from "@/hooks/use-meeting-recorder";

type CalendarEvent = Tables<"calendar_events">;

interface LeadMeetingsProps {
  leadId: string;
  leadName: string | null;
  leadPhone?: string | null;
  onTranscriptionReady?: (text: string) => void;
}

const EVENT_TYPES = [
  { value: "meeting", label: "Reunião" },
  { value: "call", label: "Ligação" },
  { value: "task", label: "Tarefa" },
  { value: "other", label: "Outro" },
];

function getMeetingStatus(event: CalendarEvent): {
  label: string;
  color: string;
  dotColor: string;
  bgColor: string;
  icon: React.ReactNode;
} {
  const status = event.status;
  const start = parseISO(event.start_datetime);

  if (status === "completed") {
    return {
      label: "Realizada",
      color: "text-emerald-700 dark:text-emerald-400",
      dotColor: "bg-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }
  if (status === "cancelled") {
    return {
      label: "Cancelada",
      color: "text-red-700 dark:text-red-400",
      dotColor: "bg-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
      icon: <XCircle className="h-3 w-3" />,
    };
  }
  if (status === "rescheduled") {
    return {
      label: "Reagendada",
      color: "text-amber-700 dark:text-amber-400",
      dotColor: "bg-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
      icon: <RefreshCw className="h-3 w-3" />,
    };
  }

  // scheduled or fallback
  if (isToday(start)) {
    return {
      label: "Hoje",
      color: "text-orange-700 dark:text-orange-400",
      dotColor: "bg-orange-500 ring-4 ring-orange-200 dark:ring-orange-900",
      bgColor: "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800",
      icon: <CalendarClock className="h-3 w-3" />,
    };
  }
  if (isPast(start)) {
    return {
      label: "Sem status",
      color: "text-zinc-500 dark:text-zinc-400",
      dotColor: "bg-zinc-400",
      bgColor: "bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-700",
      icon: <CalendarClock className="h-3 w-3" />,
    };
  }

  return {
    label: "Agendada",
    color: "text-blue-700 dark:text-blue-400",
    dotColor: "bg-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    icon: <Calendar className="h-3 w-3" />,
  };
}

const defaultForm = (leadName: string | null, userId?: string) => ({
  title: `Reunião - ${leadName || "Lead"}`,
  description: "",
  event_type: "meeting",
  location: "",
  start_date: "",
  start_time: "09:00",
  end_date: "",
  end_time: "10:00",
  responsible_user_id: userId || "",
});

export function LeadMeetings({ leadId, leadName, leadPhone, onTranscriptionReady }: LeadMeetingsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm(leadName, user?.id));
  const [recordingMeetingId, setRecordingMeetingId] = useState<string | null>(null);
  const recorder = useMeetingRecorder();

  // Fetch active users for responsible selector
  const { data: activeUsers = [] } = useQuery({
    queryKey: ["active-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, funcao")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Conflict detection query
  const conflictQueryEnabled = !!(form.start_date && form.start_time && form.end_time && form.responsible_user_id);
  const { data: conflictingEvents = [] } = useQuery({
    queryKey: ["meeting-conflicts", form.responsible_user_id, form.start_date, form.start_time, form.end_date || form.start_date, form.end_time, editingId],
    queryFn: async () => {
      const endDate = form.end_date || form.start_date;
      const startDt = new Date(`${form.start_date}T${form.start_time}:00`).toISOString();
      let endDt = new Date(`${endDate}T${form.end_time}:00`);
      if (isNaN(endDt.getTime()) || endDt <= new Date(startDt)) {
        endDt = new Date(new Date(startDt).getTime() + 60 * 60 * 1000);
      }
      const endIso = endDt.toISOString();

      let query = supabase
        .from("calendar_events")
        .select("id, title, start_datetime, end_datetime")
        .eq("responsible_user_id", form.responsible_user_id)
        .neq("status", "cancelled")
        .lt("start_datetime", endIso)
        .gt("end_datetime", startDt);

      if (editingId) {
        query = query.neq("id", editingId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: conflictQueryEnabled,
  });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["lead-meetings", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("lead_id", leadId)
        .order("start_datetime", { ascending: false });
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });

  // Fetch lead's link_zoom for WhatsApp send
  const { data: leadData } = useQuery({
    queryKey: ["lead-zoom-link", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("link_zoom, name, phone")
        .eq("id", leadId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const handleSendZoomToWhatsApp = (meeting: CalendarEvent) => {
    const zoomLink = leadData?.link_zoom || meeting.location;
    if (!zoomLink || (!zoomLink.startsWith("http") && !zoomLink.includes("zoom"))) {
      toast.error("Nenhum link do Zoom disponível para esta reunião.");
      return;
    }
    const phone = leadPhone || leadData?.phone;
    if (!phone) {
      toast.error(`O lead "${leadName || "sem nome"}" não tem número de WhatsApp cadastrado.`);
      return;
    }
    const cleaned = phone.replace(/\D/g, "");
    const number = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    const start = new Date(meeting.start_datetime);
    const dateStr = format(start, "dd/MM/yyyy", { locale: ptBR });
    const timeStr = format(start, "HH:mm");
    const name = leadName || "participante";

    const message = `Olá ${name}! 👋\n\nSua reunião *${meeting.title}* está agendada para ${dateStr} às ${timeStr}.\n\n🔗 Acesse pelo link: ${zoomLink}\n\nNos vemos lá!`;

    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank");
    toast.success(`Link enviado para ${name} via WhatsApp`);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const endDate = form.end_date || form.start_date;
      const startDt = new Date(`${form.start_date}T${form.start_time}:00`);
      let endDt = new Date(`${endDate}T${form.end_time}:00`);

      if (isNaN(endDt.getTime()) || endDt <= startDt) {
        endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
      }

      const payload = {
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        location: form.location || null,
        start_datetime: startDt.toISOString(),
        end_datetime: endDt.toISOString(),
        lead_id: leadId,
        responsible_user_id: form.responsible_user_id || user.id,
        created_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase.from("calendar_events").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("calendar_events").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-meetings", leadId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      toast.success(editingId ? "Reunião atualizada" : "Reunião agendada");
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar reunião"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-meetings", leadId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      toast.success("Reunião excluída");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("calendar_events").update({ status }).eq("id", id);
      if (error) throw error;

      // If rescheduled, move lead to "Reagendamento" stage
      if (status === "rescheduled") {
        const { data: currentLead } = await supabase.from("leads").select("stage").eq("id", leadId).single();
        const reagendamentoStage = "Reagendamento";
        
        if (currentLead?.stage !== reagendamentoStage) {
          const { error: leadErr } = await supabase.from("leads").update({ stage: reagendamentoStage, updated_at: new Date().toISOString() }).eq("id", leadId);
          if (leadErr) throw leadErr;

          await supabase.from("lead_stage_history").insert({
            lead_id: leadId,
            old_stage: currentLead?.stage || "unknown",
            new_stage: reagendamentoStage,
            changed_by: user?.id || null,
          });
        }
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead-meetings", leadId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["today-meeting-leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-next-meeting"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      const labels: Record<string, string> = { completed: "Realizada", cancelled: "Cancelada", rescheduled: "Reagendada" };
      toast.success(`Reunião marcada como ${labels[variables.status] || variables.status}`);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar status"),
  });

  function resetForm() {
    setForm(defaultForm(leadName, user?.id));
    setShowForm(false);
    setEditingId(null);
  }

  const handleStartRecording = async (meetingId: string) => {
    setRecordingMeetingId(meetingId);
    await recorder.startRecording();
  };

  const handleStopRecording = async (meetingId: string) => {
    const transcription = await recorder.stopRecording();
    setRecordingMeetingId(null);

    // Mark as completed
    statusMutation.mutate({ id: meetingId, status: "completed" });

    // Save transcription as material
    if (transcription.trim()) {
      const today = new Date().toLocaleDateString("pt-BR");
      await supabase.from("lead_materials").insert({
        lead_id: leadId,
        title: `Transcrição de Reunião - ${today}`,
        type: "transcricao",
        content: transcription,
        created_by: user?.id || null,
      });
      queryClient.invalidateQueries({ queryKey: ["lead-materials", leadId] });
      onTranscriptionReady?.(transcription);
      toast.success("Transcrição salva! Acesse a aba 'Transcrição da Reunião' para processar.");
    }
  };

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function startEdit(event: CalendarEvent) {
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
      responsible_user_id: event.responsible_user_id,
    });
    setEditingId(event.id);
    setShowForm(true);
  }

  const canSubmit = form.title && form.start_date && !saveMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Reuniões ({meetings.length})
        </h3>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            <Plus className="h-3.5 w-3.5" /> Agendar Nova Reunião
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {editingId ? "Editar Reunião" : "Nova Reunião"}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Título da reunião"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select value={form.responsible_user_id} onValueChange={(v) => setForm({ ...form, responsible_user_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} {u.funcao ? `(${u.funcao})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Local / Link</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Zoom, escritório..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Início</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      const endH = String((h + 1) % 24).padStart(2, "0");
                      const endM = String(m).padStart(2, "0");
                      setForm({ ...form, start_time: e.target.value, end_time: `${endH}:${endM}` });
                    }}
                    className="w-24"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Fim</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-24"
                  />
                </div>
              </div>
            </div>

            {/* Conflict warning */}
            {conflictingEvents.length > 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-xs space-y-1">
                  <p className="font-medium">Conflito de horário detectado</p>
                  {conflictingEvents.map((evt) => (
                    <p key={evt.id} className="text-amber-700 dark:text-amber-400">
                      "{evt.title}" — {format(new Date(evt.start_datetime), "dd/MM HH:mm")} até {format(new Date(evt.end_datetime), "HH:mm")}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Observações..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!canSubmit}>
              {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar" : "Agendar"}
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : meetings.length === 0 && !showForm ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma reunião agendada</p>
          <p className="text-xs mt-1">Clique em "Agendar Nova Reunião" para criar um evento</p>
        </div>
      ) : meetings.length > 0 ? (
        <div className="space-y-3">
          {meetings.map((meeting) => {
              const status = getMeetingStatus(meeting);
              const start = new Date(meeting.start_datetime);
              const end = new Date(meeting.end_datetime);
              const isTodayMeeting = isToday(start) && (!meeting.status || meeting.status === "scheduled");
              
              const cardBorderLeft = meeting.status === "completed" ? "border-l-green-400" 
                : meeting.status === "cancelled" ? "border-l-red-400"
                : meeting.status === "rescheduled" ? "border-l-orange-400"
                : isTodayMeeting ? "border-l-orange-400"
                : "border-l-blue-400";
              
              const cardBg = isTodayMeeting ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800" : "bg-card border-border";

              return (
                <div key={meeting.id}>
                  {/* Card */}
                  <div className={`border border-l-4 ${cardBorderLeft} ${cardBg} rounded-xl shadow-sm p-3 transition-colors`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold truncate">{meeting.title}</span>
                          {isTodayMeeting && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                              Hoje
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${status.color} bg-background/60 dark:bg-background/40 border border-border/50`}
                          >
                            {status.icon}
                            {status.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground/70" />
                            {format(start, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground/70" />
                            {format(start, "HH:mm")} - {format(end, "HH:mm")}
                          </span>
                          {meeting.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 text-muted-foreground/70" />
                              {meeting.location}
                            </span>
                          )}
                          {leadPhone && (
                            <button
                              type="button"
                              title="Abrir WhatsApp"
                              className="ml-auto text-green-500 hover:text-green-600 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                const cleaned = leadPhone.replace(/\D/g, '');
                                const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                                window.open(`https://wa.me/${number}`, '_blank');
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </button>
                          )}
                        </div>

                        {meeting.description && (
                          <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-2">
                            {meeting.description}
                          </p>
                        )}

                        {/* Send Zoom link via WhatsApp button */}
                        {(leadData?.link_zoom || (meeting.location && meeting.location.startsWith("http"))) && (!meeting.status || meeting.status === "scheduled") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 h-8 text-xs gap-1.5 font-semibold border-green-400 text-green-700 bg-green-50 hover:bg-green-100 dark:border-green-600 dark:text-green-400 dark:bg-green-950/20 dark:hover:bg-green-950/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendZoomToWhatsApp(meeting);
                            }}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Enviar Link para os Leads
                          </Button>
                        )}

                        {(!meeting.status || meeting.status === "scheduled") && recordingMeetingId === meeting.id && recorder.isRecording ? (
                          <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                              </span>
                              <span className="text-xs font-medium text-destructive">Gravando</span>
                              <span className="text-xs font-mono text-muted-foreground">{formatDuration(recorder.duration)}</span>
                            </div>
                            {recorder.partialTranscription && (
                              <div className="bg-muted/50 rounded p-2 max-h-24 overflow-y-auto">
                                <p className="text-xs text-muted-foreground">{recorder.partialTranscription}</p>
                              </div>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleStopRecording(meeting.id)}
                            >
                              <Square className="h-3 w-3" /> Finalizar Reunião
                            </Button>
                          </div>
                        ) : (!meeting.status || meeting.status === "scheduled") ? (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 flex-1 font-medium bg-transparent border-purple-400 text-purple-600 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-950/30 rounded-lg"
                              onClick={() => handleStartRecording(meeting.id)}
                              disabled={recorder.isRecording}
                            >
                              <Mic className="h-3 w-3" /> Iniciar Reunião
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 flex-1 font-medium bg-transparent border-green-400 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-950/30 rounded-lg"
                              onClick={() => statusMutation.mutate({ id: meeting.id, status: "completed" })}
                              disabled={statusMutation.isPending}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Realizada
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 flex-1 font-medium bg-transparent border-red-400 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950/30 rounded-lg"
                              onClick={() => statusMutation.mutate({ id: meeting.id, status: "cancelled" })}
                              disabled={statusMutation.isPending}
                            >
                              <XCircle className="h-3 w-3" /> Cancelada
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 flex-1 font-medium bg-transparent border-orange-400 text-orange-600 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-950/30 rounded-lg"
                              onClick={() => statusMutation.mutate({ id: meeting.id, status: "rescheduled" })}
                              disabled={statusMutation.isPending}
                            >
                              <RefreshCw className="h-3 w-3" /> Reagendada
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(meeting)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(meeting.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}
