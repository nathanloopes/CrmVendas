import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeStage } from "@/lib/stage-utils";
import { getStageColorMap } from "@/lib/stage-colors";
import { getStageLabel } from "@/lib/stage-labels";
import { Activity, LayoutGrid, Layers } from "lucide-react";
import {
  getMacroStages,
  aggregateLeadsByMacro,
  type MacroStage,
} from "@/lib/macro-stages";

interface Board {
  id: string;
  name: string;
  stage_order: string[] | null;
  custom_labels: Record<string, string> | null;
}

interface LiveLead {
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

interface LiveKanbanBoardProps {
  boards: Board[];
  globalStageOrder: string[];
  onStageClick: (stageKey: string, stageLabel: string, leads: LiveLead[]) => void;
}

export function LiveKanbanBoard({ boards, globalStageOrder, onStageClick }: LiveKanbanBoardProps) {
  const queryClient = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string | "all">(boards[0]?.id || "all");
  const [viewMode, setViewMode] = useState<"status" | "macro">("macro");

  // Fresh, unfiltered query for live data
  const { data: liveLeads = [] } = useQuery({
    queryKey: ["dashboard-live-pipeline-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, email, city, state, stage, source, created_at, board_id")
        .range(0, 4999);
      return (data || []) as LiveLead[];
    },
    refetchInterval: 30000, // refetch every 30s as fallback
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-live-pipeline-leads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Sync selected board if boards list changes
  useEffect(() => {
    if (boards.length > 0 && selectedBoardId !== "all" && !boards.find((b) => b.id === selectedBoardId)) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId]);

  const activeBoard = boards.find((b) => b.id === selectedBoardId);

  const boardLeads = useMemo(() => {
    if (selectedBoardId === "all") return liveLeads;
    return liveLeads.filter((l) => l.board_id === selectedBoardId);
  }, [liveLeads, selectedBoardId]);

  // Stage order: prefer board, then global
  const stageOrder = useMemo(() => {
    const order = activeBoard?.stage_order || globalStageOrder || [];
    return order.filter((s) => {
      const n = normalizeStage(s);
      return n !== "ganho" && n !== "perdido";
    });
  }, [activeBoard, globalStageOrder]);

  const customLabels = useMemo(() => {
    const labels = (activeBoard?.custom_labels as Record<string, string>) || {};
    const { __stage_colors__: _, __stage_descriptions__: __, __macro_stages__: ___, ...rest } = labels as any;
    return rest as Record<string, string>;
  }, [activeBoard]);

  const colorMap = useMemo(() => getStageColorMap(activeBoard?.stage_order || globalStageOrder || []), [activeBoard, globalStageOrder]);

  // Macro stages from active board (only available when single board selected)
  const macroStages: MacroStage[] = useMemo(() => {
    if (selectedBoardId === "all") return [];
    return getMacroStages(activeBoard);
  }, [activeBoard, selectedBoardId]);
  const hasMacros = macroStages.length > 0;
  const effectiveViewMode = hasMacros ? viewMode : "status";

  // Auto-sync default view mode when active board changes:
  // boards with macros default to "macro"; otherwise "status".
  useEffect(() => {
    setViewMode(hasMacros ? "macro" : "status");
  }, [selectedBoardId, hasMacros]);

  // Group leads by normalized stage (only active stages)
  const leadsByStage = useMemo(() => {
    const map: Record<string, LiveLead[]> = {};
    boardLeads.forEach((l) => {
      const stage = normalizeStage(l.stage);
      if (stage === "ganho" || stage === "perdido" || stage === "sem-etapa") return;
      if (!map[stage]) map[stage] = [];
      map[stage].push(l);
    });
    return map;
  }, [boardLeads]);

  // Group leads by macro (includes ALL stages, including ganho/perdido — those go into secondary macros)
  const leadsByMacro = useMemo(
    () => aggregateLeadsByMacro(boardLeads, macroStages),
    [boardLeads, macroStages],
  );

  const totalActive = useMemo(
    () => Object.values(leadsByStage).reduce((sum, arr) => sum + arr.length, 0),
    [leadsByStage]
  );

  // Stages to display: union of stageOrder + any extra stages present in data
  const displayStages = useMemo(() => {
    const fromOrder = stageOrder.map((s) => normalizeStage(s));
    const extras = Object.keys(leadsByStage).filter((s) => !fromOrder.includes(s));
    return [...fromOrder, ...extras];
  }, [stageOrder, leadsByStage]);

  const primaryMacros = macroStages.filter((m) => m.type === "primary");
  const secondaryMacros = macroStages.filter((m) => m.type === "secondary");

  return (
    <Card className="rounded-xl shadow-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Pipeline ao Vivo
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--success))]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--success))]" />
              </span>
              Live
            </div>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Status atual — ignora filtro de período
          </p>
        </div>

        {/* Board selector + view mode toggle */}
        <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
          {boards.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBoardId(b.id)}
                  className={`h-7 px-3 text-xs font-medium rounded-lg transition-colors ${
                    selectedBoardId === b.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {b.name}
                </button>
              ))}
              <button
                onClick={() => setSelectedBoardId("all")}
                className={`h-7 px-3 text-xs font-medium rounded-lg transition-colors ${
                  selectedBoardId === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                Todos os boards
              </button>
            </div>
          )}

          {hasMacros && (
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode("status")}
                className={`h-6 px-2.5 text-[11px] font-medium rounded-md inline-flex items-center gap-1 transition-colors ${
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
                className={`h-6 px-2.5 text-[11px] font-medium rounded-md inline-flex items-center gap-1 transition-colors ${
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-2xl font-bold text-foreground">
            {totalActive}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {totalActive === 1 ? "lead ativo no momento" : "leads ativos no momento"}
            </span>
          </p>
        </div>

        {effectiveViewMode === "macro" ? (
          <div className="space-y-4">
            {primaryMacros.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhuma macro-etapa principal configurada.
              </p>
            ) : (
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(primaryMacros.length, 6)}, minmax(0, 1fr))` }}
              >
                {primaryMacros.map((m) => {
                  const macroLeads = leadsByMacro[m.id] || [];
                  const count = macroLeads.length;
                  const firstStage = m.stages[0];
                  const color = firstStage
                    ? colorMap[normalizeStage(firstStage)] || "hsl(var(--primary))"
                    : "hsl(var(--primary))";
                  return (
                    <button
                      key={m.id}
                      onClick={() => onStageClick(m.id, m.name, macroLeads)}
                      className="group relative rounded-lg border border-border/50 bg-card hover:bg-muted/40 transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden text-left p-3"
                      disabled={count === 0}
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: color }}
                      />
                      <div className="pt-1">
                        <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight min-h-[2.2em]">
                          {m.name}
                        </p>
                        <p className="text-2xl font-bold mt-1 text-foreground group-hover:text-primary transition-colors">
                          {count}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {m.stages.length} status
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {secondaryMacros.length > 0 && (
              <div className="pt-2 border-t border-border/40">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Funil Secundário
                </p>
                <div className="flex flex-wrap gap-2">
                  {secondaryMacros.map((m) => {
                    const macroLeads = leadsByMacro[m.id] || [];
                    const count = macroLeads.length;
                    return (
                      <button
                        key={m.id}
                        onClick={() => onStageClick(m.id, m.name, macroLeads)}
                        className="group rounded-md border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors px-3 py-1.5 text-left"
                        disabled={count === 0}
                      >
                        <span className="text-xs font-medium text-foreground">{m.name}</span>
                        <span className="ml-2 text-sm font-bold text-foreground">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : displayStages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Nenhum estágio disponível neste board.
          </p>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(displayStages.length, 8)}, minmax(0, 1fr))` }}>
            {displayStages.map((stage) => {
              const count = leadsByStage[stage]?.length || 0;
              const color = colorMap[stage] || "hsl(var(--primary))";
              const label = getStageLabel(stage, customLabels);
              return (
                <button
                  key={stage}
                  onClick={() => onStageClick(stage, label, leadsByStage[stage] || [])}
                  className="group relative rounded-lg border border-border/50 bg-card hover:bg-muted/40 transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden text-left p-3"
                  disabled={count === 0}
                >
                  {/* Top color bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: color }}
                  />
                  <div className="pt-1">
                    <p className="text-xs font-medium text-muted-foreground line-clamp-2 leading-tight min-h-[2.2em]">
                      {label}
                    </p>
                    <p className="text-2xl font-bold mt-1 text-foreground group-hover:text-primary transition-colors">
                      {count}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
