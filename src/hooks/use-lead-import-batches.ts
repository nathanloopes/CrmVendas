import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadImportBatch {
  id: string;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  no_ddd_rows: number;
  created_by: string | null;
  created_at: string;
  creator_name?: string | null;
}

export function useLeadImportBatches() {
  return useQuery<LeadImportBatch[]>({
    queryKey: ["lead-import-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_import_batches" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const batches = (data || []) as unknown as LeadImportBatch[];

      // Hidrata nome do criador
      const userIds = Array.from(new Set(batches.map((b) => b.created_by).filter(Boolean))) as string[];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users" as any)
          .select("id, name")
          .in("id", userIds);
        const map = new Map<string, string>();
        (users || []).forEach((u: any) => map.set(u.id, u.name));
        batches.forEach((b) => {
          if (b.created_by) b.creator_name = map.get(b.created_by) || null;
        });
      }
      return batches;
    },
    staleTime: 30_000,
  });
}
