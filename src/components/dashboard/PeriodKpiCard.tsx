import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { KpiDrilldownDialog } from "./KpiDrilldownDialog";

export type PeriodKey = "hoje" | "semana" | "mes" | "ano" | "custom";

const PRESETS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "custom", label: "Personalizado" },
];

function getRange(key: PeriodKey): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (key) {
    case "hoje":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "semana":
      return { from: startOfWeek(now, { locale: ptBR }), to: endOfWeek(now, { locale: ptBR }) };
    case "mes":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "ano":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "custom":
      return { from: null, to: null };
  }
}

interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  stage: string | null;
  source: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface PeriodKpiCardProps {
  title: string;
  icon: LucideIcon;
  accentClass: string;
  iconColorClass: string;
  leads: Lead[];
  dateField: "created_at" | "updated_at";
  filterFn?: (lead: Lead) => boolean;
  customLabels?: Record<string, string>;
  onLeadClick?: (id: string) => void;
  externalRange?: { from: Date | null; to: Date | null; label: string };
}

export function PeriodKpiCard({
  title,
  icon: Icon,
  accentClass,
  iconColorClass,
  leads,
  dateField,
  filterFn,
  customLabels,
  onLeadClick,
  externalRange,
}: PeriodKpiCardProps) {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [drilldownOpen, setDrilldownOpen] = useState(false);

  const { from, to } = useMemo(() => {
    if (externalRange) {
      return { from: externalRange.from, to: externalRange.to };
    }
    if (period === "custom") {
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : null,
        to: customTo ? endOfDay(new Date(customTo)) : null,
      };
    }
    return getRange(period);
  }, [period, customFrom, customTo, externalRange]);

  const isInRange = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filterFn && !filterFn(l)) return false;
      const dateValue = dateField === "created_at" ? l.created_at : l.updated_at;
      return isInRange(dateValue);
    });
  }, [leads, from, to, filterFn, dateField]);

  // Comparison vs previous period of same length
  const previousCount = useMemo(() => {
    if (!from || !to) return null;
    const days = Math.max(1, differenceInCalendarDays(to, from) + 1);
    const prevTo = subDays(from, 1);
    const prevFrom = subDays(prevTo, days - 1);
    const prevStart = startOfDay(prevFrom);
    const prevEnd = endOfDay(prevTo);
    return leads.filter((l) => {
      if (filterFn && !filterFn(l)) return false;
      const dateValue = dateField === "created_at" ? l.created_at : l.updated_at;
      if (!dateValue) return false;
      const d = new Date(dateValue);
      return d >= prevStart && d <= prevEnd;
    }).length;
  }, [leads, from, to, filterFn, dateField]);

  const delta = previousCount !== null ? filtered.length - previousCount : null;
  const deltaPct = previousCount && previousCount > 0 ? ((delta! / previousCount) * 100).toFixed(0) : null;

  return (
    <>
      <Card className={`rounded-xl shadow-sm border-border/50 border-l-4 ${accentClass} transition-all hover:shadow-md`}>
        <CardContent className="pt-5 pb-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon className={`w-5 h-5 ${iconColorClass}`} />
              <span className="text-sm font-semibold text-foreground">{title}</span>
            </div>
          </div>

          {/* Period chips (hidden when externalRange is provided) */}
          {!externalRange && (
            <div className="flex items-center gap-1 flex-wrap mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`h-6 px-2 text-[10px] font-medium rounded-md transition-colors ${
                    period === p.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Custom date inputs */}
          {!externalRange && period === "custom" && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1">
                <Label className="text-[10px] text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex-1">
                <Label className="text-[10px] text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          )}

          {/* Big number */}
          <button
            onClick={() => setDrilldownOpen(true)}
            className="block w-full text-left group"
          >
            <p className={`text-4xl font-bold ${iconColorClass} group-hover:opacity-80 transition-opacity`}>
              {filtered.length}
            </p>
          </button>

          {/* Comparison */}
          {delta !== null && previousCount !== null && (
            <div className="flex items-center gap-1 mt-2 text-xs">
              {delta > 0 ? (
                <>
                  <TrendingUp className="w-3 h-3 text-[hsl(var(--success))]" />
                  <span className="text-[hsl(var(--success))] font-medium">
                    +{delta}{deltaPct ? ` (${deltaPct}%)` : ""}
                  </span>
                </>
              ) : delta < 0 ? (
                <>
                  <TrendingDown className="w-3 h-3 text-destructive" />
                  <span className="text-destructive font-medium">
                    {delta}{deltaPct ? ` (${deltaPct}%)` : ""}
                  </span>
                </>
              ) : (
                <>
                  <Minus className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Sem variação</span>
                </>
              )}
              <span className="text-muted-foreground">vs período anterior</span>
            </div>
          )}

          {/* Range hint */}
          {from && to && (
            <p className="text-[10px] text-muted-foreground mt-2">
              {format(from, "dd/MM/yy", { locale: ptBR })} — {format(to, "dd/MM/yy", { locale: ptBR })}
            </p>
          )}
        </CardContent>
      </Card>

      <KpiDrilldownDialog
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        title={`${title} — ${filtered.length}`}
        leads={filtered as any}
        mode="leads"
        onLeadClick={onLeadClick}
        customLabels={customLabels}
      />
    </>
  );
}
