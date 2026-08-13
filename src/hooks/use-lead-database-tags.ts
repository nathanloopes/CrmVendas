import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LeadDatabaseTag {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export const TAG_PALETTE = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#6B7280", // gray
];

export function useLeadDatabaseTags() {
  return useQuery<LeadDatabaseTag[]>({
    queryKey: ["lead-database-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_database_tags" as any)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as LeadDatabaseTag[];
    },
    staleTime: 60_000,
  });
}

export function useCreateLeadDatabaseTag() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nome da etiqueta vazio");
      const { data, error } = await supabase
        .from("lead_database_tags" as any)
        .insert({ name: trimmed, color, created_by: user?.id || null } as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as LeadDatabaseTag;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-database-tags"] });
    },
  });
}
