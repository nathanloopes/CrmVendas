import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, GitBranch, TrendingDown, Clock, Users, Target, CalendarDays, LayoutGrid, Layers } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeStage } from "@/lib/stage-utils";
import { getStageColorMap } from "@/lib/stage-colors";
import { getStageLabel } from "@/lib/stage-labels";
import { getMacroStages, type MacroStage } from "@/lib/macro-stages";

type LocalPreset = "hoje" | "semana" | "mes" | "ano" | "todos" | "custom";

const LOCAL_PRESETS: { key: Exclude<LocalPreset, "custom">; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "todos", label: "Tudo" },
];

function getLocalRange(key: Exclude<LocalPreset, "custom">): { from: string; to: string } {
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

interface Board {
  id: string;
  name: string;
  stage_order: string[] | null;
  custom_labels: Record<string, string> | null;
}

interface LeadLite {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  stage: string | null;
  source: string | null;
  created_at: string;
  board_id: string | null;
}

interface StageHistoryRow {
  id: string;
  lead_id: string;
  new_stage: string;
  changed_at: string;
  leads: LeadLite | null;
}

interface StageConversionAnalysisProps {
  boards: Board[];
  globalStageOrder: string[];
  dateFrom: string;
  dateTo: string;
  onLeadsClick: (title: string, leads: LeadLite[]) => void;
}

export function StageConversionAnalysis({
  boards,
  globalStageOrder,
  dateFrom,
  dateTo,
  onLeadsClick,
}: StageConversionAnalysisProps) {
  const queryClient = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string>(boards[0]?.id || "");
  const [originStage, setOriginStage] = useState<string | null>(null);
  const [destStage, setDestStage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"status" | "macro">("macro");

  // Local period filter (independent from global dashboard filter).
  // Default = "todos" so the analysis isn't immediately empty.
  const [localPreset, setLocalPreset] = useState<LocalPreset>("todos");
  const [localFrom, setLocalFrom] = useState<string>("");
  const [localTo, setLocalTo] = useState<string>("");

  const handleLocalPreset = (key: Exclude<LocalPreset, "custom">) => {
    setLocalPreset(key);
    const r = getLocalRange(key);
    setLocalFrom(r.from);
    setLocalTo(r.to);
  };

  const handleLocalDateChange = (field: "from" | "to", value: string) => {
    if (field === "from") setLocalFrom(value);
    else setLocalTo(value);
    setLocalPreset("custom");
  };

  useEffect(() => {
    if (boards.length > 0 && !boards.find((b) => b.id === selectedBoardId)) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId]);

  const activeBoard = boards.find((b) => b.id === selectedBoardId);

  const customLabels = useMemo(() => {
    const labels = (activeBoard?.custom_labels as Record<string, string>) || {};
    const { __stage_colors__: _, __stage_descriptions__: __, __macro_stages__: ___, ...rest } = labels as any;
    return rest as Record<string, string>;
  }, [activeBoard]);

  // Macros from active board
  const macroStages: MacroStage[] = useMemo(() => getMacroStages(activeBoard), [activeBoard]);
  const primaryMacros = useMemo(() => macroStages.filter((m) => m.type === "primary"), [macroStages]);
  const hasMacros = primaryMacros.length > 0;
  const effectiveViewMode = hasMacros ? viewMode : "status";

  // Auto-sync default view mode when active board changes:
  // boards with macros default to "macro"; otherwise "status".
  useEffect(() => {
    setViewMode(hasMacros ? "macro" : "status");
  }, [selectedBoardId, hasMacros]);

  // For macro mode, build a "virtual" stage order = the macro IDs in display order.
  // We treat each macro as a "stage" whose membership is the union of its stage keys.
  // Reusing the rest of the calculation pipeline by mapping each lead's stages
  // through normalizeStage and matching against macro.stages.

  // Active pipeline stages (status mode) — exclude ganho/perdido/sem-etapa
  const stageOrderRaw = useMemo(() => {
    const order = activeBoard?.stage_order || globalStageOrder || [];
    return order
      .map((s) => normalizeStage(s))
      .filter((s) => s !== "ganho" && s !== "perdido" && s !== "sem-etapa");
  }, [activeBoard, globalStageOrder]);

  // Pipeline IDs in display order — either normalized stage keys (status mode)
  // or macro IDs (macro mode).
  const stageOrder = useMemo(() => {
    if (effectiveViewMode === "macro") return primaryMacros.map((m) => m.id);
    return stageOrderRaw;
  }, [effectiveViewMode, primaryMacros, stageOrderRaw]);

  // Resolve a pipeline ID → display label
  const pipelineLabel = (id: string) => {
    if (effectiveViewMode === "macro") {
      return primaryMacros.find((m) => m.id === id)?.name || id;
    }
    return getStageLabel(id, customLabels);
  };

  const colorMap = useMemo(
    () => getStageColorMap(activeBoard?.stage_order || globalStageOrder || []),
    [activeBoard, globalStageOrder],
  );
  const pipelineColor = (id: string) => {
    if (effectiveViewMode === "macro") {
      const m = primaryMacros.find((mm) => mm.id === id);
      const firstStage = m?.stages[0];
      return (firstStage && colorMap[normalizeStage(firstStage)]) || "hsl(var(--primary))";
    }
    return colorMap[id] || "hsl(var(--primary))";
  };

  // Map normalized stage → pipeline ID (in macro mode this is the macro ID;
  // in status mode it's the stage itself).
  const stageToPipeline = useMemo(() => {
    const map = new Map<string, string>();
    if (effectiveViewMode === "macro") {
      for (const m of primaryMacros) {
        for (const s of m.stages) map.set(normalizeStage(s), m.id);
      }
    } else {
      for (const s of stageOrderRaw) map.set(s, s);
    }
    return map;
  }, [effectiveViewMode, primaryMacros, stageOrderRaw]);

  // Default origin = first stage; default dest = last stage. Reset on mode switch.
  useEffect(() => {
    if (stageOrder.length === 0) {
      setOriginStage(null);
      setDestStage(null);
      return;
    }
    if (!originStage || !stageOrder.includes(originStage)) {
      setOriginStage(stageOrder[0]);
    }
    if (!destStage || !stageOrder.includes(destStage)) {
      setDestStage(stageOrder[stageOrder.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageOrder]);

  // Fetch stage history joined with leads (filtered by board + LOCAL period)
  const { data: history = [] } = useQuery({
    queryKey: ["stage-conversion-history", selectedBoardId, localFrom, localTo],
    queryFn: async () => {
      let query = supabase
        .from("lead_stage_history")
        .select(
          "id, lead_id, new_stage, changed_at, leads!inner(id, name, phone, email, city, state, stage, source, created_at, board_id)",
        )
        .order("changed_at", { ascending: true })
        .range(0, 19999);

      if (selectedBoardId) {
        query = query.eq("leads.board_id", selectedBoardId);
      }
      if (localFrom) {
        query = query.gte("leads.created_at", localFrom);
      }
      if (localTo) {
        query = query.lte("leads.created_at", localTo + "T23:59:59");
      }

      const { data } = await query;
      return (data || []) as unknown as StageHistoryRow[];
    },
    enabled: !!selectedBoardId,
  });

  // Also fetch leads with no history (created before tracking) for the current board+period
  const { data: rawLeads = [] } = useQuery({
    queryKey: ["stage-conversion-leads", selectedBoardId, localFrom, localTo],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id, name, phone, email, city, state, stage, source, created_at, board_id")
        .range(0, 9999);

      if (selectedBoardId) {
        query = query.eq("board_id", selectedBoardId);
      }
      if (localFrom) {
        query = query.gte("created_at", localFrom);
      }
      if (localTo) {
        query = query.lte("created_at", localTo + "T23:59:59");
      }

      const { data } = await query;
      return (data || []) as LeadLite[];
    },
    enabled: !!selectedBoardId,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("stage-conversion-analysis")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_stage_history" }, () => {
        queryClient.invalidateQueries({ queryKey: ["stage-conversion-history"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["stage-conversion-leads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Build per-lead stage data
  // leadId → Set<normalizedStage> (passed-through stages)
  // leadId → Map<normalizedStage, firstChangedAt>
  // leadId → LeadLite (representation)
  const { leadStages, leadFirstAt, leadMap } = useMemo(() => {
    const stages = new Map<string, Set<string>>();
    const firstAt = new Map<string, Map<string, number>>();
    const leadsById = new Map<string, LeadLite>();

    // Seed from rawLeads with their current stage
    for (const l of rawLeads) {
      const s = normalizeStage(l.stage);
      if (!stages.has(l.id)) stages.set(l.id, new Set());
      stages.get(l.id)!.add(s);
      if (!firstAt.has(l.id)) firstAt.set(l.id, new Map());
      const ts = new Date(l.created_at).getTime();
      const m = firstAt.get(l.id)!;
      if (!m.has(s) || ts < m.get(s)!) m.set(s, ts);
      leadsById.set(l.id, l);
    }

    // Add transitions from history
    for (const h of history) {
      if (!h.leads) continue;
      const leadId = h.lead_id;
      const newS = normalizeStage(h.new_stage);
      if (!stages.has(leadId)) stages.set(leadId, new Set());
      stages.get(leadId)!.add(newS);
      if (!firstAt.has(leadId)) firstAt.set(leadId, new Map());
      const ts = new Date(h.changed_at).getTime();
      const m = firstAt.get(leadId)!;
      if (!m.has(newS) || ts < m.get(newS)!) m.set(newS, ts);
      if (!leadsById.has(leadId)) leadsById.set(leadId, h.leads);
    }

    return { leadStages: stages, leadFirstAt: firstAt, leadMap: leadsById };
  }, [history, rawLeads]);

  // Project per-lead stage data into the active pipeline (status or macro)
  const { leadPipelineSets, leadPipelineFirstAt } = useMemo(() => {
    const sets = new Map<string, Set<string>>();
    const firstAt = new Map<string, Map<string, number>>();
    leadStages.forEach((stageSet, leadId) => {
      const pipelineSet = new Set<string>();
      const pipelineFirstAt = new Map<string, number>();
      const timeMap = leadFirstAt.get(leadId);
      stageSet.forEach((s) => {
        const pid = stageToPipeline.get(s);
        if (!pid) return;
        pipelineSet.add(pid);
        const ts = timeMap?.get(s);
        if (ts !== undefined) {
          if (!pipelineFirstAt.has(pid) || ts < pipelineFirstAt.get(pid)!) {
            pipelineFirstAt.set(pid, ts);
          }
        }
      });
      sets.set(leadId, pipelineSet);
      firstAt.set(leadId, pipelineFirstAt);
    });
    return { leadPipelineSets: sets, leadPipelineFirstAt: firstAt };
  }, [leadStages, leadFirstAt, stageToPipeline]);

  // Per-stage count: number of leads that passed through that pipeline ID
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of stageOrder) counts[stage] = 0;
    leadPipelineSets.forEach((set) => {
      for (const stage of stageOrder) {
        if (set.has(stage)) counts[stage] += 1;
      }
    });
    return counts;
  }, [leadPipelineSets, stageOrder]);

  const originIdx = originStage ? stageOrder.indexOf(originStage) : -1;
  const destIdx = destStage ? stageOrder.indexOf(destStage) : -1;
  const originCount = originStage ? stageCounts[originStage] || 0 : 0;
  const destCount = destStage ? stageCounts[destStage] || 0 : 0;
  const conversionPct = originCount > 0 ? (destCount / originCount) * 100 : 0;

  // Bottleneck: largest absolute drop between consecutive stages on path origin → dest
  const bottleneck = useMemo(() => {
    if (originIdx < 0 || destIdx < 0 || destIdx <= originIdx) return null;
    let maxDropAbs = -1;
    let maxDropPct = 0;
    let fromStage = "";
    let toStage = "";
    for (let i = originIdx; i < destIdx; i++) {
      const a = stageCounts[stageOrder[i]] || 0;
      const b = stageCounts[stageOrder[i + 1]] || 0;
      const drop = a - b;
      if (drop > maxDropAbs) {
        maxDropAbs = drop;
        maxDropPct = a > 0 ? (drop / a) * 100 : 0;
        fromStage = stageOrder[i];
        toStage = stageOrder[i + 1];
      }
    }
    if (maxDropAbs <= 0) return null;
    return { fromStage, toStage, dropAbs: maxDropAbs, dropPct: maxDropPct };
  }, [originIdx, destIdx, stageCounts, stageOrder]);

  // Median days from origin → dest for leads that completed the trajectory
  const medianDays = useMemo(() => {
    if (!originStage || !destStage) return null;
    const durations: number[] = [];
    leadPipelineFirstAt.forEach((m, leadId) => {
      const o = m.get(originStage);
      const d = m.get(destStage);
      const set = leadPipelineSets.get(leadId);
      if (o && d && d >= o && set?.has(originStage) && set?.has(destStage)) {
        durations.push((d - o) / (1000 * 60 * 60 * 24));
      }
    });
    if (durations.length === 0) return null;
    durations.sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    return durations.length % 2 === 0
      ? (durations[mid - 1] + durations[mid]) / 2
      : durations[mid];
  }, [leadPipelineFirstAt, leadPipelineSets, originStage, destStage]);

  // Leads that converted (passed origin AND dest)
  const convertedLeads = useMemo(() => {
    if (!originStage || !destStage) return [] as LeadLite[];
    const result: LeadLite[] = [];
    leadPipelineSets.forEach((set, leadId) => {
      if (set.has(originStage) && set.has(destStage)) {
        const l = leadMap.get(leadId);
        if (l) result.push(l);
      }
    });
    return result;
  }, [leadPipelineSets, leadMap, originStage, destStage]);

  // Leads lost on the way (passed origin but NOT dest)
  const lostOnWayLeads = useMemo(() => {
    if (!originStage || !destStage) return [] as LeadLite[];
    const result: LeadLite[] = [];
    leadPipelineSets.forEach((set, leadId) => {
      if (set.has(originStage) && !set.has(destStage)) {
        const l = leadMap.get(leadId);
        if (l) result.push(l);
      }
    });
    return result;
  }, [leadPipelineSets, leadMap, originStage, destStage]);

  if (boards.length === 0 || stageOrder.length === 0) {
    return null;
  }

  const originLabel = originStage ? pipelineLabel(originStage) : "";
  const destLabel = destStage ? pipelineLabel(destStage) : "";

  // Allowed origin options: any stage strictly before destStage (or any if no dest)
  const originOptions = destIdx >= 0 ? stageOrder.slice(0, destIdx) : stageOrder;

  return (
    <Card className="rounded-xl shadow-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Análise de Conversão por Estágio
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {hasMacros && (
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("status")}
                  className={`h-7 px-2.5 text-[11px] font-medium rounded-md inline-flex items-center gap-1 transition-colors ${
                    effectiveViewMode === "status"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  Por Status
                </button>
                <button
                  onClick={() => setViewMode("macro")}
                  className={`h-7 px-2.5 text-[11px] font-medium rounded-md inline-flex items-center gap-1 transition-colors ${
                    effectiveViewMode === "macro"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  Por Macro-Etapa
                </button>
              </div>
            )}
            {boards.length > 1 && (
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                {boards.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBoardId(b.id)}
                    className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${
                      selectedBoardId === b.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Local period filter — independent from global dashboard filter */}
        <div className="flex items-center gap-2 flex-wrap rounded-lg bg-muted/30 p-2 border border-border/40">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
          <span className="text-xs font-medium text-muted-foreground mr-1">Período:</span>
          {LOCAL_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => handleLocalPreset(p.key)}
              className={`h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors ${
                localPreset === p.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background text-muted-foreground hover:bg-background/80 border border-border/50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <Label className="text-[11px] text-muted-foreground whitespace-nowrap">De:</Label>
            <Input
              type="date"
              value={localFrom}
              onChange={(e) => handleLocalDateChange("from", e.target.value)}
              className="h-7 w-auto text-[11px]"
            />
            <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Até:</Label>
            <Input
              type="date"
              value={localTo}
              onChange={(e) => handleLocalDateChange("to", e.target.value)}
              className="h-7 w-auto text-[11px]"
            />
          </div>
        </div>

        {/* Origin selector */}
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="text-muted-foreground">De:</span>
          <Select
            value={originStage || ""}
            onValueChange={(v) => {
              setOriginStage(v);
              // If dest is now <= origin, push dest to last stage
              const oi = stageOrder.indexOf(v);
              if (destStage) {
                const di = stageOrder.indexOf(destStage);
                if (di <= oi) setDestStage(stageOrder[stageOrder.length - 1]);
              }
            }}
          >
            <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {originOptions.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {pipelineLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Até:</span>
          <span className="text-xs italic text-muted-foreground">
            clique numa coluna abaixo para escolher
          </span>
        </div>

        {/* Mini funnel */}
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {stageOrder.map((stage, idx) => {
            const count = stageCounts[stage] || 0;
            const pct = originCount > 0 && idx >= originIdx ? (count / originCount) * 100 : 0;
            const isBeforeOrigin = idx < originIdx;
            const isOrigin = stage === originStage;
            const isDest = stage === destStage;
            const color = pipelineColor(stage);

            return (
              <div key={stage} className="flex items-center shrink-0">
                <button
                  onClick={() => setDestStage(stage)}
                  disabled={idx <= originIdx}
                  className={`relative w-[110px] h-[110px] rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all ${
                    isDest
                      ? "border-primary shadow-md scale-105 bg-primary/5"
                      : isOrigin
                      ? "border-foreground/30 bg-muted/30"
                      : isBeforeOrigin
                      ? "border-border/30 bg-muted/20 opacity-50"
                      : "border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
                  } ${idx <= originIdx ? "cursor-default" : ""}`}
                >
                  <div
                    className="w-2 h-2 rounded-full mb-1"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[10px] font-medium text-center text-foreground line-clamp-2 leading-tight">
                    {pipelineLabel(stage)}
                  </span>
                  <span className="text-lg font-bold text-foreground mt-1">{count}</span>
                  {idx >= originIdx && originCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                  )}
                  {isDest && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                      DESTINO
                    </span>
                  )}
                  {isOrigin && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-foreground/80 text-background text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                      ORIGEM
                    </span>
                  )}
                </button>
                {idx < stageOrder.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 mx-1 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Detail card */}
        {originStage && destStage && originStage !== destStage && (
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Conversão de <span className="font-semibold text-foreground">"{originLabel}"</span>{" "}
                → <span className="font-semibold text-foreground">"{destLabel}"</span>
              </p>
              <div className="flex items-center justify-center gap-3 mt-3 text-sm">
                <span className="text-muted-foreground">
                  <span className="font-bold text-foreground text-lg">{originCount}</span> entraram
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-bold text-foreground text-lg">{destCount}</span> chegaram
                </span>
              </div>
              <p className="text-5xl font-bold text-primary mt-3">{conversionPct.toFixed(1)}%</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {bottleneck && (
                <div className="rounded-lg bg-background/60 border border-border/50 p-3">
                  <div className="flex items-start gap-2">
                    <TrendingDown className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Maior gargalo</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pipelineLabel(bottleneck.fromStage)} →{" "}
                        {pipelineLabel(bottleneck.toStage)}
                      </p>
                      <p className="text-xs text-destructive font-medium mt-1">
                        Queda de {bottleneck.dropPct.toFixed(0)}% ({bottleneck.dropAbs} leads)
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="rounded-lg bg-background/60 border border-border/50 p-3">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Tempo médio do trajeto</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {medianDays !== null
                        ? `${medianDays.toFixed(1)} dias (mediana)`
                        : "Sem dados suficientes"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={convertedLeads.length === 0}
                onClick={() =>
                  onLeadsClick(
                    `Converteram: ${originLabel} → ${destLabel}`,
                    convertedLeads,
                  )
                }
              >
                <Target className="w-3.5 h-3.5 mr-1" />
                Ver os {convertedLeads.length} leads que converteram
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={lostOnWayLeads.length === 0}
                onClick={() =>
                  onLeadsClick(
                    `Perdidos no caminho: ${originLabel} → ${destLabel}`,
                    lostOnWayLeads,
                  )
                }
              >
                <Users className="w-3.5 h-3.5 mr-1" />
                Ver os {lostOnWayLeads.length} leads perdidos no caminho
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
