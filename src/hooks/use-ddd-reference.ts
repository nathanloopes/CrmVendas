import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DDDReferenceRow {
  id: string;
  ddd: string;
  state: string;
  main_city: string;
  region: string;
  description: string | null;
}

export function useDDDReference() {
  return useQuery({
    queryKey: ["ddd-reference"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ddd_reference" as any)
        .select("id, ddd, state, main_city, region, description")
        .order("ddd", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DDDReferenceRow[];
    },
    staleTime: 1000 * 60 * 60, // 1h
  });
}

export function buildDDDLookup(rows: DDDReferenceRow[]): Map<string, DDDReferenceRow> {
  const m = new Map<string, DDDReferenceRow>();
  rows.forEach((r) => m.set(r.ddd, r));
  return m;
}
