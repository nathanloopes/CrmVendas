import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from "recharts";
import { isLostStage } from "@/lib/stage-utils";

const REASON_COLORS = [
  "hsl(0, 72%, 51%)",
  "hsl(25, 95%, 53%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(220, 9%, 46%)",
  "hsl(0, 50%, 40%)",
  "hsl(180, 60%, 40%)",
  "hsl(300, 50%, 50%)",
];

interface Lead {
  id: string;
  stage: string | null;
  created_at: string;
  lost_reason: string | null;
}

interface LostLeadsPieChartProps {
  leads: Lead[];
  onLegendClick?: (reason: string) => void;
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

export function LostLeadsPieChart({ leads, onLegendClick, onTotalClick }: LostLeadsPieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const lostLeads = useMemo(() => leads.filter((l) => isLostStage(l.stage)), [leads]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    lostLeads.forEach((l) => {
      const reason = l.lost_reason?.trim() || "Sem motivo informado";
      counts[reason] = (counts[reason] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count], i) => ({
        name: reason,
        value: count,
        color: REASON_COLORS[i % REASON_COLORS.length],
      }));
  }, [lostLeads]);

  const total = lostLeads.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Leads Perdidos por Motivo</CardTitle>
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
                        className={`text-sm ${onLegendClick ? "cursor-pointer" : ""} hover:bg-muted/50 rounded-md px-1 py-0.5 -mx-1 transition-colors`}
                        onClick={() => onLegendClick?.(item.name)}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-foreground break-words">{item.name}</span>
                        </div>
                        <div className="ml-5 text-muted-foreground text-xs">
                          <span className="font-medium text-foreground">{item.value}</span> leads ({pct}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-12">Selecione um período para visualizar os leads perdidos por motivo.</p>
        )}
        <p className={`text-xs text-muted-foreground text-center mt-4 ${onTotalClick ? "cursor-pointer hover:underline hover:text-primary transition-colors" : ""}`} onClick={onTotalClick}>Total perdidos: {total}</p>
      </CardContent>
    </Card>
  );
}
