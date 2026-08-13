import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadExportBatch {
  id: string;
  file_name: string;
  format: "xlsx" | "csv";
  scope: "all" | "filtered" | "selected" | "batch";
  total_rows: number;
  lead_ids: string[];
  filters_snapshot: any | null;
  created_by: string | null;
  created_at: string;
  creator_name?: string | null;
}

export function useLeadExportBatches() {
  return useQuery<LeadExportBatch[]>({
    queryKey: ["lead-export-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_export_batches" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const batches = (data || []) as unknown as LeadExportBatch[];

      const userIds = Array.from(
        new Set(batches.map((b) => b.created_by).filter(Boolean))
      ) as string[];
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

export interface RecordExportInput {
  fileName: string;
  format: "xlsx" | "csv";
  scope: "all" | "filtered" | "selected" | "batch";
  leadIds: string[];
  filters?: Record<string, any> | null;
  createdBy?: string | null;
}

export function useRecordLeadExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordExportInput) => {
      const { error } = await supabase.from("lead_export_batches" as any).insert({
        file_name: input.fileName,
        format: input.format,
        scope: input.scope,
        total_rows: input.leadIds.length,
        lead_ids: input.leadIds,
        filters_snapshot: input.filters ?? null,
        created_by: input.createdBy ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-export-batches"] });
    },
  });
}

export function useDeleteLeadExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lead_export_batches" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-export-batches"] });
    },
  });
}
