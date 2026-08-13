import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadDatabaseRow {
  id: string;
  name: string | null;
  phone_raw: string | null;
  phone_normalized: string;
  country_code: string;
  ddd: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  is_valid: boolean;
  invalid_reason: string | null;
  import_batch_id: string | null;
  tags: string[];
  promoted_lead_id: string | null;
  origin: string; // 'imported' | 'kanban' | 'manual' | 'franqueado'
  kanban_lead_id: string | null;
  is_franchisee: boolean;
  franchisee_match_type: string | null; // 'phone' | 'email' | 'name_city'
  franchisee_unit_code: string | null;
  franchisee_unit_name: string | null;
  franchisee_profile_id: string | null;
  franchisee_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadDatabaseQueryResult {
  rows: LeadDatabaseRow[];
  totalCount: number;
}

// Paginação interna para contornar o limite máximo do PostgREST por request (1000 linhas).
// Permite carregar bases grandes (~50k+) sem perda de registros.
const PAGE_SIZE = 1000;
const MAX_ROWS = 100000;

export function useLeadDatabase() {
  return useQuery<LeadDatabaseQueryResult>({
    queryKey: ["lead-database"],
    queryFn: async () => {
      const allRows: LeadDatabaseRow[] = [];
      let totalCount = 0;
      let from = 0;

      while (from < MAX_ROWS) {
        const to = from + PAGE_SIZE - 1;
        const { data, error, count } = await supabase
          .from("lead_database" as any)
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (count !== null && count !== undefined) totalCount = count;

        const batch = (data || []) as unknown as LeadDatabaseRow[];
        allRows.push(...batch);

        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;

        // Para se já buscamos todos
        if (totalCount && allRows.length >= totalCount) break;
      }

      return {
        rows: allRows,
        totalCount: totalCount || allRows.length,
      };
    },
    staleTime: 30_000,
  });
}
