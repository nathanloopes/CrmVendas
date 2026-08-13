/**
 * Calcula a data de vencimento de uma tarefa com base na prioridade/complexidade.
 * - Alta (urgente / fácil) → mesmo dia
 * - Média → +2 dias úteis
 * - Baixa → +5 dias úteis
 * Sábado e domingo são pulados automaticamente.
 *
 * Retorna no formato YYYY-MM-DD (sem componente de hora) usando data local
 * para evitar deslocamento por fuso horário.
 */

const PRIORITY_DAYS: Record<string, number> = {
  high: 0,
  alta: 0,
  urgente: 0,
  urgent: 0,
  medium: 2,
  media: 2,
  "média": 2,
  low: 5,
  baixa: 5,
};

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/** Adiciona N dias úteis a uma data (pula sáb/dom). N=0 mantém o dia (ou pula para segunda se for fim de semana). */
export function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0); // meio-dia local: evita problemas com horário de verão / fuso
  if (days <= 0) {
    while (isWeekend(d)) d.setDate(d.getDate() + 1);
    return d;
  }
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}

/** Retorna a data de vencimento (YYYY-MM-DD) calculada pela prioridade a partir de `from` (default: hoje). */
export function computeDueDateByPriority(priority: string | undefined | null, from: Date = new Date()): string {
  const key = (priority || "").toString().toLowerCase().trim();
  const days = PRIORITY_DAYS[key] ?? 2;
  return localDateString(addBusinessDays(from, days));
}

/** Verifica se a string YYYY-MM-DD está no passado (anterior a hoje, comparando só a data local). */
export function isDateInPast(yyyyMmDd: string): boolean {
  if (!yyyyMmDd) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  return d.getTime() < today.getTime();
}

/** Garante que a data esteja >= hoje. Se inválida ou no passado, recalcula pela prioridade. */
export function sanitizeDueDate(date: string | null | undefined, priority: string | undefined | null): string {
  if (!date || isDateInPast(date) || isNaN(new Date(`${date}T00:00:00`).getTime())) {
    return computeDueDateByPriority(priority);
  }
  return date;
}
