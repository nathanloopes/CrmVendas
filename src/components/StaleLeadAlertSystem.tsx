import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMeetingStage } from "@/lib/macro-stages";
import { fetchLatestLeadStageEntries } from "@/lib/leadStageHistory";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_STALE_DAYS = 3;

function normalizeForComparison(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Stages always excluded from stale alerts (regardless of board).
// Meeting-related stages are detected dynamically per-board via isMeetingStage().
const EXCLUDED_STAGES = ["ganho", "perdido"];

function isExcludedStage(stage: string, customLabels?: Record<string, any>): boolean {
  const normalized = normalizeForComparison(stage);
  if (EXCLUDED_STAGES.some((ex) => normalized.includes(ex))) return true;
  // Skip stages that belong to the board's "Reunião" macro
  if (isMeetingStage(stage, { custom_labels: customLabels })) return true;
  // Also check custom label (legacy fallback)
  if (customLabels) {
    const label = customLabels[stage];
    if (typeof label === "string") {
      const normalizedLabel = normalizeForComparison(label);
      if (EXCLUDED_STAGES.some((ex) => normalizedLabel.includes(ex))) return true;
    }
  }
  return false;
}

function isEnvioDeCof(stage: string, customLabels?: Record<string, any>): boolean {
  const normalized = normalizeForComparison(stage);
  if (normalized.includes("contrato") || normalized.includes("envio de cof")) return true;
  if (customLabels) {
    const label = customLabels[stage];
    if (typeof label === "string") {
      const normalizedLabel = normalizeForComparison(label);
      if (normalizedLabel.includes("envio de cof") || normalizedLabel.includes("contrato")) return true;
    }
  }
  return false;
}

export function StaleLeadAlertSystem() {
  const { user } = useAuth();
  const notifiedRef = useRef<Map<string, number>>(new Map());

  // Get configurable stale days and notify interval
  const { data: staleSettings } = useQuery({
    queryKey: ["stale-lead-alert-days"],
    queryFn: async () => {
      const { data } = await supabase
        .from("global_kanban_settings")
        .select("custom_labels")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .single();
      const labels = data?.custom_labels as Record<string, any> | null;
      return {
        days: labels?.__stale_lead_alert_days__ ? Number(labels.__stale_lead_alert_days__) : DEFAULT_STALE_DAYS,
        intervalHours: labels?.__stale_lead_notify_interval_hours__ ? Number(labels.__stale_lead_notify_interval_hours__) : 24,
      };
    },
    staleTime: 300000,
    enabled: !!user,
  });

  const staleDays = staleSettings?.days ?? DEFAULT_STALE_DAYS;
  const notifyIntervalMs = (staleSettings?.intervalHours ?? 24) * 60 * 60 * 1000;

  // Get admin users with funcao Administrativo
  const { data: adminUsers = [] } = useQuery({
    queryKey: ["admin-funcao-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, funcao")
        .ilike("funcao", "%administrativo%");
      return data || [];
    },
    staleTime: 300000,
    enabled: !!user,
  });

  // Poll for stale leads
  const { data: staleLeads = [] } = useQuery({
    queryKey: ["stale-leads-check", staleDays],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - staleDays);

      // Get all leads with their current stage
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, stage, sdr_responsible_id, board_id")
        .not("stage", "is", null);

      if (!leads || leads.length === 0) return [];

      // Get the latest stage history for each lead
      const leadIds = leads.map((l) => l.id);
      const latestEntry = await fetchLatestLeadStageEntries(leadIds);

      // Get board custom labels for stage name resolution
      const boardIds = [...new Set(leads.map((l) => l.board_id).filter(Boolean))];
      let boardLabels: Record<string, Record<string, any>> = {};
      if (boardIds.length > 0) {
        const { data: boards } = await supabase
          .from("kanban_boards")
          .select("id, custom_labels")
          .in("id", boardIds as string[]);
        boards?.forEach((b) => {
          if (b.custom_labels) boardLabels[b.id] = b.custom_labels as Record<string, any>;
        });
      }

      return leads.filter((lead) => {
        const entryTime = latestEntry[lead.id] || lead.id; // fallback won't match but safe
        if (!latestEntry[lead.id]) return false; // no history, skip
        const entryDate = new Date(entryTime);
        if (entryDate > cutoff) return false; // not stale yet
        const labels = lead.board_id ? boardLabels[lead.board_id] : undefined;
        if (isExcludedStage(lead.stage || "", labels)) return false;
        return true;
      }).map((lead) => ({
        ...lead,
        customLabels: lead.board_id ? boardLabels[lead.board_id] : undefined,
        staleDate: latestEntry[lead.id],
      }));
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: POLL_INTERVAL - 10000,
    enabled: !!user,
  });

  useEffect(() => {
    if (!staleLeads || staleLeads.length === 0) return;

    const sendNotifications = async () => {
      for (const lead of staleLeads) {
        const notifKey = lead.id;
        const lastNotified = notifiedRef.current.get(notifKey);
        if (lastNotified && (Date.now() - lastNotified) < notifyIntervalMs) continue;

        const days = Math.floor(
          (Date.now() - new Date(lead.staleDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const stageName = (lead.customLabels?.[lead.stage || ""] as string) || lead.stage || "Desconhecido";
        const message = `Lead "${lead.name || "Sem nome"}" está parado em "${stageName}" há ${days} dias`;

        const isCof = isEnvioDeCof(lead.stage || "", lead.customLabels);

        if (isCof) {
          // Notify administrative users
          for (const adminUser of adminUsers) {
            await supabase.rpc("create_notification", {
              p_user_id: adminUser.id,
              p_type: "stage_move",
              p_message: message,
              p_source_id: lead.id,
              p_metadata: { lead_name: lead.name, stage: lead.stage, days_stale: days },
            });
          }
        } else if (lead.sdr_responsible_id) {
          await supabase.rpc("create_notification", {
            p_user_id: lead.sdr_responsible_id,
            p_type: "stage_move",
            p_message: message,
            p_source_id: lead.id,
            p_metadata: { lead_name: lead.name, stage: lead.stage, days_stale: days },
          });
        }

        notifiedRef.current.set(notifKey, Date.now());
      }
    };

    sendNotifications();
  }, [staleLeads, adminUsers]);

  return null;
}
