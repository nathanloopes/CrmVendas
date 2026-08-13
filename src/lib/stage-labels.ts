/**
 * Mapa estático de slugs → labels com acentos corretos em português.
 */
const ACCENT_MAP: Record<string, string> = {
  "captação": "Captação",
  "captacao": "Captação",
  "qualificação": "Qualificação",
  "qualificacao": "Qualificação",
  "reuniao-agendada": "Reunião Agendada",
  "reunião-agendada": "Reunião Agendada",
  "reuniao-modulo-1": "Reunião Módulo 1",
  "reuniao-modulo-2": "Reunião Módulo 2",
  "reuniao-modulo-3": "Reunião Módulo 3",
  "material-reuniao": "Material Reunião",
  "reagendamento": "Reagendamento",
  "dados-incompletos": "Dados Incompletos",
  "contrato": "Contrato",
  "fechamento": "Fechamento",
  "ganho": "Ganho",
  "perdido": "Perdido",
  "standby": "Standby",
  "leads": "Leads",
  "proposta-enviada": "Proposta Enviada",
  "negociação": "Negociação",
  "negociacao": "Negociação",
  "apresentação": "Apresentação",
  "apresentacao": "Apresentação",
  "follow-up": "Follow-up",
  "analise": "Análise",
  "análise": "Análise",
};

/**
 * Resolve o label de exibição de um estágio do Kanban.
 * Prioriza custom_labels do board ativo; depois mapa de acentos; caso contrário, formata o slug.
 */
export function getStageLabel(
  stage: string,
  customLabels?: Record<string, string> | null
): string {
  // Skip internal keys like __stage_colors__, __stage_descriptions__
  if (customLabels && customLabels[stage] && !stage.startsWith("__")) {
    return customLabels[stage];
  }
  // Check accent map
  const lower = stage.toLowerCase();
  if (ACCENT_MAP[lower]) {
    return ACCENT_MAP[lower];
  }
  // Fallback: formata slug → "reuniao-modulo-1" → "Reuniao Modulo 1"
  return stage
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Gera um mapa completo de labels para uma lista de stages.
 */
export function buildStageLabelsMap(
  stages: string[],
  customLabels?: Record<string, string> | null
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const stage of stages) {
    map[stage] = getStageLabel(stage, customLabels);
  }
  return map;
}
