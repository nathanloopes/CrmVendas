import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { KanbanColumn } from "./KanbanColumn";
import { LeadDetailDialog } from "./LeadDetailDialog";
import { LostReasonDialog } from "./LostReasonDialog";
import { toast } from "sonner";
import { startOfDay, endOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import type { LeadFilterValues } from "./LeadFilters";
import { getAdministrativeResponsibleForStage } from "@/lib/admin-stage-rules";
import { useRecalculateLeadScore } from "@/hooks/useRecalculateLeadScore";
import { getMeetingDayStage } from "@/lib/macro-stages";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { KanbanDensity, KanbanColumnWidth } from "@/hooks/use-kanban-layout-prefs";
import { fetchLatestLeadStageEntries } from "@/lib/leadStageHistory";

type Lead = Tables<"leads">;

const VIRTUAL_STAGE = "reuniao-do-dia";

/** Normalize a stage name to a comparable key (no accents, lowercase, spaces→hyphens) */
function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

/** Check if a stage name is equivalent to "reuniao-do-dia" */
function isReuniaoDoDia(stage: string): boolean {
  return normalizeForCompare(stage) === "reuniao-do-dia";
}

function isGanho(s: string): boolean { return normalizeForCompare(s) === "ganho"; }
function isPerdido(s: string): boolean { return normalizeForCompare(s) === "perdido"; }

interface KanbanBoardProps {
  leads: Lead[];
  stages: string[];
  customLabels?: Record<string, any>;
  filters: LeadFilterValues;
  onFilteredCountChange?: (count: number) => void;
  density?: KanbanDensity;
  columnWidth?: KanbanColumnWidth;
  collapsedColumns?: string[];
  onToggleColumnCollapsed?: (stage: string) => void;
}

export function KanbanBoard({
  leads, stages, customLabels, filters,
  onFilteredCountChange,
  density = "comfortable",
  columnWidth = "default",
  collapsedColumns = [],
  onToggleColumnCollapsed,
}: KanbanBoardProps) {
  const stageColors = (customLabels?.__stage_colors__ as Record<string, string>) || {};
  const stageDescriptions = (customLabels?.__stage_descriptions__ as Record<string, string>) || {};
  const stageNotifications = (customLabels?.__stage_notifications__ as Record<string, string[]>) || {};
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const recalcScore = useRecalculateLeadScore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [defaultTab, setDefaultTab] = useState("dados");
  const [lostReasonOpen, setLostReasonOpen] = useState(false);
  const [pendingLostLead, setPendingLostLead] = useState<{ leadId: string; oldStage: string } | null>(null);

  // Fetch current user name for notification messages
  const { data: currentUserData } = useQuery({
    queryKey: ["current-user-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("users").select("name").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 300000,
  });

  const sendStageNotifications = useCallback(async (leadId: string, leadName: string, newStage: string) => {
    const recipients = stageNotifications[newStage];
    if (!recipients || recipients.length === 0) return;

    const moverName = currentUserData?.name || "Alguém";
    const now = format(new Date(), "HH:mm", { locale: ptBR });
    const message = `Lead ${leadName || "Sem nome"} movido para ${newStage} por ${moverName} às ${now}`;

    for (const recipientId of recipients) {
      // Send to all configured recipients, including the mover
      const { error: rpcError } = await supabase.rpc("create_notification", {
        p_user_id: recipientId,
        p_type: "stage_move",
        p_message: message,
        p_source_id: leadId,
      });
      if (rpcError) {
        console.error("Notification RPC error for recipient", recipientId, ":", rpcError);
      }
    }
  }, [stageNotifications, currentUserData?.name, user?.id]);
  // Open lead from URL search param (e.g. from notification click)
  useEffect(() => {
    const openLeadId = searchParams.get("openLead");
    if (!openLeadId) return;

    const openTab = searchParams.get("openTab") || "notas";

    const clearParams = () => {
      setSearchParams((prev) => { prev.delete("openLead"); prev.delete("openTab"); return prev; }, { replace: true });
    };

    // Try to find in loaded leads
    const lead = leadsById.get(openLeadId);
    if (lead) {
      setDefaultTab(openTab);
      setSelectedLead(lead);
      clearParams();
    } else if (leads.length > 0) {
      // Lead not in this board — fetch individually
      supabase
        .from("leads")
        .select("*")
        .eq("id", openLeadId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setDefaultTab(openTab);
            setSelectedLead(data as unknown as Lead);
          }
          clearParams();
        });
    }
  }, [searchParams, leads]);

  const { data: lostReasons = [] } = useQuery({
    queryKey: ["lost-reasons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("global_kanban_settings")
        .select("lost_reasons")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .maybeSingle();
      return (data?.lost_reasons as string[]) || [];
    },
    staleTime: 300000,
  });

  // Fetch today's calendar events to identify leads with meetings today
  const todayStable = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => todayStable.toISOString().slice(0, 10), [todayStable]);
  const { data: todayEventLeadIds = [] } = useQuery({
    queryKey: ["today-meeting-leads", todayStr],
    queryFn: async () => {
      const dayStart = startOfDay(todayStable).toISOString();
      const dayEnd = endOfDay(todayStable).toISOString();
      const { data } = await supabase
        .from("calendar_events")
        .select("lead_id")
        .gte("start_datetime", dayStart)
        .lte("start_datetime", dayEnd)
        .not("lead_id", "is", null)
        .eq("status", "scheduled");
      const ids = new Set<string>();
      data?.forEach((e) => { if (e.lead_id) ids.add(e.lead_id); });
      return Array.from(ids);
    },
    staleTime: 10000,
    refetchOnMount: "always",
    refetchInterval: 30000,
  });

  const todayIdsKey = todayEventLeadIds.join(",");
  const todayMeetingSet = useMemo(() => new Set(todayEventLeadIds), [todayIdsKey]);

  // O(1) lookup index used by drag/bulk handlers (replaces leads.find loops)
  const leadsById = useMemo(() => {
    const m = new Map<string, Lead>();
    leads.forEach((l) => m.set(l.id, l));
    return m;
  }, [leads]);

  // Single batched query for stage entry timestamps across the whole board.
  // Previously each KanbanColumn fired its own query (N requests per render).
  const allLeadIdsKey = leads.map((l) => l.id).join(",");
  const { data: stageEntryMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["board-stage-entry-times", allLeadIdsKey],
    queryFn: async () => {
      const ids = allLeadIdsKey ? allLeadIdsKey.split(",") : [];
      if (ids.length === 0) return {};
      return fetchLatestLeadStageEntries(ids);
    },
    staleTime: 120000,
    enabled: allLeadIdsKey.length > 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.source?.toLowerCase().includes(q) ||
          (l.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filters.city) result = result.filter((l) => l.city === filters.city);
    if (filters.source) result = result.filter((l) => l.source === filters.source);
    if (filters.assignedTo) result = result.filter((l) =>
      l.assigned_to === filters.assignedTo ||
      l.sdr_responsible_id === filters.assignedTo ||
      l.commercial_responsible_id === filters.assignedTo ||
      (l as any).administrative_responsible_id === filters.assignedTo
    );
    if (filters.stages?.length) {
      const set = new Set(filters.stages.map((s) => s.toLowerCase()));
      result = result.filter((l) => set.has((l.stage || "").toLowerCase()));
    }
    if (filters.tags?.length) {
      const set = new Set(filters.tags);
      result = result.filter((l) => (l.tags || []).some((t) => set.has(t)));
    }
    if (filters.createdWithin) {
      const days = parseInt(filters.createdWithin);
      if (!isNaN(days)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        result = result.filter((l) => l.created_at && new Date(l.created_at) >= cutoff);
      }
    }
    if (filters.meetingToday) {
      result = result.filter((l) => todayMeetingSet.has(l.id));
    }
    if (filters.minScore) {
      const minScore = filters.minScore;
      if (minScore === "hot") result = result.filter((l) => (l.lead_score ?? 0) >= 70);
      else if (minScore === "warm") result = result.filter((l) => (l.lead_score ?? 0) >= 40 && (l.lead_score ?? 0) < 70);
      else if (minScore === "cold") result = result.filter((l) => (l.lead_score ?? 0) < 40);
    }
    if (filters.inactiveDays) {
      const days = parseInt(filters.inactiveDays);
      if (!isNaN(days)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        result = result.filter((l) => {
          if (!l.updated_at) return true;
          return new Date(l.updated_at) < cutoff;
        });
      }
    }
    return result;
  }, [leads, debouncedSearch, filters, todayMeetingSet]);

  // Notify parent about filtered count
  useEffect(() => {
    onFilteredCountChange?.(filteredLeads.length);
  }, [filteredLeads.length, onFilteredCountChange]);

  // Detect if the board already has a real stage equivalent to "reuniao-do-dia"
  // OR fall back to the first stage of the "Reunião" macro (id "reu") so boards
  // without a literal "Reunião do Dia" column (e.g. Paraguai) still group
  // today's meetings into a sensible bucket.
  const realMeetingStage = useMemo(() => {
    const literal = stages.find((s) => isReuniaoDoDia(s));
    if (literal) return literal;
    const macroFirst = getMeetingDayStage({ custom_labels: customLabels });
    if (macroFirst && stages.includes(macroFirst)) return macroFirst;
    return undefined;
  }, [stages, customLabels]);

  const meetingStageKey = realMeetingStage || VIRTUAL_STAGE;

  const { leadsByStage, renderStages } = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    stages.forEach((s) => (map[s] = []));
    // Only create virtual key if there's no real equivalent
    if (!realMeetingStage) {
      map[meetingStageKey] = [];
    }

    // Build case-insensitive lookup: lowercase stage → real stage key
    const stageMap = new Map<string, string>();
    stages.forEach((s) => stageMap.set(s.toLowerCase(), s));

    filteredLeads.forEach((l) => {
      const rawStage = l.stage || stages[0] || "captação";

      // If lead has a meeting today, show ONLY in the meeting-day bucket column
      // (the literal "Reunião do Dia" stage when it exists, otherwise the
      // first stage of the board's "Reunião" macro).
      if (todayMeetingSet.has(l.id) && rawStage.toLowerCase() !== meetingStageKey.toLowerCase()) {
        map[meetingStageKey].push(l);
        return;
      }

      const matchedStage = stageMap.get(rawStage.toLowerCase());
      if (matchedStage && map[matchedStage]) {
        map[matchedStage].push(l);
      } else if (map[stages[0]]) {
        map[stages[0]].push(l);
      }
    });

    // Build render stages
    let finalStages = [...stages];
    if (!realMeetingStage && map[meetingStageKey].length > 0) {
      // Insert virtual column before ganho/perdido
      const ganhoIdx = finalStages.findIndex((s) => isGanho(s));
      const perdidoIdx = finalStages.findIndex((s) => isPerdido(s));
      const insertIdx = Math.min(
        ganhoIdx >= 0 ? ganhoIdx : finalStages.length,
        perdidoIdx >= 0 ? perdidoIdx : finalStages.length
      );
      finalStages.splice(insertIdx, 0, meetingStageKey);
    }

    // Sort each column by lead_score descending (highest first, null last)
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (b.lead_score ?? -1) - (a.lead_score ?? -1))
    );

    return { leadsByStage: map, renderStages: finalStages };
  }, [filteredLeads, stages, todayMeetingSet, realMeetingStage, meetingStageKey]);

  const moveMutation = useMutation({
    mutationFn: async ({ leadId, newStage, oldStage }: { leadId: string; newStage: string; oldStage: string }) => {
      const lead = leadsById.get(leadId);
      const adminAuto = getAdministrativeResponsibleForStage(
        newStage,
        (lead as any)?.administrative_responsible_id
      );
      const updatePayload: {
        stage: string;
        updated_at: string;
        administrative_responsible_id?: string;
      } = {
        stage: newStage,
        updated_at: new Date().toISOString(),
      };
      if (adminAuto) updatePayload.administrative_responsible_id = adminAuto;

      const { error: updateError } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", leadId);
      if (updateError) throw updateError;

      await supabase.from("lead_stage_history").insert({
        lead_id: leadId,
        old_stage: oldStage,
        new_stage: newStage,
        changed_by: user?.id || null,
      });

      // Send stage move notifications
      await sendStageNotifications(leadId, lead?.name || "", newStage);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      // Regra automática: stage mudou → score recalcula
      recalcScore.mutate(variables.leadId);
    },
    onError: () => toast.error("Erro ao mover lead"),
  });

  const handleBulkStageChange = useCallback(async (leadIds: string[], newStage: string) => {
    if (isPerdido(newStage)) {
      if (leadIds.length > 0) {
        const lead = leadsById.get(leadIds[0]);
        const oldStage = lead?.stage || stages[0] || "captação";
        setPendingLostLead({ leadId: leadIds[0], oldStage });
        setLostReasonOpen(true);
      }
      return;
    }

    try {
      // Bulk: aplica admin somente para os leads que ainda não têm um responsável administrativo.
      const adminCandidate = getAdministrativeResponsibleForStage(newStage, null);
      if (adminCandidate) {
        const idsWithoutAdmin = leadIds.filter(
          (id) => !((leadsById.get(id) as any)?.administrative_responsible_id)
        );
        if (idsWithoutAdmin.length > 0) {
          await supabase
            .from("leads")
            .update({ administrative_responsible_id: adminCandidate })
            .in("id", idsWithoutAdmin);
        }
      }

      const { error } = await supabase
        .from("leads")
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .in("id", leadIds);
      if (error) throw error;

      // Insert history for each lead using their real stage
      const historyRows = leadIds.map((id) => {
        const lead = leadsById.get(id);
        return {
          lead_id: id,
          old_stage: lead?.stage || stages[0] || "captação",
          new_stage: newStage,
          changed_by: user?.id || null,
        };
      });
      await supabase.from("lead_stage_history").insert(historyRows);

      // Send stage move notifications for each lead
      for (const id of leadIds) {
        const lead = leadsById.get(id);
        await sendStageNotifications(id, lead?.name || "", newStage);
      }

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      // Regra automática: stage mudou em massa → recalcula score de cada lead
      recalcScore.mutate(leadIds);
      toast.success(`${leadIds.length} lead${leadIds.length > 1 ? "s" : ""} movido${leadIds.length > 1 ? "s" : ""} para ${newStage}`);
    } catch {
      toast.error("Erro ao mover leads em massa");
    }
  }, [user?.id, queryClient, leadsById, stages, sendStageNotifications, recalcScore]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const lead = leadsById.get(leadId);
    if (!lead) return;

    let targetStage = over.id as string;

    // If over.id is not a known stage, it's a lead ID — resolve which column it belongs to
    if (!stages.includes(targetStage) && !isReuniaoDoDia(targetStage)) {
      const foundStage = Object.keys(leadsByStage).find((s) =>
        leadsByStage[s].some((l) => l.id === targetStage)
      );
      if (!foundStage) return;
      targetStage = foundStage;
    }

    // Can't drop into the virtual meeting-today column (only block if it's not a real stage)
    if (isReuniaoDoDia(targetStage) && !realMeetingStage) return;

    const oldStage = lead.stage || stages[0] || "captação";
    if (targetStage === oldStage || !stages.includes(targetStage)) return;

    if (isPerdido(targetStage)) {
      setPendingLostLead({ leadId, oldStage });
      setLostReasonOpen(true);
      return;
    }

    moveMutation.mutate({ leadId, newStage: targetStage, oldStage });
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 pb-4 h-full w-max">
          {renderStages.map((stage, idx) => {
            const isMeetingCol = isReuniaoDoDia(stage);
            const pipelineStages = renderStages.filter((s) => !isGanho(s) && !isPerdido(s) && !isReuniaoDoDia(s));
            const pipelineIndex = pipelineStages.indexOf(stage);
            return (
              <KanbanColumn
                key={stage}
                stage={stage}
                label={isMeetingCol && !realMeetingStage ? "Reunião Do Dia" : (customLabels?.[stage] as string | undefined)}
                color={stageColors[stage]}
                description={isMeetingCol && !realMeetingStage ? "Leads com reunião agendada para hoje" : stageDescriptions[stage]}
                leads={leadsByStage[stage] || []}
                onLeadClick={(lead) => { setDefaultTab("dados"); setSelectedLead(lead); }}
                onScoreClick={(lead) => { setDefaultTab("score"); setSelectedLead(lead); }}
                stageIndex={pipelineIndex >= 0 ? pipelineIndex : idx}
                totalPipelineStages={pipelineStages.length}
                isMeetingToday={isMeetingCol}
                stages={stages}
                customLabels={customLabels}
                onStageChange={(lead, newStage) => {
                  const oldStage = lead.stage || stages[0] || "captação";
                  if (isPerdido(newStage)) {
                    setPendingLostLead({ leadId: lead.id, oldStage });
                    setLostReasonOpen(true);
                  } else {
                    moveMutation.mutate({ leadId: lead.id, newStage, oldStage });
                  }
                }}
                onBulkStageChange={handleBulkStageChange}
                stageEntryMap={stageEntryMap}
                density={density}
                columnWidth={columnWidth}
                collapsed={collapsedColumns.includes(stage)}
                onToggleCollapsed={onToggleColumnCollapsed ? () => onToggleColumnCollapsed(stage) : undefined}
              />
            );
          })}
        </div>
      </DndContext>

      <LeadDetailDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        defaultTab={defaultTab}
        stages={stages}
        customLabels={customLabels}
        onStageChange={(lead, newStage) => {
          const oldStage = lead.stage || stages[0] || "captação";
          if (isPerdido(newStage)) {
            setPendingLostLead({ leadId: lead.id, oldStage });
            setLostReasonOpen(true);
          } else {
            moveMutation.mutate({ leadId: lead.id, newStage, oldStage });
          }
        }}
      />

      <LostReasonDialog
        open={lostReasonOpen}
        reasons={lostReasons}
        onConfirm={async (reason) => {
          if (!pendingLostLead) return;
          setLostReasonOpen(false);
          const { leadId, oldStage } = pendingLostLead;
          await supabase
            .from("leads")
            .update({ lost_reason: reason })
            .eq("id", leadId);
          moveMutation.mutate({ leadId, newStage: "perdido", oldStage });
          setPendingLostLead(null);
        }}
        onCancel={() => {
          setLostReasonOpen(false);
          setPendingLostLead(null);
        }}
      />
    </>
  );
}
