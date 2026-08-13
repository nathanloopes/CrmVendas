import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from "recharts";
import { normalizeStage } from "@/lib/stage-utils";
import { getStageColorMap } from "@/lib/stage-colors";
import { getStageLabel } from "@/lib/stage-labels";

const EXCLUDED_STAGES = ["perdido", "ganho"];

interface Lead {
  id: string;
  stage: string | null;
  created_at: string;
}

interface PieChartCardProps {
  title?: string;
  leads: Lead[];
  stageOrder: string[];
  customLabels?: Record<string, string>;
  onLegendClick?: (stageKey: string, stageLabel: string) => void;
  onTotalClick?: () => void;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0];
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">{value} leads ({(percent * 100).toFixed(1)}%)</p>
    </div>
  );
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 10}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.3))", transition: "all 0.2s ease" }}
    />
  );
};

export function PieChartCard({ title = "Leads no Kanban por Estágio", leads, stageOrder, customLabels, onLegendClick, onTotalClick }: PieChartCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const normalized = normalizeStage(l.stage);
      return normalized !== "sem-etapa" && !EXCLUDED_STAGES.includes(normalized);
    });
  }, [leads]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const stage = normalizeStage(l.stage);
      counts[stage] = (counts[stage] || 0) + 1;
    });
    const safeStageOrder = Array.isArray(stageOrder) ? stageOrder : [];
    const ordered = safeStageOrder.filter((s) => !EXCLUDED_STAGES.includes(s));
    const keys = ordered.length > 0 ? ordered : Object.keys(counts);
    const dynamicColors = getStageColorMap(stageOrder);
    return keys
      .filter((s) => counts[s])
      .map((stage) => ({
        key: stage,
        name: getStageLabel(stage, customLabels),
        value: counts[stage],
        color: dynamicColors[stage] || "hsl(220, 13%, 50%)",
      }));
  }, [filteredLeads, stageOrder]);

  const total = filteredLeads.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {pieData.length > 0 ? (
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-full md:w-1/2">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} innerRadius={50} dataKey="value" strokeWidth={2} activeIndex={hoveredIndex !== null ? hoveredIndex : undefined} activeShape={renderActiveShape}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="hsl(var(--background))" opacity={hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1} style={{ transition: "opacity 0.2s ease" }} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2">
              <ScrollArea className="h-[280px] pr-2">
                <div className="space-y-2">
                  {pieData.map((item, i) => {
                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between gap-2 text-sm ${onLegendClick ? "cursor-pointer" : ""} hover:bg-muted/50 rounded-md px-1 py-0.5 -mx-1 transition-colors`}
                        onClick={() => onLegendClick?.(item.key, item.name)}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-foreground">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-muted-foreground text-xs">
                          <span className="font-medium text-foreground">{item.value}</span>
                          <span>({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-12">Selecione um período para visualizar a distribuição dos leads.</p>
        )}
        <p className={`text-xs text-muted-foreground text-center mt-4 ${onTotalClick ? "cursor-pointer hover:underline hover:text-primary transition-colors" : ""}`} onClick={onTotalClick}>Total: {total} leads</p>
      </CardContent>
    </Card>
  );
}
