import { supabase } from "@/integrations/supabase/client";

export interface DuplicateTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  created_at: string;
  created_by: string | null;
  priority: string | null;
  description: string | null;
  lead_id: string | null;
  type: string | null;
}

/** Normalize text: lowercase, strip accents and punctuation, collapse spaces. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stopwords curtas/irrelevantes que poluem a comparação. */
const STOPWORDS = new Set([
  "a", "o", "os", "as", "e", "de", "do", "da", "dos", "das",
  "para", "pra", "no", "na", "nos", "nas", "em", "um", "uma",
  "com", "sem", "ao", "aos", "que", "se",
]);

function tokens(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Jaccard similarity over token sets, with exact-match shortcut. */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  ta.forEach((t) => { if (tb.has(t)) intersection++; });
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.85;

/**
 * Find non-completed tasks for the same lead with similar titles.
 */
export async function findDuplicateTasks(params: {
  leadId: string;
  title: string;
}): Promise<DuplicateTask[]> {
  const { leadId, title } = params;
  if (!leadId || !title || title.trim().length < 3) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, due_date, assigned_to, created_at, created_by, priority, description, lead_id, type")
    .eq("lead_id", leadId)
    .neq("status", "completed");

  if (error || !data) return [];

  const matches = data
    .map((t) => ({ task: t, score: similarity(title, t.title || "") }))
    .filter((m) => m.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (matches.length === 0) return [];

  // Resolve assignee names
  const userIds = Array.from(new Set(matches.map((m) => m.task.assigned_to).filter(Boolean) as string[]));
  let usersMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, name").in("id", userIds);
    (users || []).forEach((u) => { usersMap[u.id] = u.name; });
  }

  return matches.map((m) => ({
    ...m.task,
    assignee_name: m.task.assigned_to ? usersMap[m.task.assigned_to] || null : null,
  }));
}
