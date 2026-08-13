import { supabase } from "@/integrations/supabase/client";
import type { LeadDatabaseRow } from "@/hooks/use-lead-database";

export interface PromoteResult {
  promoted: number;
  skippedDuplicates: number;
  errors: string[];
}

interface PromoteOptions {
  rows: LeadDatabaseRow[];
  userId: string | null | undefined;
  userFuncao?: string | null;
  extraTag?: string | null;
}

/**
 * Promove leads da Base de Dados para o pipeline de Captação Ativa,
 * inserindo na tabela `leads` e marcando o registro de origem.
 */
export async function promoteLeadsToPipeline({
  rows,
  userId,
  userFuncao,
  extraTag,
}: PromoteOptions): Promise<PromoteResult> {
  const result: PromoteResult = { promoted: 0, skippedDuplicates: 0, errors: [] };
  const isSdr = (userFuncao || "").toLowerCase() === "sdr";

  for (const r of rows) {
    if (!r.phone_normalized) continue;

    const baseTags = Array.isArray(r.tags) ? [...r.tags] : [];
    if (extraTag && !baseTags.includes(extraTag)) baseTags.push(extraTag);

    const insertPayload: Record<string, any> = {
      name: r.name || "Lead sem nome",
      phone: r.phone_normalized,
      stage: "captação",
      source: "Base de Dados de Leads",
      tags: baseTags,
      city: r.city || null,
      state: r.state || null,
      city_of_interest: r.city || null,
      state_of_interest: r.state || null,
      contact_source: r.source || "Prospecção Ativa",
    };
    if (isSdr && userId) insertPayload.sdr_responsible_id = userId;

    try {
      const { data: inserted, error } = await supabase
        .from("leads")
        .insert(insertPayload as any)
        .select("id")
        .single();

      if (error) {
        // Trigger check_duplicate_lead lança exceção com prefixo DUPLICATE_LEAD
        if (String(error.message).includes("DUPLICATE_LEAD") || error.code === "23505") {
          result.skippedDuplicates += 1;
          continue;
        }
        result.errors.push(`${r.name || r.phone_normalized}: ${error.message}`);
        continue;
      }

      result.promoted += 1;

      // Marca origem na base
      const newTags = Array.from(new Set([...baseTags, "→ Captação"]));
      await supabase
        .from("lead_database" as any)
        .update({
          status: "Convertido",
          promoted_lead_id: (inserted as any).id,
          tags: newTags,
        } as any)
        .eq("id", r.id);
    } catch (e: any) {
      result.errors.push(`${r.name || r.phone_normalized}: ${e?.message || e}`);
    }
  }

  return result;
}
