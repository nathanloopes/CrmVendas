import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, TrendingUp, CheckSquare, Clock, CalendarDays, UserPlus, Trophy, XCircle } from "lucide-react";
import { formatDistanceToNow, format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KpiDrilldownDialog } from "@/components/dashboard/KpiDrilldownDialog";
import { PieChartCard } from "@/components/dashboard/PieChartCard";
import { LostLeadsPieChart } from "@/components/dashboard/LostLeadsPieChart";
import { LeadDetailDialog } from "@/components/leads/LeadDetailDialog";
import type { Tables } from "@/integrations/supabase/types";
import { normalizeStage, isLostStage, isWonStage } from "@/lib/stage-utils";
import { getStageColorMap } from "@/lib/stage-colors";
import { getStageLabel } from "@/lib/stage-labels";
import { PeriodKpiCard } from "@/components/dashboard/PeriodKpiCard";
import { LiveKanbanBoard } from "@/components/dashboard/LiveKanbanBoard";
import { StageConversionAnalysis } from "@/components/dashboard/StageConversionAnalysis";
import { getMacroStages, getMacroForStage } from "@/lib/macro-stages";

type PresetKey = "hoje" | "semana" | "mes" | "ano" | "todos";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "ano", label: "Este ano" },
  { key: "todos", label: "Todo período" },
];

function getPresetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (key) {
    case "hoje":
      return { from: fmt(startOfDay(now)), to: fmt(endOfDay(now)) };
    case "semana":
      return { from: fmt(startOfWeek(now, { locale: ptBR })), to: fmt(endOfWeek(now, { locale: ptBR })) };
    case "mes":
      return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
    case "ano":
      return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) };
    case "todos":
      return { from: "", to: "" };
  }
}

