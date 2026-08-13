import { normalizeStage } from "./stage-utils";

export interface MacroStage {
  id: string;
  name: string;
  type: "primary" | "secondary";
  stages: string[]; // raw stage keys (as stored in stage_order / leads.stage)
}

interface BoardLike {
  custom_labels?: any;
  stage_order?: string[] | null;
}

/**
 * Reads the macro-stages array from a board's custom_labels.__macro_stages__.
 * Returns [] when not configured.
 */
export function getMacroStages(board: BoardLike | null | undefined): MacroStage[] {
  const labels = (board?.custom_labels as Record<string, any>) || {};
  const arr = labels.__macro_stages__;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((m) => m && typeof m === "object" && Array.isArray(m.stages))
    .map((m) => ({
      id: String(m.id),
      name: String(m.name || ""),
      type: m.type === "secondary" ? "secondary" : "primary",
      stages: m.stages.map((s: any) => String(s)),
    }));
}

/**
 * Suggests a default mapping from the current stage_order, using common
 * naming patterns. Stages that don't match any known pattern are dropped
 * into a "Sem categoria" primary group at the end if needed (here we leave
 * them unassigned and let the UI display them as warning).
 */
export function getDefaultMacroStages(stageOrder: string[]): MacroStage[] {
  const has = (target: string) =>
    stageOrder.find((s) => normalizeStage(s) === normalizeStage(target));

  const pickMany = (...candidates: string[]) =>
    candidates.map(has).filter((s): s is string => !!s);

  const macros: MacroStage[] = [
    {
      id: "ent",
      name: "Entrada",
      type: "primary",
      stages: pickMany("Dados Incompletos", "Leads", "Captação"),
    },
    {
      id: "qua",
      name: "Qualificação",
      type: "primary",
      stages: pickMany("Qualificação", "Material Reunião"),
    },
    {
      id: "reu",
      name: "Reunião",
      type: "primary",
      stages: pickMany(
        "Reunião Agendada",
        "Reunião do Dia",
        "Reagendamento",
        "Reunião Módulo 1",
        "Reunião Módulo 2",
        "Reunião Módulo 3",
      ),
    },
    {
      id: "pro",
      name: "Proposta",
      type: "primary",
      stages: pickMany("Envio de COF", "Tarefas pendentes", "Stand-By", "Standby"),
    },
    {
      id: "fec",
      name: "Fechamento",
      type: "primary",
      stages: pickMany("Contrato", "Fechamento", "Ganho"),
    },
    {
      id: "fup",
      name: "Follow-up",
      type: "secondary",
      stages: pickMany("Realocar no CRM", "Realocar"),
    },
    {
      id: "per",
      name: "Perda",
      type: "secondary",
      stages: pickMany("Perdido"),
    },
  ];

  return macros.filter((m) => m.stages.length > 0);
}

/**
 * Returns the macro that contains the given stage (case/accent-insensitive
 * via normalizeStage), or null.
 */
export function getMacroForStage(
  stage: string | null | undefined,
  macros: MacroStage[],
): MacroStage | null {
  if (!stage) return null;
  const target = normalizeStage(stage);
  for (const m of macros) {
    if (m.stages.some((s) => normalizeStage(s) === target)) return m;
  }
  return null;
}

/**
 * Aggregates a list of leads (with `stage` field) by macro id.
 * Returns Record<macroId, Lead[]>. Leads not assigned to any macro are
 * grouped under "__unassigned__".
 */
export function aggregateLeadsByMacro<T extends { stage: string | null }>(
  leads: T[],
  macros: MacroStage[],
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const m of macros) out[m.id] = [];
  out.__unassigned__ = [];
  for (const l of leads) {
    const m = getMacroForStage(l.stage, macros);
    if (m) out[m.id].push(l);
    else out.__unassigned__.push(l);
  }
  return out;
}

/**
 * List of stage keys that are not covered by any macro.
 */
export function getUnassignedStages(stageOrder: string[], macros: MacroStage[]): string[] {
  const covered = new Set<string>();
  for (const m of macros) for (const s of m.stages) covered.add(normalizeStage(s));
  return stageOrder.filter((s) => !covered.has(normalizeStage(s)));
}

/**
 * Reconciles a macros list with the current board stages:
 *  - Removes stages that no longer exist in the board (deleted from Kanban).
 *  - Replaces stage keys with the canonical name from stageOrder when matching
 *    by normalizeStage (keeps labels in sync after rename).
 *  - De-duplicates stages within each macro.
 * Returns { macros, changed } so callers can decide whether to push an update.
 */
export function reconcileMacroStages(
  macros: MacroStage[],
  stageOrder: string[],
): { macros: MacroStage[]; changed: boolean } {
  const canonicalByNorm = new Map<string, string>();
  for (const s of stageOrder) canonicalByNorm.set(normalizeStage(s), s);

  let changed = false;
  const next = macros.map((m) => {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const s of m.stages) {
      const canonical = canonicalByNorm.get(normalizeStage(s));
      if (!canonical) {
        changed = true; // stage removed from board
        continue;
      }
      if (canonical !== s) changed = true; // canonical rename
      const key = normalizeStage(canonical);
      if (seen.has(key)) {
        changed = true; // duplicate dropped
        continue;
      }
      seen.add(key);
      cleaned.push(canonical);
    }
    return { ...m, stages: cleaned };
  });

  return { macros: next, changed };
}

/**
 * Returns true when the given stage belongs to the "Reunião" macro of the
 * board (id "reu"). Falls back to a hardcoded check on the standard Brasil
 * stage names when the board has no macros configured, so behavior is
 * preserved for legacy boards.
 */
export function isMeetingStage(
  stage: string | null | undefined,
  board: BoardLike | null | undefined,
): boolean {
  if (!stage) return false;
  const macros = getMacroStages(board);
  if (macros.length > 0) {
    const m = getMacroForStage(stage, macros);
    return !!m && m.id === "reu";
  }
  // Fallback (board sem custom_labels)
  const norm = stage.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    norm.includes("reuniao agendada") ||
    norm.includes("reuniao do dia") ||
    norm.includes("reagendamento") ||
    norm.includes("reuniao modulo")
  );
}

/**
 * Returns the first stage name in the board's "Reunião" macro (id "reu"),
 * or null if no macros are configured / the macro is empty. Useful as the
 * "Reunião do Dia" bucket on boards that don't have a literal "Reunião do
 * Dia" column.
 */
export function getMeetingDayStage(
  board: BoardLike | null | undefined,
): string | null {
  const macros = getMacroStages(board);
  const reu = macros.find((m) => m.id === "reu");
  return reu?.stages[0] ?? null;
}

