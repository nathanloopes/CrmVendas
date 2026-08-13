interface FunnelStage {
  name: string;
  stageKey: string;
  value: number;
  color: string;
}

interface SalesFunnelProps {
  data: FunnelStage[];
  onStageClick?: (stage: FunnelStage) => void;
}

export function SalesFunnel({ data, onStageClick }: SalesFunnelProps) {
  if (data.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        Nenhum lead encontrado no período.
      </p>
    );
  }

  const total = data.length;

  return (
    <div className="flex flex-col items-center gap-1 py-4">
      {data.map((stage, i) => {
        const widthPct = total === 1 ? 100 : 100 - (70 * i) / (total - 1);
        const nextWidthPct = total === 1 ? 60 : 100 - (70 * (i + 1)) / (total - 1);

        return (
          <div
            key={stage.stageKey}
            className="relative cursor-pointer transition-transform hover:scale-[1.02] group"
            style={{ width: `${widthPct}%` }}
            onClick={() => onStageClick?.(stage)}
          >
            <div
              className="h-12 flex items-center justify-center text-white font-medium text-sm transition-opacity group-hover:opacity-90"
              style={{
                background: stage.color,
                clipPath: `polygon(0 0, 100% 0, ${50 + (nextWidthPct / widthPct) * 50}% 100%, ${50 - (nextWidthPct / widthPct) * 50}% 100%)`,
              }}
            >
              <span className="relative z-10 drop-shadow-sm truncate px-4">
                {stage.name} ({stage.value})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
