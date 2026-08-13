import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ProspeccaoLead, ProspeccaoStatus, Prioridade, Potencial, ProspeccaoSituacao, ProspeccaoOrigem } from "./types";
import { applyPhoneMask, isOverdue, isToday, formatDate, currentMonthYear, exportCSV, useDebounce } from "./utils";
import { useProspeccaoLeads, useProspeccaoCustomOptions, leadToRow } from "@/hooks/use-prospeccao-leads";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, TrendingUp, Handshake, XCircle, Plus, Search, X, Download,
  ArrowUpDown, ArrowUp, ArrowDown, Check, Pencil, Trash2, ChevronLeft, ChevronRight, Clock, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CelebracaoContato } from "./CelebracaoContato";

type CelebracaoState = {
  open: boolean;
  variant: "contato" | "crm";
  leadName: string;
  contagemHoje?: number;
};

function contarContatosHoje(leads: ProspeccaoLead[]): number {
  const hoje = new Date().toDateString();
  let count = 0;
  for (const l of leads) {
    for (const h of l.historico) {
      if (h.descricao === "Contato realizado") {
        const d = new Date(h.data);
        if (!isNaN(d.getTime()) && d.toDateString() === hoje) count++;
      }
    }
  }
  return count;
}

const PAGE_SIZE = 20;

const STATUS_OPTIONS: string[] = ["Aguardando Retorno", "Em Negociação", "Sem Interesse", "Interessado", "Perdido"];
const SITUACAO_OPTIONS: string[] = ["Aguardando Retorno", "Reunião Confirmada", "Não tem condições financeiras", "Informou que não tem interesse"];
const ORIGEM_OPTIONS: string[] = ["WhatsApp Antigo", "Instagram", "Indicação", "Ligação", "Outro"];

const ADD_NEW_SENTINEL = "__ADD_NEW__";

const PRIORIDADE_OPTIONS: Prioridade[] = ["Alta", "Média", "Baixa"];
const POTENCIAL_OPTIONS: Potencial[] = ["Alto", "Médio", "Baixo"];

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Storage keys legados — limpamos no primeiro mount para evitar lixo nos navegadores
const LEGACY_STORAGE_KEYS = [
  "leads_prospeccao_ativa",
  "prospeccao_custom_status",
  "prospeccao_custom_situacao",
  "prospeccao_custom_origem",
];


function statusBadgeClass(status: ProspeccaoStatus): string {
  const map: Record<string, string> = {
    "Aguardando Retorno": "bg-muted text-foreground border-transparent",
    "Em Negociação": "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-transparent",
    "Sem Interesse": "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-transparent",
    "Interessado": "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-transparent",
    "Perdido": "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-transparent",
  };
  return map[status] || "bg-muted text-foreground border-transparent";
}

function prioridadeIcon(p: Prioridade) {
  const map: Record<Prioridade, string> = {
    Alta: "#EF4444",
    "Média": "#F59E0B",
    Baixa: "#10B981",
  };
  const color = map[p];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {p}
    </span>
  );
}

type SortKey = "nome" | "status" | "cidade" | "prioridade" | "proximaAcao" | "dataProximoContato" | "telefone";

function getCidade(lead: ProspeccaoLead): string {
  return lead.cidadeDirecionar || lead.cidadeLead || "—";
}
type SortDir = "asc" | "desc";

const EMPTY_LEAD: Omit<ProspeccaoLead, "id" | "criadoEm" | "atualizadoEm" | "historico"> = {
  nome: "", telefone: "", cidadeLead: "", cidadeDirecionar: "",
  ultimoContato: "", status: "Aguardando Retorno", situacao: "Aguardando Retorno",
  observacoes: "", deOndeVeio: "Outro", proximaAcao: "", dataProximoContato: "",
  prioridade: "Média", potencial: "Médio",
};

