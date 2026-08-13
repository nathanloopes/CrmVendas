import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProspeccaoLead, HistoricoEntry } from "@/components/leads/prospeccao/types";

interface DbRow {
  id: string;
  nome: string;
  telefone: string;
  cidade_lead: string | null;
  cidade_direcionar: string | null;
  ultimo_contato: string | null;
  status: string;
  situacao: string;
  observacoes: string | null;
  de_onde_veio: string | null;
  proxima_acao: string | null;
  data_proximo_contato: string | null;
  prioridade: string;
  potencial: string;
  historico: HistoricoEntry[] | null;
  created_at: string;
  updated_at: string;
}

export function rowToLead(r: DbRow): ProspeccaoLead {
  return {
    id: r.id,
    nome: r.nome ?? "",
    telefone: r.telefone ?? "",
    cidadeLead: r.cidade_lead ?? "",
    cidadeDirecionar: r.cidade_direcionar ?? "",
    ultimoContato: r.ultimo_contato ?? "",
    status: r.status,
    situacao: r.situacao,
    observacoes: r.observacoes ?? "",
    deOndeVeio: (r.de_onde_veio ?? "Outro") as any,
    proximaAcao: r.proxima_acao ?? "",
    dataProximoContato: r.data_proximo_contato ?? "",
    prioridade: (r.prioridade as any) ?? "Média",
    potencial: (r.potencial as any) ?? "Médio",
    historico: Array.isArray(r.historico) ? r.historico : [],
    criadoEm: r.created_at,
    atualizadoEm: r.updated_at,
  };
}

export function leadToRow(l: ProspeccaoLead, userId?: string | null) {
  return {
    id: l.id,
    nome: l.nome ?? "",
    telefone: l.telefone ?? "",
    cidade_lead: l.cidadeLead ?? "",
    cidade_direcionar: l.cidadeDirecionar ?? "",
    ultimo_contato: l.ultimoContato ?? "",
    status: l.status,
    situacao: l.situacao,
    observacoes: l.observacoes ?? "",
    de_onde_veio: l.deOndeVeio ?? "Outro",
    proxima_acao: l.proximaAcao ?? "",
    data_proximo_contato: l.dataProximoContato ?? "",
    prioridade: l.prioridade,
    potencial: l.potencial,
    historico: l.historico ?? [],
    created_by: userId ?? null,
  };
}

export function useProspeccaoLeads() {
  return useQuery<ProspeccaoLead[]>({
    queryKey: ["prospeccao-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospeccao_leads" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 4999);
      if (error) throw error;
      return ((data || []) as unknown as DbRow[]).map(rowToLead);
    },
    staleTime: 15_000,
  });
}

export interface CustomOptionsByField {
  status: string[];
  situacao: string[];
  origem: string[];
}

export function useProspeccaoCustomOptions() {
  return useQuery<CustomOptionsByField>({
    queryKey: ["prospeccao-custom-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospeccao_custom_options" as any)
        .select("field,value")
        .order("value", { ascending: true });
      if (error) throw error;
      const out: CustomOptionsByField = { status: [], situacao: [], origem: [] };
      ((data || []) as unknown as Array<{ field: string; value: string }>).forEach((r) => {
        if (r.field === "status") out.status.push(r.value);
        else if (r.field === "situacao") out.situacao.push(r.value);
        else if (r.field === "origem") out.origem.push(r.value);
      });
      return out;
    },
    staleTime: 60_000,
  });
}
