import { useState, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LeadCard } from "./LeadCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Info, GripVertical, Calendar, Video, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { resolveStageColor } from "@/lib/stage-colors";
import type { Tables } from "@/integrations/supabase/types";
import { COLUMN_WIDTH_PX, type KanbanDensity, type KanbanColumnWidth } from "@/hooks/use-kanban-layout-prefs";

type Lead = Tables<"leads">;

interface KanbanColumnProps {
  stage: string;
  label?: string;
  color?: string;
  description?: string;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onScoreClick?: (lead: Lead) => void;
  stageIndex?: number;
  totalPipelineStages?: number;
  isMeetingToday?: boolean;
  stages?: string[];
  customLabels?: Record<string, any>;
  onStageChange?: (lead: Lead, newStage: string) => void;
  onBulkStageChange?: (leadIds: string[], newStage: string) => void;
  stageEntryMap?: Record<string, string>;
  density?: KanbanDensity;
  columnWidth?: KanbanColumnWidth;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

function formatStageLabel(stage: string, customLabel?: string): string {
  if (customLabel) return customLabel;
  return stage
    .replace(/-/g, " ")
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export function KanbanColumn({
  stage, label, color, description, leads, onLeadClick, onScoreClick,
  stageIndex = 0, totalPipelineStages = 1, isMeetingToday = false,
  stages: allStages, customLabels, onStageChange, onBulkStageChange, stageEntryMap = {},
  density = "comfortable", columnWidth = "default", collapsed = false, onToggleCollapsed,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const leadIds = leads.map((l) => l.id);
  const hexColor = resolveStageColor(stage, { customColor: color, stageIndex, totalPipelineStages });
  const widthPx = COLUMN_WIDTH_PX[columnWidth];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const someSelected = selectedIds.size > 0;

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) setSelectedIds(new Set(leadIds));
    else setSelectedIds(new Set());
  }, [leadIds]);

  const handleSelectOne = useCallback((leadId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(leadId);
      else next.delete(leadId);
      return next;
    });
  }, []);

  const handleBulkMove = (targetStage: string) => {
    if (!onBulkStageChange || selectedIds.size === 0) return;
    onBulkStageChange(Array.from(selectedIds), targetStage);
    setSelectedIds(new Set());
  };

  const stageColors = (customLabels?.__stage_colors__ as Record<string, string>) || {};
  const StageIcon = stage.includes("reuniao") || stage.includes("meeting")
    ? Video
    : stage.includes("perdido") || stage.includes("lost")
    ? AlertCircle
    : Calendar;

  // ---------- Collapsed column ----------
  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className={`flex flex-col items-center w-12 min-w-[3rem] rounded-xl bg-white/60 dark:bg-[#0F172A]/70 border border-gray-100 dark:border-white/[0.06] shadow-sm cursor-pointer hover:bg-white dark:hover:bg-[#131C2E] transition-colors ${isOver ? "ring-2" : ""}`}
        style={isOver ? { boxShadow: `0 0 0 1px ${hexColor}70` } : {}}
        onClick={onToggleCollapsed}
        title={`Expandir ${formatStageLabel(stage, label)}`}
      >
        <div className="h-[2px] w-full rounded-t-lg" style={{ backgroundColor: hexColor, opacity: 0.85 }} />
        <button
          className="p-1.5 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onToggleCollapsed?.(); }}
          aria-label="Expandir coluna"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <StageIcon className="h-3.5 w-3.5 my-1" style={{ color: hexColor }} />
        <div className="flex-1 flex items-center justify-center py-2">
          <span
            className="text-xs font-bold text-foreground dark:text-slate-100 tracking-wide"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {formatStageLabel(stage, label)}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums bg-gray-100 dark:bg-white/[0.04] rounded-full px-1.5 py-0.5 mb-2">
          {leads.length}
        </span>
      </div>
    );
  }

  // ---------- Expanded column ----------
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl transition-all duration-200 bg-white/60 dark:bg-[#0F172A]/70 border border-gray-100 dark:border-white/[0.06] ${
        isOver ? "scale-[1.02] shadow-lg ring-2" : "shadow-sm dark:shadow-none"
      } ${
        isMeetingToday
          ? "border-l-[3px] border-l-orange-500 dark:border-l-amber-500/70"
          : ""
      }`}
      style={{
        width: `${widthPx}px`,
        minWidth: `${widthPx}px`,
        ...(isOver ? { backgroundColor: `${hexColor}10`, boxShadow: `0 0 0 1px ${hexColor}70, 0 4px 16px ${hexColor}18` } : {}),
      }}
    >
      <div className="h-[2px] rounded-t-lg" style={{ backgroundColor: hexColor, opacity: 0.85 }} />

      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/50 dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            className="h-3.5 w-3.5 shrink-0"
          />
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <StageIcon className="h-3.5 w-3.5 shrink-0" style={{ color: hexColor }} />
          <span className="text-xs font-bold truncate text-foreground dark:text-slate-100">
            {formatStageLabel(stage, label)}
          </span>
          {description && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[14rem] text-xs">
                  {description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isMeetingToday && (
            <span className="text-[9px] font-medium bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">Auto</span>
          )}
          <span className="text-[11px] font-semibold text-muted-foreground dark:text-slate-300 tabular-nums bg-gray-100 dark:bg-white/[0.04] rounded-full px-2 py-0.5">
            {leads.length}
          </span>
          {onToggleCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onToggleCollapsed}
              title="Recolher coluna"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {someSelected && allStages && onBulkStageChange && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/50 bg-primary/5">
          <span className="text-[11px] font-medium text-foreground whitespace-nowrap">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <Select onValueChange={handleBulkMove}>
            <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0">
              <SelectValue placeholder="Mover para..." />
            </SelectTrigger>
            <SelectContent>
              {allStages
                .filter((s) => s !== stage)
                .map((s, idx) => {
                  const sColor = resolveStageColor(s, {
                    customColor: stageColors[s],
                    stageIndex: idx,
                    totalPipelineStages: allStages.length,
                  });
                  return (
                    <SelectItem key={s} value={s} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: sColor }} />
                        {customLabels?.[s] || s.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>
      )}

      <ScrollArea className="flex-1 max-h-[calc(100vh-14rem)]">
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5 p-1.5 min-h-[4rem]">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={onLeadClick}
                onScoreClick={onScoreClick}
                stageColor={hexColor}
                stages={allStages}
                customLabels={customLabels}
                onStageChange={onStageChange}
                selected={selectedIds.has(lead.id)}
                onSelect={handleSelectOne}
                stageEntryTime={stageEntryMap[lead.id] || lead.created_at}
                stageName={label || stage}
                density={density}
                pipelineIndex={stageIndex}
                pipelineTotal={totalPipelineStages}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