export default function ProspeccaoAtivaTab() {
  const { user } = useAuth();
  const { data: dbLeads = [] } = useProspeccaoLeads();
  const { data: customOptions = { status: [], situacao: [], origem: [] } } = useProspeccaoCustomOptions();

  // Mantemos um espelho local para edições otimistas instantâneas;
  // o React Query (com Realtime via RealtimeSync) sobrescreve quando dados frescos chegam.
  const [localLeads, setLocalLeads] = useState<ProspeccaoLead[] | null>(null);
  const leads = localLeads ?? dbLeads;
  const setLeads = setLocalLeads as (v: ProspeccaoLead[] | ((p: ProspeccaoLead[]) => ProspeccaoLead[])) => void;

  // Sincroniza estado local com o servidor quando os dados mudam (Realtime/refetch)
  const lastDbRef = useRef<ProspeccaoLead[]>(dbLeads);
  useEffect(() => {
    lastDbRef.current = dbLeads;
    setLocalLeads(null); // invalida espelho local — passa a usar dbLeads
  }, [dbLeads]);

  // Limpa storage legado uma vez
  useEffect(() => {
    try {
      LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);

  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 300);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPrioridade, setFilterPrioridade] = useState<string>("all");
  const [filterPotencial, setFilterPotencial] = useState<string>("all");
  const [filterCidade, setFilterCidade] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  // Sheet states
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<ProspeccaoLead | null>(null);
  const [form, setForm] = useState({ ...EMPTY_LEAD });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // New history note input (in detail view)
  const [newNote, setNewNote] = useState("");

  // Send to CRM dialog
  const [sendToCrmId, setSendToCrmId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Celebração popup
  const [celebracao, setCelebracao] = useState<CelebracaoState | null>(null);

  // KPI card filter
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);

  // Custom options vêm do Supabase (compartilhadas entre todos)
  const customStatus = customOptions.status;
  const customSituacao = customOptions.situacao;
  const customOrigem = customOptions.origem;

  // Inline "add new" mode states for the edit form
  const [addingNew, setAddingNew] = useState<null | "status" | "situacao" | "origem">(null);
  const [newOptionInput, setNewOptionInput] = useState("");

  const allStatusOptions = useMemo(() => [...STATUS_OPTIONS, ...customStatus], [customStatus]);
  const allSituacaoOptions = useMemo(() => [...SITUACAO_OPTIONS, ...customSituacao], [customSituacao]);
  const allOrigemOptions = useMemo(() => [...ORIGEM_OPTIONS, ...customOrigem], [customOrigem]);

  async function insertCustomOption(field: "status" | "situacao" | "origem", value: string) {
    try {
      await supabase.from("prospeccao_custom_options" as any).insert({
        field,
        value,
        created_by: user?.id || null,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["prospeccao-custom-options"] });
    } catch (err: any) {
      // Ignora erros de unique constraint silenciosamente
      if (!String(err?.message || "").includes("duplicate")) {
        toast.error("Erro ao salvar opção: " + (err?.message || "desconhecido"));
      }
    }
  }

  async function confirmAddNew() {
    const value = newOptionInput.trim();
    if (!value) {
      setAddingNew(null);
      return;
    }
    if (addingNew === "status") {
      if (!allStatusOptions.includes(value)) await insertCustomOption("status", value);
      setForm((f) => ({ ...f, status: value }));
    } else if (addingNew === "situacao") {
      if (!allSituacaoOptions.includes(value)) await insertCustomOption("situacao", value);
      setForm((f) => ({ ...f, situacao: value }));
    } else if (addingNew === "origem") {
      if (!allOrigemOptions.includes(value)) await insertCustomOption("origem", value);
      setForm((f) => ({ ...f, deOndeVeio: value }));
    }
    setNewOptionInput("");
    setAddingNew(null);
    toast.success("Nova opção adicionada");
  }

  function cancelAddNew() {
    setNewOptionInput("");
    setAddingNew(null);
  }

  // Sincroniza diff entre estado anterior e novo com Supabase (upsert + delete)
  const syncToSupabase = useCallback(async (prev: ProspeccaoLead[], next: ProspeccaoLead[]) => {
    const prevMap = new Map(prev.map((l) => [l.id, l]));
    const nextMap = new Map(next.map((l) => [l.id, l]));

    const toUpsert: ProspeccaoLead[] = [];
    next.forEach((l) => {
      const before = prevMap.get(l.id);
      if (!before || JSON.stringify(before) !== JSON.stringify(l)) toUpsert.push(l);
    });
    const toDelete: string[] = [];
    prev.forEach((l) => { if (!nextMap.has(l.id)) toDelete.push(l.id); });

    try {
      if (toUpsert.length > 0) {
        const rows = toUpsert.map((l) => leadToRow(l, user?.id));
        const { error } = await supabase
          .from("prospeccao_leads" as any)
          .upsert(rows as any, { onConflict: "id" });
        if (error) throw error;
      }
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from("prospeccao_leads" as any)
          .delete()
          .in("id", toDelete);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["prospeccao-leads"] });
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || "desconhecido"));
      // Reverte estado local em caso de falha
      setLocalLeads(null);
    }
  }, [user?.id, queryClient]);

  const persist = useCallback((updated: ProspeccaoLead[]) => {
    const prev = leads;
    setLeads(updated);
    void syncToSupabase(prev, updated);
  }, [leads, syncToSupabase]);

  // Inline cell editing
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [cellValue, setCellValue] = useState<string>("");
  const [inlineAddingNew, setInlineAddingNew] = useState<null | "status" | "situacao" | "origem">(null);
  const [inlineNewValue, setInlineNewValue] = useState("");

  const updateLead = useCallback((id: string, patch: Partial<ProspeccaoLead>, historyDesc?: string) => {
    const now = new Date().toISOString();
    const prev = leads;
    const updated = prev.map((l) => {
      if (l.id !== id) return l;
      const next: ProspeccaoLead = {
        ...l,
        ...patch,
        atualizadoEm: now,
        historico: historyDesc
          ? [{ data: now, descricao: historyDesc }, ...l.historico]
          : l.historico,
      };
      return next;
    });
    setLeads(updated);
    void syncToSupabase(prev, updated);
  }, [leads, syncToSupabase]);

  function startEdit(rowId: string, field: string, currentValue: string) {
    setEditingCell({ rowId, field });
    setCellValue(currentValue ?? "");
    setInlineAddingNew(null);
    setInlineNewValue("");
  }

  function commitEdit(field: string, valueOverride?: string) {
    if (!editingCell) return;
    const value = valueOverride !== undefined ? valueOverride : cellValue;
    updateLead(editingCell.rowId, { [field]: value } as Partial<ProspeccaoLead>, `Campo "${field}" atualizado`);
    setEditingCell(null);
    setCellValue("");
  }

  function cancelEdit() {
    setEditingCell(null);
    setCellValue("");
    setInlineAddingNew(null);
    setInlineNewValue("");
  }

  function confirmInlineAddNew(field: "status" | "situacao" | "origem") {
    const value = inlineNewValue.trim();
    if (!value) {
      setInlineAddingNew(null);
      return;
    }
    if (field === "status") {
      if (!allStatusOptions.includes(value)) void insertCustomOption("status", value);
      commitEdit("status", value);
    } else if (field === "situacao") {
      if (!allSituacaoOptions.includes(value)) void insertCustomOption("situacao", value);
      commitEdit("situacao", value);
    } else {
      if (!allOrigemOptions.includes(value)) void insertCustomOption("origem", value);
      commitEdit("deOndeVeio", value);
    }
    setInlineNewValue("");
    setInlineAddingNew(null);
    toast.success("Nova opção adicionada");
  }

  // Filtered leads
  const filtered = useMemo(() => {
    let result = [...leads];
    if (kpiFilter) {
      if (kpiFilter === "Reunião Confirmada") {
        result = result.filter((l) => l.situacao === "Reunião Confirmada");
      } else {
        result = result.filter((l) => l.status === kpiFilter);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) => l.nome.toLowerCase().includes(q) || l.telefone.includes(q));
    }
    if (filterStatus !== "all") result = result.filter((l) => l.status === filterStatus);
    if (filterPrioridade !== "all") result = result.filter((l) => l.prioridade === filterPrioridade);
    if (filterPotencial !== "all") result = result.filter((l) => l.potencial === filterPotencial);
    if (filterCidade !== "all") result = result.filter((l) => getCidade(l) === filterCidade);

    result.sort((a, b) => {
      const va = (sortKey === "cidade" ? getCidade(a) : (a[sortKey] || "")).toLowerCase();
      const vb = (sortKey === "cidade" ? getCidade(b) : (b[sortKey] || "")).toLowerCase();
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [leads, search, filterStatus, filterPrioridade, filterPotencial, filterCidade, sortKey, sortDir, kpiFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const hasActiveFilter = filterStatus !== "all" || filterPrioridade !== "all" || filterPotencial !== "all" || filterCidade !== "all" || search || kpiFilter;

  // Distinct cities for filter
  const distinctCities = useMemo(() => {
    const cities = new Set<string>();
    leads.forEach((l) => {
      const c = getCidade(l);
      if (c !== "—") cities.add(c);
    });
    return Array.from(cities).sort();
  }, [leads]);

  // KPI counts
  const total = leads.length;
  const interessados = leads.filter((l) => l.status === "Interessado").length;
  const emNegociacao = leads.filter((l) => l.status === "Em Negociação").length;
  const perdidos = leads.filter((l) => l.status === "Perdido").length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/60" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  }

  function clearFilters() {
    setFilterStatus("all");
    setFilterPrioridade("all");
    setFilterPotencial("all");
    setFilterCidade("all");
    setSearchRaw("");
    setKpiFilter(null);
    setPage(0);
  }

  async function handleSendToCrm() {
    if (!sendToCrmId) return;
    const lead = leads.find((l) => l.id === sendToCrmId);
    if (!lead) return;

    const now = new Date().toISOString();
    const cidade = lead.cidadeDirecionar || lead.cidadeLead || "";

    // 1. Update lead status in prospecção
    const updated = leads.map((l) =>
      l.id === lead.id
        ? {
            ...l,
            situacao: "Reunião Confirmada" as ProspeccaoSituacao,
            historico: [{ data: now, descricao: "Lead enviado para o CRM — reunião confirmada" }, ...l.historico],
            atualizadoEm: now,
          }
        : l
    );
    persist(updated);

    // 2. Insert into Supabase leads table
    const { error } = await supabase.from("leads").insert({
      name: lead.nome,
      phone: lead.telefone,
      city_of_interest: cidade,
      source: "Prospecção Ativa",
      stage: "captação",
      interest: lead.observacoes || null,
    });

    if (error) {
      toast.error("Erro ao enviar para o CRM: " + error.message);
    } else {
      toast.success("Lead enviado para o CRM com sucesso");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setCelebracao({ open: true, variant: "crm", leadName: lead.nome });
    }

    setSendToCrmId(null);
  }

  function openNew() {
    setEditingLead(null);
    setForm({ ...EMPTY_LEAD });
    setErrors({});
    setEditOpen(true);
  }

  function openEdit(lead: ProspeccaoLead) {
    setEditingLead(lead);
    setForm({ ...lead });
    setErrors({});
    setEditOpen(true);
  }

  function openDetail(lead: ProspeccaoLead) {
    setEditingLead(lead);
    setDetailOpen(true);
  }

  function validateForm(): boolean {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório";
    if (!form.telefone.trim()) e.telefone = "Telefone é obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validateForm()) return;
    const now = new Date().toISOString();
    if (editingLead) {
      const updated = leads.map((l) =>
        l.id === editingLead.id ? { ...l, ...form, atualizadoEm: now } : l
      );
      persist(updated);
      toast.success("Lead atualizado com sucesso");
    } else {
      const newLead: ProspeccaoLead = {
        ...form,
        id: generateId(),
        historico: [],
        criadoEm: now,
        atualizadoEm: now,
      };
      persist([newLead, ...leads]);
      toast.success("Lead criado com sucesso");
    }
    setEditOpen(false);
  }

  function handleContact(id: string) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const now = new Date().toISOString();
    const nextStep = prompt("Qual o próximo passo?");
    const updated = leads.map((l) =>
      l.id === id
        ? {
            ...l,
            ultimoContato: currentMonthYear(),
            historico: [{ data: now, descricao: "Contato realizado" }, ...l.historico],
            proximaAcao: nextStep || l.proximaAcao,
            atualizadoEm: now,
          }
        : l
    );
    persist(updated);
    const contagemHoje = contarContatosHoje(updated);
    setCelebracao({ open: true, variant: "contato", leadName: lead.nome, contagemHoje });
  }

  function handleDelete() {
    if (!deleteId) return;
    persist(leads.filter((l) => l.id !== deleteId));
    setDeleteId(null);
    toast.success("Lead excluído");
  }

  function handleKpiClick(filter: string | null) {
    setKpiFilter((prev) => (prev === filter ? null : filter));
    setPage(0);
  }

  const kpiCards = [
    { label: "Total de Leads", value: total, icon: Users, filter: null, hex: "#6B7280" },
    { label: "Interessados", value: interessados, icon: TrendingUp, filter: "Interessado", hex: "#059669" },
    { label: "Em Negociação", value: emNegociacao, icon: Handshake, filter: "Em Negociação", hex: "#2563EB" },
    { label: "Perdidos", value: perdidos, icon: XCircle, filter: "Perdido", hex: "#DC2626" },
  ];

  return (
    <div className="space-y-3">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map((k) => {
          const isActive = kpiFilter === k.filter;
          return (
            <div
              key={k.label}
              onClick={() => handleKpiClick(k.filter)}
              className={`cursor-pointer rounded-[10px] bg-card border border-border px-[18px] py-[14px] transition-colors hover:bg-muted/50 ${isActive ? "ring-2 ring-primary/30" : ""}`}
            >
              <div className="flex items-center justify-between">
                <k.icon className="h-[18px] w-[18px]" style={{ color: k.hex }} />
                <span className="text-[24px] font-semibold leading-none" style={{ color: k.hex }}>{k.value}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchRaw}
            onChange={(e) => { setSearchRaw(e.target.value); setPage(0); }}
            className="pl-9 h-9 text-[13px] rounded-lg"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="w-[160px] h-9 text-[13px] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {allStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPrioridade} onValueChange={(v) => { setFilterPrioridade(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] h-9 text-[13px] rounded-lg"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {PRIORIDADE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPotencial} onValueChange={(v) => { setFilterPotencial(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] h-9 text-[13px] rounded-lg"><SelectValue placeholder="Potencial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {POTENCIAL_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCidade} onValueChange={(v) => { setFilterCidade(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] h-9 text-[13px] rounded-lg"><SelectValue placeholder="Cidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cidades</SelectItem>
            {distinctCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" className="h-9 text-[13px] rounded-lg" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{filtered.length} leads encontrados</span>
        <Button variant="outline" size="sm" className="h-9 text-[13px] rounded-lg" onClick={() => exportCSV(filtered)}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button
          size="sm"
          className="h-9 text-[13px] font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={openNew}
        >
          <Plus className="h-4 w-4 mr-1" /> Novo Lead
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-background overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border hover:bg-muted/50">
              {([
                ["nome", "Nome"],
                ["telefone", "Telefone"],
                ["status", "Status"],
                ["cidade", "Cidade"],
                ["prioridade", "Prioridade"],
                ["proximaAcao", "Próxima Ação"],
                ["dataProximoContato", "Próximo Contato"],
              ] as [SortKey, string][]).map(([key, label]) => (
                <TableHead
                  key={key}
                  className="cursor-pointer select-none whitespace-nowrap text-[11px] uppercase tracking-[0.05em] text-muted-foreground font-semibold h-10"
                  onClick={() => toggleSort(key)}
                >
                  <span className="inline-flex items-center">{label}{sortIcon(key)}</span>
                </TableHead>
              ))}
              <TableHead className="text-right text-[11px] uppercase tracking-[0.05em] text-muted-foreground font-semibold h-10">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-[13px] text-muted-foreground">Nenhum lead encontrado</TableCell></TableRow>
            )}
            {paged.map((lead) => {
              const overdue = isOverdue(lead.dataProximoContato);
              const today = isToday(lead.dataProximoContato);
              return (
                <TableRow
                  key={lead.id}
                  className={`group cursor-pointer transition-colors hover:bg-muted/40 border-b border-border/60 ${
                    overdue
                      ? "bg-red-50 dark:bg-red-950/20 border-l-[3px] border-l-red-500"
                      : today
                        ? "bg-amber-50 dark:bg-amber-950/20 border-l-[3px] border-l-amber-500"
                        : ""
                  }`}
                  onClick={() => openDetail(lead)}
                >
                  <TableCell className="font-medium text-[13px] text-foreground py-3">
                    <div
                      className="cursor-pointer hover:text-primary hover:underline rounded px-1 -mx-1 min-h-[24px]"
                      onClick={(e) => { e.stopPropagation(); openDetail(lead); }}
                      title="Ver detalhes"
                    >
                      {lead.nome || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-foreground py-3" onClick={(e) => e.stopPropagation()}>
                    {editingCell?.rowId === lead.id && editingCell.field === "telefone" ? (
                      <Input
                        autoFocus
                        value={cellValue}
                        onChange={(e) => setCellValue(applyPhoneMask(e.target.value))}
                        onBlur={() => commitEdit("telefone")}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit("telefone"); if (e.key === "Escape") cancelEdit(); }}
                        className="h-8 text-[13px]"
                      />
                    ) : (
                      <div className="cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 min-h-[24px]" onClick={() => startEdit(lead.id, "telefone", lead.telefone)}>
                        {lead.telefone || "—"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                    {editingCell?.rowId === lead.id && editingCell.field === "status" ? (
                      inlineAddingNew === "status" ? (
                        <div className="flex gap-1">
                          <Input
                            autoFocus
                            value={inlineNewValue}
                            onChange={(e) => setInlineNewValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmInlineAddNew("status"); } if (e.key === "Escape") cancelEdit(); }}
                            placeholder="Nova opção"
                            className="h-8 text-[13px]"
                          />
                          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => confirmInlineAddNew("status")}><Check className="h-3 w-3" /></Button>
                          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={cancelEdit}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <Select
                          open
                          defaultValue={lead.status}
                          onValueChange={(v) => {
                            if (v === ADD_NEW_SENTINEL) { setInlineNewValue(""); setInlineAddingNew("status"); return; }
                            commitEdit("status", v);
                          }}
                          onOpenChange={(o) => { if (!o) cancelEdit(); }}
                        >
                          <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {allStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            <SelectItem value={ADD_NEW_SENTINEL} className="text-primary font-medium">+ Adicionar nova opção</SelectItem>
                          </SelectContent>
                        </Select>
                      )
                    ) : (
                      <div className="cursor-pointer" onClick={() => startEdit(lead.id, "status", lead.status)}>
                        <Badge className={`${statusBadgeClass(lead.status)} text-[11px] font-medium px-2.5 py-[3px] rounded-full hover:bg-opacity-100`}>
                          {lead.status}
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-foreground py-3" onClick={(e) => e.stopPropagation()}>
                    {editingCell?.rowId === lead.id && editingCell.field === "cidadeDirecionar" ? (
                      <Input
                        autoFocus
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={() => commitEdit("cidadeDirecionar")}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit("cidadeDirecionar"); if (e.key === "Escape") cancelEdit(); }}
                        className="h-8 text-[13px]"
                      />
                    ) : (
                      <div className="cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 min-h-[24px]" onClick={() => startEdit(lead.id, "cidadeDirecionar", lead.cidadeDirecionar || lead.cidadeLead)}>
                        {getCidade(lead)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                    {editingCell?.rowId === lead.id && editingCell.field === "prioridade" ? (
                      <Select
                        open
                        defaultValue={lead.prioridade}
                        onValueChange={(v) => commitEdit("prioridade", v)}
                        onOpenChange={(o) => { if (!o) cancelEdit(); }}
                      >
                        <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORIDADE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="cursor-pointer" onClick={() => startEdit(lead.id, "prioridade", lead.prioridade)}>
                        {prioridadeIcon(lead.prioridade)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-[13px] text-foreground py-3" onClick={(e) => e.stopPropagation()}>
                    {editingCell?.rowId === lead.id && editingCell.field === "proximaAcao" ? (
                      <Input
                        autoFocus
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={() => commitEdit("proximaAcao")}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit("proximaAcao"); if (e.key === "Escape") cancelEdit(); }}
                        className="h-8 text-[13px]"
                      />
                    ) : (
                      <div className="cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 min-h-[24px]" onClick={() => startEdit(lead.id, "proximaAcao", lead.proximaAcao)}>
                        {lead.proximaAcao || "—"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-foreground py-3" onClick={(e) => e.stopPropagation()}>
                    {editingCell?.rowId === lead.id && editingCell.field === "dataProximoContato" ? (
                      <Input
                        type="date"
                        autoFocus
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={() => commitEdit("dataProximoContato")}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit("dataProximoContato"); if (e.key === "Escape") cancelEdit(); }}
                        className="h-8 text-[13px]"
                      />
                    ) : (
                      <div className="cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 min-h-[24px]" onClick={() => startEdit(lead.id, "dataProximoContato", lead.dataProximoContato)}>
                        {formatDate(lead.dataProximoContato)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        title="Enviar para CRM"
                        onClick={() => setSendToCrmId(lead.id)}
                        className="cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Registrar contato"
                        onClick={() => handleContact(lead.id)}
                        className="cursor-pointer text-muted-foreground hover:text-emerald-600 dark:text-emerald-400 transition-colors"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => openEdit(lead)}
                        className="cursor-pointer text-muted-foreground hover:text-amber-600 dark:text-amber-400 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => setDeleteId(lead.id)}
                        className="cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Edit/Create Sheet */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{editingLead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
            <DialogDescription>{editingLead ? "Atualize os dados do lead de prospecção." : "Preencha os dados do novo lead."}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 py-4">
              {/* Seção Dados do Lead */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Dados do Lead</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                    {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
                  </div>
                  <div>
                    <Label>Telefone *</Label>
                    <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: applyPhoneMask(e.target.value) })} />
                    {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Cidade do Lead</Label>
                      <Input value={form.cidadeLead} onChange={(e) => setForm({ ...form, cidadeLead: e.target.value })} />
                    </div>
                    <div>
                      <Label>Cidade a Direcionar</Label>
                      <Input value={form.cidadeDirecionar} onChange={(e) => setForm({ ...form, cidadeDirecionar: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>De onde veio</Label>
                    {addingNew === "origem" ? (
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          value={newOptionInput}
                          onChange={(e) => setNewOptionInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAddNew(); } if (e.key === "Escape") cancelAddNew(); }}
                          placeholder="Digite a nova opção"
                        />
                        <Button type="button" size="icon" variant="outline" onClick={confirmAddNew}><Check className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="outline" onClick={cancelAddNew}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <Select
                        value={form.deOndeVeio}
                        onValueChange={(v) => {
                          if (v === ADD_NEW_SENTINEL) { setNewOptionInput(""); setAddingNew("origem"); return; }
                          setForm({ ...form, deOndeVeio: v });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {allOrigemOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          <SelectItem value={ADD_NEW_SENTINEL} className="text-primary font-medium">+ Adicionar nova opção</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Seção Acompanhamento */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Acompanhamento</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Status</Label>
                      {addingNew === "status" ? (
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            value={newOptionInput}
                            onChange={(e) => setNewOptionInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAddNew(); } if (e.key === "Escape") cancelAddNew(); }}
                            placeholder="Digite a nova opção"
                          />
                          <Button type="button" size="icon" variant="outline" onClick={confirmAddNew}><Check className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="outline" onClick={cancelAddNew}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <Select value={form.status} onValueChange={(v) => {
                          if (v === ADD_NEW_SENTINEL) { setNewOptionInput(""); setAddingNew("status"); return; }
                          setForm({ ...form, status: v });
                          if (v === "Perdido" || v === "Sem Interesse") {
                            toast.info("Recomendado preencher as observações para este status.");
                          }
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {allStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            <SelectItem value={ADD_NEW_SENTINEL} className="text-primary font-medium">+ Adicionar nova opção</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label>Observação</Label>
                      <Input
                        value={form.situacao}
                        onChange={(e) => setForm({ ...form, situacao: e.target.value as any })}
                        placeholder="Ex: aguardando retorno do sócio"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Prioridade</Label>
                      <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as Prioridade })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORIDADE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Potencial</Label>
                      <Select value={form.potencial} onValueChange={(v) => setForm({ ...form, potencial: v as Potencial })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POTENCIAL_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Último Contato (MM/AAAA)</Label>
                    <Input value={form.ultimoContato} onChange={(e) => setForm({ ...form, ultimoContato: e.target.value })} placeholder="04/2025" />
                  </div>
                  <div>
                    <Label>Próxima Ação</Label>
                    <Input value={form.proximaAcao} onChange={(e) => setForm({ ...form, proximaAcao: e.target.value })} />
                  </div>
                  <div>
                    <Label>Data Próximo Contato</Label>
                    <Input type="date" value={form.dataProximoContato} onChange={(e) => setForm({ ...form, dataProximoContato: e.target.value })} />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <Button className="w-full" onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
          {editingLead && (
            <>
              <DialogHeader className="p-6 pb-2">
                <DialogTitle>{editingLead.nome}</DialogTitle>
                <DialogDescription>Detalhes do lead de prospecção</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Telefone:</span><p className="font-medium">{editingLead.telefone}</p></div>
                    <div><span className="text-muted-foreground">Status:</span><p><Badge className={statusBadgeClass(editingLead.status)}>{editingLead.status}</Badge></p></div>
                    <div><span className="text-muted-foreground">Situação:</span><p className="font-medium">{editingLead.situacao}</p></div>
                    <div><span className="text-muted-foreground">Prioridade:</span><p>{prioridadeIcon(editingLead.prioridade)}</p></div>
                    <div><span className="text-muted-foreground">Potencial:</span><p className="font-medium">{editingLead.potencial}</p></div>
                    <div><span className="text-muted-foreground">De onde veio:</span><p className="font-medium">{editingLead.deOndeVeio}</p></div>
                    <div><span className="text-muted-foreground">Cidade Lead:</span><p className="font-medium">{editingLead.cidadeLead || "—"}</p></div>
                    <div><span className="text-muted-foreground">Cidade Direcionar:</span><p className="font-medium">{editingLead.cidadeDirecionar || "—"}</p></div>
                    <div><span className="text-muted-foreground">Último Contato:</span><p className="font-medium">{editingLead.ultimoContato || "—"}</p></div>
                    <div><span className="text-muted-foreground">Próxima Ação:</span><p className="font-medium">{editingLead.proximaAcao || "—"}</p></div>
                    <div><span className="text-muted-foreground">Data Próximo Contato:</span><p className="font-medium">{formatDate(editingLead.dataProximoContato)}</p></div>
                  </div>
                  {editingLead.observacoes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Observações:</span>
                      <p className="text-sm mt-1 bg-muted p-2 rounded">{editingLead.observacoes}</p>
                    </div>
                  )}

                  <Separator />

                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Histórico de Contatos
                    </h3>

                    {/* Add new history entry */}
                    <div className="mb-4 space-y-2">
                      <Textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Adicionar atualização ao histórico..."
                        rows={2}
                        className="text-sm resize-none"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={!newNote.trim()}
                          onClick={() => {
                            const desc = newNote.trim();
                            if (!desc || !editingLead) return;
                            updateLead(editingLead.id, {}, desc);
                            const now = new Date().toISOString();
                            setEditingLead({
                              ...editingLead,
                              atualizadoEm: now,
                              historico: [{ data: now, descricao: desc }, ...editingLead.historico],
                            });
                            setNewNote("");
                            toast.success("Atualização adicionada ao histórico");
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </div>

                    {editingLead.historico.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum contato registrado.</p>
                    ) : (
                      <div className="space-y-3">
                        {editingLead.historico.map((h, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <div className="flex flex-col items-center">
                              <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                              {i < editingLead.historico.length - 1 && <div className="w-px flex-1 bg-border" />}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{new Date(h.data).toLocaleDateString("pt-BR")} {new Date(h.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                              <p>{h.descricao}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
              <div className="p-4 border-t flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setDetailOpen(false); openEdit(editingLead); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => {
                  const text = `Nome: ${editingLead.nome}\nTelefone: ${editingLead.telefone}\nStatus: ${editingLead.status}\nPrioridade: ${editingLead.prioridade}\nCidade: ${editingLead.cidadeLead}\nPróxima Ação: ${editingLead.proximaAcao}`;
                  navigator.clipboard.writeText(text);
                  toast.success("Dados copiados!");
                }}>
                  Copiar Dados
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to CRM Confirmation */}
      <Dialog open={!!sendToCrmId} onOpenChange={() => setSendToCrmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para o CRM de Leads?</DialogTitle>
            <DialogDescription>
              Enviar <strong>{leads.find((l) => l.id === sendToCrmId)?.nome}</strong> para o CRM de Leads?
              <br />Isso indica que uma reunião foi confirmada com este lead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendToCrmId(null)}>Cancelar</Button>
            <Button onClick={handleSendToCrm}>Confirmar e Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Celebração popup */}
      <CelebracaoContato
        open={celebracao?.open ?? false}
        onClose={() => setCelebracao((p) => (p ? { ...p, open: false } : null))}
        variant={celebracao?.variant ?? "contato"}
        leadName={celebracao?.leadName ?? ""}
        contagemHoje={celebracao?.contagemHoje}
      />
    </div>
  );
}
