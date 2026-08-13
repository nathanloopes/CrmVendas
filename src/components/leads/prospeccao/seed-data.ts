import type { ProspeccaoLead } from "./types";
import { generateId } from "./utils";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export const SEED_LEADS: ProspeccaoLead[] = [
  {
    id: generateId(),
    nome: "Carlos Mendes",
    telefone: "(11) 99876-5432",
    cidadeLead: "São Paulo",
    cidadeDirecionar: "Campinas",
    ultimoContato: "03/2025",
    status: "Interessado",
    situacao: "Reunião Confirmada",
    observacoes: "Demonstrou interesse no modelo express.",
    deOndeVeio: "Instagram",
    proximaAcao: "Enviar proposta comercial",
    dataProximoContato: daysFromNow(-3), // VENCIDO
    prioridade: "Alta",
    potencial: "Alto",
    historico: [
      { data: new Date(Date.now() - 86400000 * 5).toISOString(), descricao: "Primeiro contato via Instagram" },
      { data: new Date(Date.now() - 86400000 * 3).toISOString(), descricao: "Contato realizado" },
    ],
    criadoEm: new Date(Date.now() - 86400000 * 10).toISOString(),
    atualizadoEm: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: generateId(),
    nome: "Ana Beatriz Silva",
    telefone: "(21) 98765-4321",
    cidadeLead: "Rio de Janeiro",
    cidadeDirecionar: "Niterói",
    ultimoContato: "04/2025",
    status: "Em Negociação",
    situacao: "Aguardando Retorno",
    observacoes: "Aguardando aprovação do sócio.",
    deOndeVeio: "Indicação",
    proximaAcao: "Ligar para confirmar decisão",
    dataProximoContato: todayStr(), // HOJE
    prioridade: "Alta",
    potencial: "Alto",
    historico: [
      { data: new Date(Date.now() - 86400000 * 7).toISOString(), descricao: "Indicação recebida do franqueado SP" },
    ],
    criadoEm: new Date(Date.now() - 86400000 * 14).toISOString(),
    atualizadoEm: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: generateId(),
    nome: "Roberto Almeida",
    telefone: "(31) 97654-3210",
    cidadeLead: "Belo Horizonte",
    cidadeDirecionar: "Belo Horizonte",
    ultimoContato: "04/2025",
    status: "Aguardando Retorno",
    situacao: "Aguardando Retorno",
    observacoes: "",
    deOndeVeio: "WhatsApp Antigo",
    proximaAcao: "Enviar material institucional",
    dataProximoContato: daysFromNow(5),
    prioridade: "Média",
    potencial: "Médio",
    historico: [],
    criadoEm: new Date(Date.now() - 86400000 * 3).toISOString(),
    atualizadoEm: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: generateId(),
    nome: "Fernanda Costa",
    telefone: "(41) 96543-2109",
    cidadeLead: "Curitiba",
    cidadeDirecionar: "Londrina",
    ultimoContato: "03/2025",
    status: "Sem Interesse",
    situacao: "Informou que não tem interesse",
    observacoes: "Disse que não tem capital disponível no momento.",
    deOndeVeio: "Ligação",
    proximaAcao: "Retornar em 6 meses",
    dataProximoContato: daysFromNow(180),
    prioridade: "Baixa",
    potencial: "Baixo",
    historico: [
      { data: new Date(Date.now() - 86400000 * 30).toISOString(), descricao: "Ligação inicial — sem interesse" },
    ],
    criadoEm: new Date(Date.now() - 86400000 * 30).toISOString(),
    atualizadoEm: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: generateId(),
    nome: "Thiago Nascimento",
    telefone: "(85) 95432-1098",
    cidadeLead: "Fortaleza",
    cidadeDirecionar: "Fortaleza",
    ultimoContato: "04/2025",
    status: "Perdido",
    situacao: "Não tem condições financeiras",
    observacoes: "Optou por outra franquia.",
    deOndeVeio: "Outro",
    proximaAcao: "",
    dataProximoContato: "",
    prioridade: "Média",
    potencial: "Médio",
    historico: [
      { data: new Date(Date.now() - 86400000 * 20).toISOString(), descricao: "Primeiro contato" },
      { data: new Date(Date.now() - 86400000 * 10).toISOString(), descricao: "Reunião realizada — escolheu concorrente" },
    ],
    criadoEm: new Date(Date.now() - 86400000 * 25).toISOString(),
    atualizadoEm: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];
