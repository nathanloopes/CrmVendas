/**
 * Normalizes any stage value (display name or slug) to its canonical slug key.
 * This handles the mismatch between DB values (e.g. "Perdido", "Leads", "Dados Incompletos")
 * and the code's expected slugs (e.g. "perdido", "leads", "dados-incompletos").
 */

const DISPLAY_TO_SLUG: Record<string, string> = {
  // Lowercase display names → slug
  "dados incompletos": "dados-incompletos",
  "captação": "captação",
  "captacao": "captação",
  "leads": "leads",
  "qualificação": "qualificação",
  "qualificacao": "qualificação",
  "reagendamento": "reagendamento",
  "material reunião": "material-reuniao",
  "material reuniao": "material-reuniao",
  "standby": "standby",
  "stand-by": "standby",
  "reunião": "reuniao-modulo-1",
  "reuniao": "reuniao-modulo-1",
  "reunião inicial": "reuniao-modulo-1",
  "reuniao-inicial": "reuniao-modulo-1",
  "reunião módulo 1": "reuniao-modulo-1",
  "reunião mod. 1": "reuniao-modulo-1",
  "reuniao modulo 1": "reuniao-modulo-1",
  "reunião módulo 2": "reuniao-modulo-2",
  "reunião mod. 2": "reuniao-modulo-2",
  "reuniao modulo 2": "reuniao-modulo-2",
  "reunião módulo 3": "reuniao-modulo-3",
  "reunião mod. 3": "reuniao-modulo-3",
  "reuniao modulo 3": "reuniao-modulo-3",
  "contrato": "contrato",
  "fechamento": "fechamento",
  "envio de cof": "contrato",
  "ganho": "ganho",
  "perdido": "perdido",
  "reunião do dia": "reuniao-do-dia",
  "reuniao do dia": "reuniao-do-dia",
  // Slugs map to themselves
  "dados-incompletos": "dados-incompletos",
  "material-reuniao": "material-reuniao",
  "reuniao-modulo-1": "reuniao-modulo-1",
  "reuniao-modulo-2": "reuniao-modulo-2",
  "reuniao-modulo-3": "reuniao-modulo-3",
  "reuniao-do-dia": "reuniao-do-dia",
};

export function normalizeStage(stage: string | null | undefined): string {
  if (!stage) return "sem-etapa";
  const key = stage.toLowerCase().trim();
  return DISPLAY_TO_SLUG[key] || key;
}

export function isLostStage(stage: string | null | undefined): boolean {
  return normalizeStage(stage) === "perdido";
}

export function isWonStage(stage: string | null | undefined): boolean {
  return normalizeStage(stage) === "ganho";
}