export default function Index() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Realtime sync: refresh boards when settings (names, order, colors) change
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-kanban-boards-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_boards" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kanban-boards-full"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Global date filter — default: today
  const [activePreset, setActivePreset] = useState<PresetKey>("hoje");
  const initialRange = getPresetRange("hoje");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);

  const [drilldown, setDrilldown] = useState<{ open: boolean; type: string; title: string }>({
    open: false,
    type: "",
    title: "",
  });
  const [pieFilteredLeads, setPieFilteredLeads] = useState<typeof leads>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDialogTab, setLeadDialogTab] = useState<string>("dados");
  

  const handlePreset = (key: PresetKey) => {
    setActivePreset(key);
    const range = getPresetRange(key);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const handleDateChange = (field: "from" | "to", value: string) => {
    setActivePreset("hoje"); // deselect preset visually — will show as custom
    if (field === "from") setDateFrom(value);
    else setDateTo(value);
    // Mark as custom (no preset matches)
    setActivePreset(undefined as any);
  };

  // ---------- Queries ----------
  const { data: leads = [] } = useQuery({
    queryKey: ["dashboard-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, email, city, state, stage, source, lost_reason, created_at, updated_at, board_id")
        .range(0, 4999);
      return data || [];
    },
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ["dashboard-all-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, status, priority, lead_id")
        .eq("status", "pending")
        .order("due_date", { ascending: true });
      return data || [];
    },
  });

  const { data: allNotes = [] } = useQuery({
    queryKey: ["dashboard-notes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_notes")
        .select("id, content, type, created_at, lead_id")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: stageOrder = [] } = useQuery({
    queryKey: ["stage-order"],
    queryFn: async () => {
      const { data } = await supabase
        .from("global_kanban_settings")
        .select("stage_order")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .single();
      return (data?.stage_order as string[]) || [];
    },
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("kanban_boards")
        .select("id, name, stage_order, custom_labels, sort_order, is_global")
        .eq("is_global", true)
        .order("sort_order", { ascending: true });
      return data || [];
    },
  });

  const activeBoard = boards[0];
  const customLabels = useMemo(() => {
    const labels = (activeBoard?.custom_labels as Record<string, string>) || {};
    const { __stage_colors__: _, __stage_descriptions__: __, __macro_stages__: ___, ...rest } = labels as any;
    return rest as Record<string, string>;
  }, [activeBoard]);

  // Macro stages for conversion KPI (when configured)
  const activeMacros = useMemo(() => getMacroStages(activeBoard), [activeBoard]);
  const primaryMacros = useMemo(() => activeMacros.filter((m) => m.type === "primary"), [activeMacros]);

  const { data: selectedLead = null } = useQuery({
    queryKey: ["dashboard-lead-detail", selectedLeadId],
    queryFn: async () => {
      if (!selectedLeadId) return null;
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, email, city, state, interest, investment, stage, source, tags, assigned_to, board_id, created_at, updated_at, lead_score, city_available, nearest_available_city, additional_contact_name, lost_reason, last_contact, next_contact, sdr_responsible_id, commercial_responsible_id, modelo_loja, tipo_proprietario, state_of_interest, city_of_interest")
        .eq("id", selectedLeadId)
        .single();
      return data as unknown as Tables<"leads"> | null;
    },
    enabled: !!selectedLeadId,
  });

  // ---------- Filtered data ----------
  const isInRange = (dateStr: string) => {
    if (!dateFrom && !dateTo) return true; // "todos"
    const d = new Date(dateStr);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  };

  const filteredLeads = useMemo(() => leads.filter((l) => isInRange(l.created_at)), [leads, dateFrom, dateTo]);
  const filteredTasks = useMemo(() => allTasks.filter((t) => t.due_date ? isInRange(t.due_date) : isInRange(new Date().toISOString())), [allTasks, dateFrom, dateTo]);
  const filteredNotes = useMemo(() => allNotes.filter((n) => isInRange(n.created_at)).slice(0, 8), [allNotes, dateFrom, dateTo]);

  // ---------- KPIs ----------
  const totalLeads = filteredLeads.length;
  const wonLeads = filteredLeads.filter((l) => isWonStage(l.stage));

  // Conversion rate uses primary macro funnel when defined:
  // leads in last primary macro / leads in first primary macro.
  // Fallback: won / total.
  const conversionRate = useMemo(() => {
    if (primaryMacros.length >= 2) {
      const firstMacro = primaryMacros[0];
      const lastMacro = primaryMacros[primaryMacros.length - 1];
      let entered = 0;
      let reached = 0;
      for (const l of filteredLeads) {
        const m = getMacroForStage(l.stage, primaryMacros);
        if (!m) continue;
        // "entered the funnel" = is in any primary macro at or after first
        entered += 1;
        if (m.id === lastMacro.id) reached += 1;
      }
      return entered > 0 ? ((reached / entered) * 100).toFixed(1) : "0";
    }
    return totalLeads > 0 ? ((wonLeads.length / totalLeads) * 100).toFixed(1) : "0";
  }, [primaryMacros, filteredLeads, totalLeads, wonLeads.length]);

  const pendingTasks = filteredTasks.length;

  // Funnel data
  const funnelStageCounts = filteredLeads.reduce<Record<string, number>>((acc, l) => {
    const stage = normalizeStage(l.stage);
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  const orderedStages = stageOrder.length > 0 ? stageOrder : Object.keys(funnelStageCounts);
  // Include stages from data that aren't in orderedStages
  const extraStages = Object.keys(funnelStageCounts).filter((s) => !orderedStages.includes(s));
  const allStages = [...orderedStages, ...extraStages];
  const funnelData = allStages
    .filter((s) => s !== "perdido" && s !== "ganho" && funnelStageCounts[s])
    .map((stage) => ({
      name: getStageLabel(stage, customLabels),
      stageKey: stage,
      value: funnelStageCounts[stage] || 0,
      color: getStageColorMap(stageOrder)[stage] || "hsl(221, 83%, 53%)",
    }));

  // Drill-down
  const handleKpiClick = (type: string) => {
    const titles: Record<string, string> = {
      total: "Total de Leads",
      won: "Leads Ganhos (Conversão)",
      tasks: "Tarefas Pendentes",
    };
    setDrilldown({ open: true, type, title: titles[type] || "" });
  };

  const getDrilldownLeads = () => {
    switch (drilldown.type) {
      case "total":
        return filteredLeads;
      case "won":
        return wonLeads;
      case "pie-stage":
      case "pie-lost":
      case "funnel":
        return pieFilteredLeads;
      default:
        return [];
    }
  };

  const periodLabel = activePreset
    ? PRESETS.find((p) => p.key === activePreset)?.label || "Personalizado"
    : "Personalizado";

  const kpis = [
    { label: "Total de Leads", value: totalLeads, icon: Users, color: "text-primary", type: "total" },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-[hsl(var(--success))]", type: "won" },
    { label: "Tarefas Pendentes", value: pendingTasks, icon: CheckSquare, color: "text-[hsl(var(--warning))]", type: "tasks" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Olá, {profile?.name?.split(" ")[0] || "Usuário"} 👋
        </h1>
        <p className="text-sm text-muted-foreground">Aqui está o resumo do seu pipeline.</p>
      </div>

      {/* Global Date Filter */}
      <Card className="rounded-xl shadow-sm border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarDays className="w-5 h-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-muted-foreground mr-1">Período:</span>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => handlePreset(p.key)}
                className={`h-8 px-3 text-xs font-medium rounded-lg transition-colors ${
                  activePreset === p.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">De:</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateChange("from", e.target.value)}
                className="h-8 w-auto text-xs"
              />
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Até:</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateChange("to", e.target.value)}
                className="h-8 w-auto text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period View — follows global filter */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Visão por Período — {periodLabel}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PeriodKpiCard
            title="Novos Leads"
            icon={UserPlus}
            accentClass="border-l-[hsl(var(--success))]"
            iconColorClass="text-[hsl(var(--success))]"
            leads={leads as any}
            dateField="created_at"
            customLabels={customLabels}
            externalRange={{
              from: dateFrom ? new Date(dateFrom) : null,
              to: dateTo ? new Date(dateTo + "T23:59:59") : null,
              label: periodLabel,
            }}
            onLeadClick={(id) => { setSelectedLeadId(id); setLeadDialogTab("dados"); }}
          />
          <PeriodKpiCard
            title="Contratos Fechados"
            icon={Trophy}
            accentClass="border-l-primary"
            iconColorClass="text-primary"
            leads={leads as any}
            dateField="updated_at"
            filterFn={(l) => isWonStage(l.stage)}
            customLabels={customLabels}
            externalRange={{
              from: dateFrom ? new Date(dateFrom) : null,
              to: dateTo ? new Date(dateTo + "T23:59:59") : null,
              label: periodLabel,
            }}
            onLeadClick={(id) => { setSelectedLeadId(id); setLeadDialogTab("dados"); }}
          />
          <PeriodKpiCard
            title="Desqualificados"
            icon={XCircle}
            accentClass="border-l-destructive"
            iconColorClass="text-destructive"
            leads={leads as any}
            dateField="updated_at"
            filterFn={(l) => isLostStage(l.stage)}
            customLabels={customLabels}
            externalRange={{
              from: dateFrom ? new Date(dateFrom) : null,
              to: dateTo ? new Date(dateTo + "T23:59:59") : null,
              label: periodLabel,
            }}
            onLeadClick={(id) => { setSelectedLeadId(id); setLeadDialogTab("dados"); }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className="cursor-pointer rounded-xl shadow-sm border-border/50 transition-all hover:shadow-md hover:border-primary/30"
            onClick={() => handleKpiClick(kpi.type)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                </div>
                <kpi.icon className={`w-8 h-8 ${kpi.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Kanban Pipeline */}
      <LiveKanbanBoard
        boards={boards as any}
        globalStageOrder={stageOrder}
        onStageClick={(stageKey, stageLabel, stageLeads) => {
          setPieFilteredLeads(stageLeads as any);
          setDrilldown({ open: true, type: "pie-stage", title: `Pipeline ao Vivo — ${stageLabel}` });
        }}
      />

      {/* Stage Conversion Analysis */}
      <StageConversionAnalysis
        boards={boards as any}
        globalStageOrder={stageOrder}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onLeadsClick={(title, convLeads) => {
          setPieFilteredLeads(convLeads as any);
          setDrilldown({ open: true, type: "pie-stage", title });
        }}
      />

      {/* Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PieChartCard
          title="Distribuição de Leads por Estágio"
          leads={filteredLeads}
          stageOrder={stageOrder}
          customLabels={customLabels}
          onLegendClick={(stageKey, stageLabel) => {
            const stageLeads = filteredLeads.filter((l) => normalizeStage(l.stage) === stageKey);
            setDrilldown({ open: true, type: "pie-stage", title: `Leads — ${stageLabel}` });
            setPieFilteredLeads(stageLeads);
          }}
          onTotalClick={() => {
            const activeLeads = filteredLeads.filter((l) => {
              const ns = normalizeStage(l.stage);
              return ns !== "sem-etapa" && ns !== "perdido" && ns !== "ganho";
            });
            setDrilldown({ open: true, type: "pie-stage", title: "Todos os Leads Ativos" });
            setPieFilteredLeads(activeLeads);
          }}
        />
        <LostLeadsPieChart
          leads={filteredLeads}
          onLegendClick={(reason) => {
            const reasonLeads = filteredLeads.filter((l) => {
              if (!isLostStage(l.stage)) return false;
              const lr = l.lost_reason?.trim() || "Sem motivo informado";
              return lr === reason;
            });
            setDrilldown({ open: true, type: "pie-lost", title: `Perdidos — ${reason}` });
            setPieFilteredLeads(reasonLeads);
          }}
          onTotalClick={() => {
            const lostLeads = filteredLeads.filter((l) => isLostStage(l.stage));
            setDrilldown({ open: true, type: "pie-lost", title: "Todos os Leads Perdidos" });
            setPieFilteredLeads(lostLeads);
          }}
        />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" /> Tarefas Próximas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allTasks.length > 0 ? (
              <div className="space-y-3">
                {allTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => { if (task.lead_id) { setSelectedLeadId(task.lead_id); setLeadDialogTab("tarefas"); } }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.due_date
                          ? formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: ptBR })
                          : "Sem prazo"}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        task.priority === "high"
                          ? "bg-destructive/10 text-destructive"
                          : task.priority === "medium"
                          ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhuma tarefa no período.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            {allNotes.slice(0, 8).length > 0 ? (
              <div className="space-y-3">
                {allNotes.slice(0, 8).map((note) => (
                  <div key={note.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => { if (note.lead_id) { setSelectedLeadId(note.lead_id); setLeadDialogTab("timeline"); } }}>
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {note.type || "nota"} •{" "}
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhuma atividade no período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drill-down Dialog */}
      <KpiDrilldownDialog
        open={drilldown.open}
        onOpenChange={(open) => setDrilldown((prev) => ({ ...prev, open }))}
        title={drilldown.title}
        leads={getDrilldownLeads()}
        tasks={drilldown.type === "tasks" ? filteredTasks : []}
        mode={drilldown.type === "tasks" ? "tasks" : "leads"}
        onLeadClick={(leadId) => {
          setDrilldown((prev) => ({ ...prev, open: false }));
          setSelectedLeadId(leadId);
          setLeadDialogTab("dados");
        }}
        customLabels={customLabels}
      />

      {/* Lead Detail Dialog */}
      <LeadDetailDialog
        lead={selectedLead}
        open={!!selectedLeadId && !!selectedLead}
        onOpenChange={(open) => { if (!open) setSelectedLeadId(null); }}
        defaultTab={leadDialogTab}
      />
    </div>
  );
}
