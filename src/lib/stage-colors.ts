import { normalizeStage } from "./stage-utils";

const FIXED_STAGE_COLORS: Record<string, string> = {
  ganho: "#22C55E",
  perdido: "#EF4444",
  "reuniao-do-dia": "#F59E0B",
};

const DEFAULT_STAGE_COLORS: Record<string, string> = {
  "dados-incompletos": "#94A3B8",
  "captação": "#60A5FA",
  "leads": "#3B82F6",
  "qualificação": "#6366F1",
  "reagendamento": "#818CF8",
  "material-reuniao": "#8B5CF6",
  "standby": "#A78BFA",
  "reuniao-modulo-1": "#7C3AED",
  "reuniao-modulo-2": "#8B5CF6",
  "reuniao-modulo-3": "#A78BFA",
  "contrato": "#C084FC",
  "fechamento": "#22D3EE",
};

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Calculate a color for a stage based on its position in the pipeline.
 * Gradient goes from hue 210 (cold blue) to 290 (warm fuchsia).
 * "ganho" and "perdido" always get fixed green/red.
 */
export function getDynamicStageColor(stage: string, stageIndex: number, totalPipelineStages: number): string {
  const normalized = normalizeStage(stage);

  if (FIXED_STAGE_COLORS[normalized]) return FIXED_STAGE_COLORS[normalized];
  if (DEFAULT_STAGE_COLORS[normalized]) return DEFAULT_STAGE_COLORS[normalized];

  // Dynamic interpolation for unknown stages
  const ratio = totalPipelineStages > 1 ? stageIndex / (totalPipelineStages - 1) : 0.5;
  const hue = 210 + ratio * 80; // 210 → 290
  return hslToHex(hue, 55, 62);
}

/**
 * Resolve color for a stage, checking custom color first, then default map, then dynamic.
 */
export function resolveStageColor(
  stage: string,
  options?: {
    customColor?: string;
    stageIndex?: number;
    totalPipelineStages?: number;
  }
): string {
  const { customColor, stageIndex = 0, totalPipelineStages = 1 } = options || {};

  // Custom hex color takes priority
  if (customColor?.startsWith("#")) return customColor;

  // Map common tailwind class names
  const twToHex: Record<string, string> = {
    "bg-blue-500": "#3b82f6",
    "bg-purple-500": "#a855f7",
    "bg-amber-500": "#f59e0b",
    "bg-emerald-500": "#10b981",
    "bg-green-700": "#15803d",
    "bg-destructive": "#ef4444",
  };
  if (customColor && twToHex[customColor]) return twToHex[customColor];

  return getDynamicStageColor(stage, stageIndex, totalPipelineStages);
}

/** Get color map for a list of stages (for charts/dashboards) */
export function getStageColorMap(stageOrder: string[]): Record<string, string> {
  const pipeline = stageOrder.filter((s) => {
    const n = normalizeStage(s);
    return n !== "ganho" && n !== "perdido";
  });

  const map: Record<string, string> = {};
  stageOrder.forEach((s) => {
    const normalized = normalizeStage(s);
    const pipelineIndex = pipeline.indexOf(s);
    if (FIXED_STAGE_COLORS[normalized]) {
      map[normalized] = FIXED_STAGE_COLORS[normalized];
    } else if (DEFAULT_STAGE_COLORS[normalized]) {
      map[normalized] = DEFAULT_STAGE_COLORS[normalized];
    } else {
      const idx = pipelineIndex >= 0 ? pipelineIndex : pipeline.length;
      map[normalized] = getDynamicStageColor(s, idx, pipeline.length);
    }
  });
  return map;
}
