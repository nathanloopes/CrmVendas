export type ProspeccaoStatus = string;

export type ProspeccaoSituacao = string;

export type ProspeccaoOrigem = string;

export type Prioridade = "Alta" | "Média" | "Baixa";
export type Potencial = "Alto" | "Médio" | "Baixo";

export interface HistoricoEntry {
  data: string;
  descricao: string;
}

export interface ProspeccaoLead {
  id: string;
  nome: string;
  telefone: string;
  cidadeLead: string;
  cidadeDirecionar: string;
  ultimoContato: string;
  status: ProspeccaoStatus;
  situacao: ProspeccaoSituacao;
  observacoes: string;
  deOndeVeio: ProspeccaoOrigem;
  proximaAcao: string;
  dataProximoContato: string;
  prioridade: Prioridade;
  potencial: Potencial;
  historico: HistoricoEntry[];
  criadoEm: string;
  atualizadoEm: string;
}
