import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AvailableCityRow {
  id: string;
  city: string;
  state: string;
  status: "available" | "reserved" | "occupied";
  occupied_by_lead_id: string | null;
  occupied_at: string | null;
  released_at: string | null;
  released_reason: string | null;
  notes: string | null;
  population?: number | null;
  gdp?: number | null;
  store_model?: string | null;
  state_full_name?: string | null;
  is_reposition?: boolean | null;
  country?: string | null;
  study_file_path?: string | null;
  study_file_name?: string | null;
  study_uploaded_at?: string | null;
  study_uploaded_by?: string | null;
  study_file_path_es?: string | null;
  study_file_name_es?: string | null;
  study_uploaded_at_es?: string | null;
  study_uploaded_by_es?: string | null;
}

export function useAvailableCities(uf?: string) {
  return useQuery({
    queryKey: ["available-cities", uf || "all"],
    queryFn: async () => {
      let query = supabase
        .from("available_cities" as any)
        .select("*")
        .order("city", { ascending: true });
      if (uf) query = query.ilike("state", uf);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AvailableCityRow[];
    },
    staleTime: 60_000,
  });
}

export function useAllAvailableCities(country?: "BR" | "PY") {
  return useQuery({
    queryKey: ["available-cities", "full", country || "all"],
    queryFn: async () => {
      let query = supabase
        .from("available_cities" as any)
        .select("*")
        .order("state", { ascending: true })
        .order("city", { ascending: true });
      if (country) query = query.eq("country", country);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AvailableCityRow[];
    },
    staleTime: 30_000,
  });
}
