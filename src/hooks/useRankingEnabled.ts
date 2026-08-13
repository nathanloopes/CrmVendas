import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRankingEnabled() {
  const { data: enabled = false } = useQuery({
    queryKey: ["ranking-enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("global_kanban_settings")
        .select("custom_labels")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .single();
      const labels = data?.custom_labels as Record<string, any> | null;
      return labels?.__ranking_enabled__ === true;
    },
    staleTime: 300000,
  });
  return enabled;
}
