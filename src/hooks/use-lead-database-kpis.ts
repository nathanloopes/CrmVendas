import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadDatabaseKpis {
  total: number;
  importedToday: number;
  ddds: number;
  semClassificacao: number;
  invalidos: number;
}

/**
 * KPIs vindos direto do banco via COUNT exato (head: true) — não dependem
 * do volume carregado no client. Usa Realtime + polling de 30s como fallback.
 */
export function useLeadDatabaseKpis() {
  return useQuery<LeadDatabaseKpis>({
    queryKey: ["lead-database-kpis"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const table = "lead_database" as any;

      const [totalRes, todayRes, semClassRes, invalidRes, dddRes] = await Promise.all([
        supabase.from(table).select("id", { count: "exact", head: true }),
        supabase.from(table).select("id", { count: "exact", head: true }).gte("created_at", todayIso),
        supabase.from(table).select("id", { count: "exact", head: true }).or("state.is.null,region.is.null"),
        supabase.from(table).select("id", { count: "exact", head: true }).eq("is_valid", false),
        // DDDs distintos: paginação leve trazendo só a coluna ddd
        (async () => {
          const seen = new Set<string>();
          const PAGE = 1000;
          let from = 0;
          // limite defensivo pra não travar caso a base seja gigante
          for (let i = 0; i < 200; i++) {
            const { data, error } = await supabase
              .from(table)
              .select("ddd")
              .not("ddd", "is", null)
              .range(from, from + PAGE - 1);
            if (error) throw error;
            const batch = (data || []) as unknown as Array<{ ddd: string | null }>;
            batch.forEach((r) => r.ddd && seen.add(r.ddd));
            if (batch.length < PAGE) break;
            from += PAGE;
          }
          return seen.size;
        })(),
      ]);

      if (totalRes.error) throw totalRes.error;
      if (todayRes.error) throw todayRes.error;
      if (semClassRes.error) throw semClassRes.error;
      if (invalidRes.error) throw invalidRes.error;

      return {
        total: totalRes.count ?? 0,
        importedToday: todayRes.count ?? 0,
        ddds: dddRes,
        semClassificacao: semClassRes.count ?? 0,
        invalidos: invalidRes.count ?? 0,
      };
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
