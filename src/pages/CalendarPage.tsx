import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarView } from "@/components/calendar/CalendarView";
import { EventDialog } from "@/components/calendar/EventDialog";
import { LeadDetailDialog } from "@/components/leads/LeadDetailDialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;

export default function CalendarPage() {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const eventIdParam = searchParams.get("eventId");
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (dateParam) {
      const parsed = new Date(dateParam + "T00:00:00");
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const [transcriptionLeadId, setTranscriptionLeadId] = useState<string | null>(null);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);

  const { data: kanbanSettings } = useQuery({
    queryKey: ["global-kanban-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_kanban_settings")
        .select("stage_order, custom_labels")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const stages = (kanbanSettings?.stage_order as string[]) || [];
  const customLabels = (kanbanSettings?.custom_labels as Record<string, any>) || {};

  const { data: transcriptionLead } = useQuery({
    queryKey: ["lead-for-transcription", transcriptionLeadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", transcriptionLeadId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!transcriptionLeadId,
  });

  useEffect(() => {
    if (transcriptionLead && transcriptionLeadId) {
      setLeadDialogOpen(true);
    }
  }, [transcriptionLead, transcriptionLeadId]);

  useEffect(() => {
    if (!eventIdParam) return;
    const fetchEvent = async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("id", eventIdParam)
        .maybeSingle();
      if (data) {
        setSelectedEvent(data);
        setDialogOpen(true);
      }
    };
    fetchEvent();
  }, [eventIdParam]);

  const rangeStart = startOfWeek(startOfMonth(currentMonth)).toISOString();
  const rangeEnd = endOfWeek(endOfMonth(currentMonth)).toISOString();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar-events", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_datetime", rangeStart)
        .lte("start_datetime", rangeEnd)
        .order("start_datetime");
      if (error) throw error;
      return data;
    },
  });

  const handleDayClick = (date: Date) => {
    setSelectedEvent(null);
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(undefined);
    setDialogOpen(true);
  };

  const handleMeetingCompleted = (leadId: string) => {
    setTranscriptionLeadId(leadId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Calendário</h1>
        <Button className="rounded-xl shadow-sm" onClick={() => { setSelectedEvent(null); setSelectedDate(new Date()); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Evento
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold min-w-[10rem] text-center capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setCurrentMonth(new Date())}>
            Hoje
          </Button>
        </div>

        <CalendarView
          currentMonth={currentMonth}
          events={events}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selectedEvent}
        defaultDate={selectedDate}
        stages={stages}
        customLabels={customLabels}
        onMeetingCompleted={handleMeetingCompleted}
      />

      {transcriptionLead && (
        <LeadDetailDialog
          lead={transcriptionLead}
          open={leadDialogOpen}
          onOpenChange={(o) => {
            setLeadDialogOpen(o);
            if (!o) setTranscriptionLeadId(null);
          }}
          defaultTab="reuniao"
        />
      )}
    </div>
  );
}
