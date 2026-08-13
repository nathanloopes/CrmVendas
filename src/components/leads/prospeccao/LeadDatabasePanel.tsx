import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterField } from "@/components/ui/filter-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Database, Upload, Download, Plus, Trash2, Search, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Pencil, X, RefreshCw, History, Tag, Send, Check,
  TagIcon, ChevronDown, Eraser,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useLeadDatabase, type LeadDatabaseRow } from "@/hooks/use-lead-database";
import { useLeadDatabaseKpis } from "@/hooks/use-lead-database-kpis";
import { useDDDReference, buildDDDLookup } from "@/hooks/use-ddd-reference";
import { useLeadDatabaseTags, type LeadDatabaseTag } from "@/hooks/use-lead-database-tags";
import { useLeadImportBatches, type LeadImportBatch } from "@/hooks/use-lead-import-batches";
import { parseLeadsFile, type ParseResult } from "@/lib/import-leads";
import { exportLeadsToXlsx, exportLeadsToCsv } from "@/lib/export-leads";
import { promoteLeadsToPipeline } from "@/lib/promote-leads";
import { normalizePhone, formatPhoneDisplay } from "@/lib/phone-utils";
import { Progress } from "@/components/ui/progress";
import { TagPickerPopover } from "./TagPickerPopover";
import { PromoteToPipelineDialog } from "./PromoteToPipelineDialog";
import { ImportHistorySheet } from "./ImportHistorySheet";
import { ExportHistorySheet } from "./ExportHistorySheet";
import {
  useLeadExportBatches,
  useRecordLeadExport,
  type LeadExportBatch,
} from "@/hooks/use-lead-export-batches";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const;

const STATUS_OPTIONS = [
  "Novo", "Em prospecção", "Contatado", "Sem resposta", "Interessado", "Desqualificado", "Convertido",
] as const;

type LeadStatus = typeof STATUS_OPTIONS[number];

const STATUS_STYLES: Record<string, string> = {
  "Novo": "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300",
  "Em prospecção": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  "Contatado": "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
  "Sem resposta": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  "Interessado": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  "Desqualificado": "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
  "Convertido": "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300",
};

interface ImportSummary {
  fileName: string;
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
  noDDD: number;
  inserted: number;
}

const EMPTY_FORM = {
  name: "",
  phone_raw: "",
  city: "",
  state: "",
  source: "",
  status: "Novo" as LeadStatus,
  notes: "",
};

export default function LeadDatabasePanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: queryData, isLoading, refetch: refetchRows, isFetching: isFetchingRows } = useLeadDatabase();
  const rows = queryData?.rows ?? [];
  const totalCount = queryData?.totalCount ?? 0;
  const { data: kpiData, refetch: refetchKpis, isFetching: isFetchingKpis } = useLeadDatabaseKpis();
  const { data: dddList = [] } = useDDDReference();
  const dddMap = useMemo(() => buildDDDLookup(dddList), [dddList]);

  const [isLive, setIsLive] = useState(false);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterDDDs, setFilterDDDs] = useState<string[]>([]);
  const [filterCity, setFilterCity] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTag, setFilterTag] = useState("all");
  const [filterOrigin, setFilterOrigin] = useState<"all" | "imported" | "kanban" | "manual">("all");
  const [view, setView] = useState<"general" | "franchisees">("general");
  const [isSyncingFranchisees, setIsSyncingFranchisees] = useState(false);
  const [filterBatchId, setFilterBatchId] = useState<string | null>(null);
  const [filterExportBatchId, setFilterExportBatchId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageInput, setPageInput] = useState<string>("");

  // Seleção
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Diálogos
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [previewData, setPreviewData] = useState<ParseResult | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeadDatabaseRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<LeadDatabaseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadDatabaseRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>("");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Deep-link: ?openUnit=<id> abre o card da unidade
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("openUnit");
    if (!openId) return;
    (async () => {
      const { data } = await supabase
        .from("lead_database")
        .select("*")
        .eq("id", openId)
        .maybeSingle();
      if (data) setDetailTarget(data as any);
      params.delete("openUnit");
      const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    })();
  }, []);

  const { data: tags = [] } = useLeadDatabaseTags();
  const { data: batches = [] } = useLeadImportBatches();
  const { data: exportBatches = [] } = useLeadExportBatches();
  const recordExport = useRecordLeadExport();
  const tagColorMap = useMemo(() => {
    const m = new Map<string, string>();
    tags.forEach((t) => m.set(t.name, t.color));
    return m;
  }, [tags]);
  const activeBatch = batches.find((b) => b.id === filterBatchId) || null;
  const activeExportBatch = exportBatches.find((b) => b.id === filterExportBatchId) || null;
  const activeExportLeadIds = useMemo(
    () => (activeExportBatch ? new Set(activeExportBatch.lead_ids) : null),
    [activeExportBatch]
  );

  // Filtros derivados
  const distinctCities = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.city && s.add(r.city));
    return Array.from(s).sort();
  }, [rows]);
  const distinctStates = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.state && s.add(r.state));
    return Array.from(s).sort();
  }, [rows]);
  const distinctRegions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.region && s.add(r.region));
    return Array.from(s).sort();
  }, [rows]);
  const distinctSources = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.source && s.add(r.source));
    return Array.from(s).sort();
  }, [rows]);
  const distinctDDDs = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.ddd && s.add(r.ddd));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const matches =
          (r.name || "").toLowerCase().includes(q) ||
          (r.phone_normalized || "").includes(q) ||
          (r.phone_raw || "").includes(q);
        if (!matches) return false;
      }
      if (filterDDDs.length > 0 && (!r.ddd || !filterDDDs.includes(r.ddd))) return false;
      if (filterCity !== "all" && r.city !== filterCity) return false;
      if (filterState !== "all" && r.state !== filterState) return false;
      if (filterRegion !== "all" && r.region !== filterRegion) return false;
      if (filterSource !== "all" && r.source !== filterSource) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterTag === "__none__") {
        if (Array.isArray(r.tags) && r.tags.length > 0) return false;
      } else if (filterTag !== "all") {
        if (!Array.isArray(r.tags) || !r.tags.includes(filterTag)) return false;
      }
      if (filterBatchId && r.import_batch_id !== filterBatchId) return false;
      if (filterOrigin !== "all" && (r.origin || "imported") !== filterOrigin) return false;
      // Tabs: Base Geral exclui franqueados; Franqueados mostra só franqueados
      if (view === "general" && r.is_franchisee) return false;
      if (view === "franchisees" && !r.is_franchisee) return false;
      if (activeExportLeadIds && !activeExportLeadIds.has(r.id)) return false;
      if (filterDateFrom) {
        if (new Date(r.created_at) < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const end = new Date(filterDateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > end) return false;
      }
      return true;
    });
  }, [rows, search, filterDDDs, filterCity, filterState, filterRegion, filterSource, filterStatus, filterTag, filterOrigin, filterBatchId, activeExportLeadIds, filterDateFrom, filterDateTo, view]);

  // Contadores das tabs
  const franchiseeCount = useMemo(() => rows.filter((r) => r.is_franchisee).length, [rows]);
  const generalCount = rows.length - franchiseeCount;
  const lastFranchiseeMatch = useMemo(() => {
    let max: string | null = null;
    rows.forEach((r) => {
      if (r.franchisee_matched_at && (!max || r.franchisee_matched_at > max)) {
        max = r.franchisee_matched_at;
      }
    });
    return max;
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // KPIs vindos direto do banco (sempre exatos, independem do volume client-side)
  const kpis = {
    total: kpiData?.total ?? totalCount,
    importedToday: kpiData?.importedToday ?? 0,
    ddds: kpiData?.ddds ?? 0,
    semClassificacao: kpiData?.semClassificacao ?? 0,
    invalidos: kpiData?.invalidos ?? 0,
  };

  // Realtime: invalida cache quando lead_database muda (insert/update/delete)
  useEffect(() => {
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidate = () => {
      if (pendingTimeout) return;
      pendingTimeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["lead-database"] });
        queryClient.invalidateQueries({ queryKey: ["lead-database-kpis"] });
        pendingTimeout = null;
      }, 1500);
    };

    const channel = supabase
      .channel("lead-database-realtime")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "lead_database" },
        scheduleInvalidate
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [queryClient]);

  function handleManualRefresh() {
    refetchRows();
    refetchKpis();
    toast.success("Dados atualizados");
  }

  async function handleSyncFranchisees() {
    setIsSyncingFranchisees(true);
    const t = toast.loading("Cruzando base com franqueados do sistema externo…");
    try {
      const { data, error } = await supabase.functions.invoke("match-franchisees", { body: {} });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na sincronização");
      const pulled = data.pulled ?? 0;
      const pullUpdated = data.pullUpdated ?? 0;
      const matched = data.matched ?? 0;
      const total = data.totalFranchisees ?? 0;
      const purgedDeleted = data.purgedDeleted ?? 0;
      const purgedUnflagged = data.purgedUnflagged ?? 0;
      const purgeMsg =
        purgedDeleted || purgedUnflagged
          ? ` Limpeza: ${purgedDeleted} colaborador(es) removido(s), ${purgedUnflagged} desmarcado(s).`
          : "";
      toast.success(
        `Sincronização concluída: ${pulled} novo(s) franqueado(s) importado(s) do sistema externo, ${pullUpdated} atualizado(s) e ${matched} lead(s) existente(s) marcado(s). Total no sistema externo: ${total}.${purgeMsg}`,
        { id: t, duration: 9000 },
      );
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
      queryClient.invalidateQueries({ queryKey: ["lead-database-kpis"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao sincronizar franqueados", { id: t });
    } finally {
      setIsSyncingFranchisees(false);
    }
  }

  const unmarkFranchiseeMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("lead_database" as any)
        .update({
          is_franchisee: false,
          franchisee_match_type: null,
          franchisee_unit_code: null,
          franchisee_unit_name: null,
          franchisee_profile_id: null,
          franchisee_matched_at: null,
          origin: "imported",
        } as any)
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead desmarcado como franqueado");
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao desmarcar"),
  });

  // ============ Mutations ============
  // Passo 1: parse + abre prévia
  const parseMutation = useMutation({
    mutationFn: async (file: File): Promise<{ result: ParseResult; file: File }> => {
      const result = await parseLeadsFile(file);
      return { result, file };
    },
    onSuccess: ({ result, file }) => {
      if (result.warning) {
        toast.error(result.warning);
        return;
      }
      if (result.rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada na planilha.");
        return;
      }
      setPreviewData(result);
      setPreviewFile(file);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao ler planilha"),
  });

  // Passo 2: confirma e insere no banco em lotes
  const confirmImportMutation = useMutation({
    mutationFn: async ({ result, file }: { result: ParseResult; file: File }): Promise<ImportSummary> => {
      const { rows: parsed, stats } = result;

      // Cria batch
      const { data: batchData, error: batchErr } = await supabase
        .from("lead_import_batches" as any)
        .insert({
          file_name: file.name,
          total_rows: stats.total,
          valid_rows: stats.valid,
          invalid_rows: stats.invalid,
          duplicate_rows: stats.duplicatesInFile,
          no_ddd_rows: stats.noDDD,
          created_by: user?.id || null,
        } as any)
        .select("id")
        .single();
      if (batchErr) throw batchErr;
      const batchId = (batchData as any)?.id as string;

      // Enriquece com DDD reference
      const enriched = parsed.map((p) => {
        const ref = p.ddd ? dddMap.get(p.ddd) : undefined;
        return {
          name: p.name,
          phone_raw: p.phone_raw,
          phone_normalized: p.phone_normalized,
          country_code: "55",
          ddd: p.ddd,
          city: p.city || ref?.main_city || null,
          state: p.state || ref?.state || null,
          region: p.region || ref?.region || null,
          source: p.source,
          status: p.status || "Novo",
          notes: p.notes,
          is_valid: p.is_valid,
          invalid_reason: p.invalid_reason,
          import_batch_id: batchId,
          origin: "imported",
          created_by: user?.id || null,
        };
      });

      // Insere em lotes (resiliente: erro num lote não pára os outros)
      const BATCH = 500;
      const totalBatches = Math.ceil(enriched.length / BATCH);
      let inserted = 0;
      const batchErrors: string[] = [];

      setImportProgress({ current: 0, total: totalBatches });

      for (let i = 0; i < enriched.length; i += BATCH) {
        const idx = Math.floor(i / BATCH) + 1;
        const slice = enriched.slice(i, i + BATCH);
        try {
          const { data, error } = await supabase
            .from("lead_database" as any)
            .upsert(slice as any, { onConflict: "phone_normalized", ignoreDuplicates: true })
            .select("id");
          if (error) throw error;
          inserted += (data?.length || 0);
        } catch (e: any) {
          batchErrors.push(`Lote ${idx}: ${e?.message || e}`);
          console.error(`[ImportLeads] Lote ${idx} falhou`, e);
        }
        setImportProgress({ current: idx, total: totalBatches });
        // KPIs sobem em tempo real durante a importação
        queryClient.invalidateQueries({ queryKey: ["lead-database-kpis"] });
      }

      if (batchErrors.length > 0) {
        toast.warning(`${batchErrors.length} lote(s) com erro. ${inserted} leads inseridos mesmo assim.`);
      }

      const duplicatesInDb = enriched.length - inserted - stats.duplicatesInFile;

      return {
        fileName: file.name,
        total: stats.total,
        valid: stats.valid,
        invalid: stats.invalid,
        duplicatesInFile: stats.duplicatesInFile,
        duplicatesInDb: Math.max(0, duplicatesInDb),
        noDDD: stats.noDDD,
        inserted,
      };
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      setPreviewData(null);
      setPreviewFile(null);
      setImportProgress(null);
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
      queryClient.invalidateQueries({ queryKey: ["lead-database-kpis"] });
    },
    onError: (err: any) => {
      setImportProgress(null);
      toast.error(err?.message || "Erro ao importar");
    },
  });

  const addLeadMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) => {
      const norm = normalizePhone(payload.phone_raw);
      if (!norm.isValid) throw new Error(norm.reason || "Telefone inválido");
      const ref = norm.ddd ? dddMap.get(norm.ddd) : undefined;
      const { error } = await supabase.from("lead_database" as any).insert({
        name: payload.name || null,
        phone_raw: payload.phone_raw,
        phone_normalized: norm.normalized,
        country_code: "55",
        ddd: norm.ddd,
        city: payload.city || ref?.main_city || null,
        state: payload.state || ref?.state || null,
        region: ref?.region || null,
        source: payload.source || null,
        status: payload.status || "Novo",
        notes: payload.notes || null,
        created_by: user?.id || null,
        is_valid: true,
        origin: "manual",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead adicionado");
      setAddOpen(false);
      setForm({ ...EMPTY_FORM });
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => {
      if (String(err?.message || "").includes("duplicate") || err?.code === "23505") {
        toast.error("Este telefone já está cadastrado");
      } else {
        toast.error(err?.message || "Erro ao adicionar");
      }
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (lead: LeadDatabaseRow) => {
      const { error } = await supabase
        .from("lead_database" as any)
        .update({
          name: lead.name,
          city: lead.city,
          state: lead.state,
          region: lead.region,
          source: lead.source,
          status: lead.status,
          notes: lead.notes,
        } as any)
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead atualizado");
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_database" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead excluído");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("lead_database" as any).delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} leads excluídos`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir"),
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from("lead_database" as any)
        .update({ status } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: ["lead-database"] });
      const previous = queryClient.getQueryData(["lead-database"]);
      const idSet = new Set(ids);
      const nowIso = new Date().toISOString();
      queryClient.setQueryData(["lead-database"], (old: any) => {
        if (!old?.rows) return old;
        return {
          ...old,
          rows: old.rows.map((r: any) =>
            idSet.has(r.id) ? { ...r, status, updated_at: nowIso } : r
          ),
        };
      });
      return { previous };
    },
    onSuccess: (_d, vars) => {
      toast.success(`${vars.ids.length} leads atualizados`);
      setSelected(new Set());
      setBulkStatusValue("");
    },
    onError: (err: any, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(["lead-database"], ctx.previous);
      toast.error(err?.message || "Erro ao atualizar");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
      queryClient.invalidateQueries({ queryKey: ["lead-database-kpis"] });
    },
  });

  const bulkReclassifyMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const targets = rows.filter((r) => ids.includes(r.id) && r.ddd);
      // Atualizações independentes, em pequenos batches
      for (const r of targets) {
        const ref = r.ddd ? dddMap.get(r.ddd) : undefined;
        if (!ref) continue;
        await supabase.from("lead_database" as any).update({
          state: ref.state,
          region: ref.region,
          city: r.city || ref.main_city,
        } as any).eq("id", r.id);
      }
    },
    onSuccess: () => {
      toast.success("Leads reclassificados por DDD");
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao reclassificar"),
  });

  // Aplica etiqueta a um conjunto de leads (sem duplicar no array)
  const applyTagMutation = useMutation({
    mutationFn: async ({ ids, tag }: { ids: string[]; tag: LeadDatabaseTag }) => {
      const targets = rows.filter((r) => ids.includes(r.id));
      // Atualiza individualmente para preservar tags pré-existentes por linha
      for (const t of targets) {
        const current = Array.isArray(t.tags) ? t.tags : [];
        if (current.includes(tag.name)) continue;
        const next = [...current, tag.name];
        await supabase.from("lead_database" as any).update({ tags: next } as any).eq("id", t.id);
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(`Etiqueta "${vars.tag.name}" aplicada a ${vars.ids.length} lead(s)`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao aplicar etiqueta"),
  });

  // Remove uma etiqueta de um único lead
  const removeTagMutation = useMutation({
    mutationFn: async ({ leadId, tagName }: { leadId: string; tagName: string }) => {
      const target = rows.find((r) => r.id === leadId);
      if (!target) return;
      const current = Array.isArray(target.tags) ? target.tags : [];
      const next = current.filter((t) => t !== tagName);
      const { error } = await supabase
        .from("lead_database" as any)
        .update({ tags: next } as any)
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover etiqueta"),
  });

  // Remove etiqueta(s) em massa: tagName=null limpa todas
  const bulkRemoveTagMutation = useMutation({
    mutationFn: async ({ ids, tagName }: { ids: string[]; tagName: string | null }) => {
      const targets = rows.filter((r) => ids.includes(r.id));
      let updated = 0;
      for (const t of targets) {
        const current = Array.isArray(t.tags) ? t.tags : [];
        const next = tagName === null ? [] : current.filter((x) => x !== tagName);
        if (next.length === current.length) continue;
        const { error } = await supabase
          .from("lead_database" as any)
          .update({ tags: next } as any)
          .eq("id", t.id);
        if (error) throw error;
        updated++;
      }
      return updated;
    },
    onSuccess: (updated, vars) => {
      const label = vars.tagName === null ? "todas as etiquetas" : `etiqueta "${vars.tagName}"`;
      toast.success(`${label} removida(s) de ${updated} lead(s)`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover etiquetas"),
  });

  const promoteMutation = useMutation({
    mutationFn: async (extraTag: string | null) => {
      const targets = rows.filter((r) => selected.has(r.id) && r.is_valid);
      if (targets.length === 0) throw new Error("Nenhum lead válido selecionado");
      const result = await promoteLeadsToPipeline({
        rows: targets,
        userId: user?.id,
        userFuncao: (user as any)?.user_metadata?.funcao,
        extraTag,
      });
      return result;
    },
    onSuccess: (result) => {
      const parts = [`${result.promoted} enviados para Captação`];
      if (result.skippedDuplicates > 0) parts.push(`${result.skippedDuplicates} ignorados (já existiam)`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} erro(s)`);
      if (result.promoted > 0) toast.success(parts.join(" · "));
      else toast.warning(parts.join(" · "));
      if (result.errors.length > 0) {
        console.warn("[Promote] Erros:", result.errors);
      }
      setPromoteOpen(false);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lead-database"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao enviar para Captação"),
  });

  // Handlers
  function clearFilters() {
    setSearch("");
    setFilterDDDs([]);
    setFilterCity("all");
    setFilterState("all");
    setFilterRegion("all");
    setFilterSource("all");
    setFilterStatus("all");
    setFilterTag("all");
    setFilterBatchId(null);
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(0);
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) paged.forEach((r) => next.add(r.id));
      else paged.forEach((r) => next.delete(r.id));
      return next;
    });
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((r) => r.id)));
    toast.success(`${filtered.length} lead(s) selecionados`);
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function goToPage() {
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n) || n < 1 || n > totalPages) {
      toast.error(`Informe uma página entre 1 e ${totalPages}`);
      return;
    }
    setPage(n - 1);
    setPageInput("");
  }

  async function handleExport(scope: "all" | "filtered" | "selected", format: "xlsx" | "csv") {
    let data: LeadDatabaseRow[];
    if (scope === "all") data = rows;
    else if (scope === "filtered") data = filtered;
    else data = rows.filter((r) => selected.has(r.id));

    if (data.length === 0) {
      toast.warning("Nenhum lead para exportar");
      return;
    }
    const filename = `leads-${scope}-${new Date().toISOString().slice(0, 10)}.${format}`;
    if (format === "xlsx") exportLeadsToXlsx(data, filename);
    else exportLeadsToCsv(data, filename);
    toast.success(`${data.length} leads exportados`);

    // Registra no histórico de exportações
    try {
      await recordExport.mutateAsync({
        fileName: filename,
        format,
        scope,
        leadIds: data.map((r) => r.id),
        filters: {
          search: search || undefined,
          ddds: filterDDDs.length ? filterDDDs : undefined,
          city: filterCity !== "all" ? filterCity : undefined,
          state: filterState !== "all" ? filterState : undefined,
          region: filterRegion !== "all" ? filterRegion : undefined,
          source: filterSource !== "all" ? filterSource : undefined,
          status: filterStatus !== "all" ? filterStatus : undefined,
          tag: filterTag !== "all" ? filterTag : undefined,
          import_batch_id: filterBatchId || undefined,
          export_batch_id: filterExportBatchId || undefined,
          date_from: filterDateFrom || undefined,
          date_to: filterDateTo || undefined,
        },
        createdBy: user?.id || null,
      });
    } catch (e: any) {
      console.error("Falha ao registrar histórico de exportação", e);
    }
  }

  function redownloadExportBatch(batch: LeadExportBatch) {
    const ids = new Set(batch.lead_ids);
    const data = rows.filter((r) => ids.has(r.id));
    if (data.length === 0) {
      toast.warning("Nenhum lead deste lote está disponível atualmente");
      return;
    }
    const filename = batch.file_name.replace(/(\.[^.]+)?$/, `-rebaixado.${batch.format}`);
    if (batch.format === "xlsx") exportLeadsToXlsx(data, filename);
    else exportLeadsToCsv(data, filename);
    toast.success(`${data.length} leads re-exportados`);
  }

  function toggleDDDFilter(ddd: string) {
    setFilterDDDs((prev) => prev.includes(ddd) ? prev.filter((d) => d !== ddd) : [...prev, ddd]);
    setPage(0);
  }

  const allVisibleSelected = paged.length > 0 && paged.every((r) => selected.has(r.id));

  // Etiquetas presentes nos leads atualmente selecionados (para popover de remoção)
  const tagsInSelection = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (selected.has(r.id) && Array.isArray(r.tags)) {
        r.tags.forEach((t) => s.add(t));
      }
    });
    return Array.from(s).sort();
  }, [rows, selected]);

  const isImporting = parseMutation.isPending || confirmImportMutation.isPending;
  const importLabel = parseMutation.isPending
    ? "Lendo planilha..."
    : confirmImportMutation.isPending
      ? "Importando..."
      : "Importar planilha de leads";

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Base de Dados de Leads
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Importe, organize, filtre e exporte leads para prospecção ativa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseMutation.mutate(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 mr-1" /> {importLabel}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-1" /> Exportar leads
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleExport("all", "xlsx")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Todos (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("all", "csv")}>
                  <FileText className="h-4 w-4 mr-2" /> Todos (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("filtered", "xlsx")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Filtrados (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("filtered", "csv")}>
                  <FileText className="h-4 w-4 mr-2" /> Filtrados (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selected.size === 0}
                  onClick={() => handleExport("selected", "xlsx")}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Selecionados (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selected.size === 0}
                  onClick={() => handleExport("selected", "csv")}
                >
                  <FileText className="h-4 w-4 mr-2" /> Selecionados (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <History className="h-4 w-4 mr-1" /> Histórico
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Importações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setExportHistoryOpen(true)}>
                  <Download className="h-4 w-4 mr-2" /> Exportações
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={() => { setForm({ ...EMPTY_FORM }); setAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar lead
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tabs: Base Geral | Franqueados */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setView("general"); setPage(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                view === "general"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              📂 Base Geral
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${view === "general" ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>
                {generalCount.toLocaleString("pt-BR")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setView("franchisees"); setPage(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                view === "franchisees"
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              🏪 Franqueados
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${view === "franchisees" ? "bg-white/25" : "bg-muted text-muted-foreground"}`}>
                {franchiseeCount.toLocaleString("pt-BR")}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {lastFranchiseeMatch && (
              <span className="text-xs text-muted-foreground">
                Última sincronização: {new Date(lastFranchiseeMatch).toLocaleString("pt-BR")}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFranchisees}
              disabled={isSyncingFranchisees}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSyncingFranchisees ? "animate-spin" : ""}`} />
              {isSyncingFranchisees ? "Sincronizando…" : "Sincronizar Franqueados"}
            </Button>
          </div>
        </div>

        {view === "franchisees" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-200">
            <strong>Franqueados identificados:</strong> são leads desta base que já constam como franqueados ativos no sistema externo. Eles foram automaticamente removidos da Base Geral. A sincronização roda diariamente às 07h e pode ser disparada manualmente pelo botão acima.
          </div>
        )}

        {/* KPIs header com indicador realtime */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Ao vivo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                Conectando…
              </span>
            )}
            <span className="text-muted-foreground">Atualização automática a cada 30s</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isFetchingRows || isFetchingKpis}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${(isFetchingRows || isFetchingKpis) ? "animate-spin" : ""}`} />
            Atualizar agora
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Total de leads</p>
            <p className="text-2xl font-bold">{kpis.total.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">Importados hoje</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{kpis.importedToday.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 p-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">DDDs identificados</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{kpis.ddds}</p>
          </div>
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">Sem classificação</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{kpis.semClassificacao.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg border bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 p-3">
            <p className="text-xs text-rose-700 dark:text-rose-300">Telefones inválidos</p>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{kpis.invalidos.toLocaleString("pt-BR")}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <FilterField label="Buscar (nome ou telefone)">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Buscar..."
                  className="pl-8 h-9"
                />
              </div>
            </FilterField>
            <FilterField label="Cidade">
              <Select value={filterCity} onValueChange={(v) => { setFilterCity(v); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {distinctCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Estado">
              <Select value={filterState} onValueChange={(v) => { setFilterState(v); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {distinctStates.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Região">
              <Select value={filterRegion} onValueChange={(v) => { setFilterRegion(v); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {distinctRegions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Canal">
              <Select value={filterSource} onValueChange={(v) => { setFilterSource(v); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {distinctSources.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Tipo de Origem">
              <Select value={filterOrigin} onValueChange={(v) => { setFilterOrigin(v as any); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="imported">📥 Importação</SelectItem>
                  <SelectItem value="kanban">🎯 Kanban</SelectItem>
                  <SelectItem value="manual">✍️ Manual</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Etiqueta">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-between font-normal">
                    <span className="inline-flex items-center gap-2 truncate">
                      {filterTag === "all" ? (
                        <span className="text-muted-foreground">Todas</span>
                      ) : filterTag === "__none__" ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground" />
                          Sem etiqueta
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: tagColorMap.get(filterTag) || "#6B7280" }}
                          />
                          {filterTag}
                        </span>
                      )}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar etiqueta..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>Nenhuma etiqueta.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="todas"
                          onSelect={() => { setFilterTag("all"); setPage(0); }}
                        >
                          <Check className={`mr-2 h-3.5 w-3.5 ${filterTag === "all" ? "opacity-100" : "opacity-0"}`} />
                          Todas
                        </CommandItem>
                        <CommandItem
                          value="sem etiqueta"
                          onSelect={() => { setFilterTag("__none__"); setPage(0); }}
                        >
                          <Check className={`mr-2 h-3.5 w-3.5 ${filterTag === "__none__" ? "opacity-100" : "opacity-0"}`} />
                          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground mr-2" />
                          Sem etiqueta
                        </CommandItem>
                      </CommandGroup>
                      {tags.length > 0 && (
                        <CommandGroup heading="Etiquetas">
                          {tags.map((t) => (
                            <CommandItem
                              key={t.id}
                              value={t.name}
                              onSelect={() => { setFilterTag(t.name); setPage(0); }}
                            >
                              <Check className={`mr-2 h-3.5 w-3.5 ${filterTag === t.name ? "opacity-100" : "opacity-0"}`} />
                              <span className="h-2.5 w-2.5 rounded-full mr-2" style={{ background: t.color }} />
                              {t.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FilterField>
            <FilterField label="Importado de">
              <Input type="date" className="h-9" value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(0); }} />
            </FilterField>
            <FilterField label="Importado até">
              <Input type="date" className="h-9" value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(0); }} />
            </FilterField>
          </div>

          {activeBatch && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <History className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">
                  Filtrando lote: <strong>{activeBatch.file_name}</strong>
                  <span className="text-muted-foreground ml-1">
                    ({new Date(activeBatch.created_at).toLocaleDateString("pt-BR")})
                  </span>
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setFilterBatchId(null); setPage(0); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Remover filtro
              </Button>
            </div>
          )}

          {activeExportBatch && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-300 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Download className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="truncate">
                  Exibindo leads do export: <strong>{activeExportBatch.file_name}</strong>
                  <span className="text-muted-foreground ml-1">
                    ({activeExportBatch.total_rows.toLocaleString("pt-BR")} leads · {new Date(activeExportBatch.created_at).toLocaleDateString("pt-BR")})
                  </span>
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setFilterExportBatchId(null); setPage(0); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Remover filtro
              </Button>
            </div>
          )}

          {/* DDDs multi-select chips */}
          <div>
            <Label className="text-xs flex items-center justify-between">
              <span>DDDs (multi-seleção)</span>
              {filterDDDs.length > 0 && (
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() => setFilterDDDs([])}
                >
                  Limpar DDDs
                </button>
              )}
            </Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto p-1">
              {distinctDDDs.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum DDD na base ainda.</span>
              )}
              {distinctDDDs.map((d) => {
                const active = filterDDDs.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDDDFilter(d)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="text-sm font-medium">
              {selected.size.toLocaleString("pt-BR")} selecionado(s)
            </span>
            {selected.size < filtered.length && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 font-semibold"
                onClick={selectAllFiltered}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Selecionar todos os {filtered.length.toLocaleString("pt-BR")} do filtro
              </Button>
            )}
            {selected.size >= filtered.length && filtered.length > 0 && (
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> Todos do filtro selecionados
              </span>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearSelection}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
                <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Alterar status" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!bulkStatusValue || bulkUpdateStatusMutation.isPending}
                onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selected), status: bulkStatusValue })}
              >
                Aplicar status
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkReclassifyMutation.isPending}
                onClick={() => bulkReclassifyMutation.mutate(Array.from(selected))}
              >
                Reclassificar por DDD
              </Button>
              <TagPickerPopover
                countLabel={selected.size}
                trigger={
                  <Button size="sm" variant="default" className="bg-primary hover:bg-primary/90">
                    <Tag className="h-3.5 w-3.5 mr-1" /> Aplicar etiqueta personalizada
                  </Button>
                }
                onApply={async (tag) => {
                  if (selected.size > 500) {
                    if (!window.confirm(`Aplicar a etiqueta "${tag.name}" em ${selected.size.toLocaleString("pt-BR")} leads? Esta ação pode levar alguns minutos.`)) {
                      return;
                    }
                  }
                  await applyTagMutation.mutateAsync({ ids: Array.from(selected), tag });
                }}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={tagsInSelection.length === 0 || bulkRemoveTagMutation.isPending}
                    title={tagsInSelection.length === 0 ? "Nenhum lead selecionado possui etiquetas" : "Remover etiqueta dos selecionados"}
                  >
                    <Eraser className="h-3.5 w-3.5 mr-1" /> Remover etiqueta
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Buscar etiqueta..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>Nenhuma etiqueta nos selecionados.</CommandEmpty>
                      {tagsInSelection.length > 0 && (
                        <CommandGroup heading="Etiquetas presentes">
                          {tagsInSelection.map((tagName) => {
                            const color = tagColorMap.get(tagName) || "#6B7280";
                            return (
                              <CommandItem
                                key={tagName}
                                value={tagName}
                                onSelect={() => {
                                  if (selected.size > 500) {
                                    if (!window.confirm(`Remover a etiqueta "${tagName}" de ${selected.size.toLocaleString("pt-BR")} leads?`)) return;
                                  }
                                  bulkRemoveTagMutation.mutate({ ids: Array.from(selected), tagName });
                                }}
                              >
                                <span className="h-2.5 w-2.5 rounded-full mr-2" style={{ background: color }} />
                                <span className="flex-1 truncate">{tagName}</span>
                                <X className="h-3 w-3 opacity-60" />
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                      <CommandGroup>
                        <CommandItem
                          value="__all__"
                          onSelect={() => {
                            if (!window.confirm(`Remover TODAS as etiquetas dos ${selected.size.toLocaleString("pt-BR")} leads selecionados?`)) return;
                            bulkRemoveTagMutation.mutate({ ids: Array.from(selected), tagName: null });
                          }}
                        >
                          <Eraser className="h-3.5 w-3.5 mr-2" />
                          Remover todas as etiquetas
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPromoteOpen(true)}
              >
                <Send className="h-3.5 w-3.5 mr-1" /> Enviar para Captação
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport("selected", "xlsx")}>
                <Download className="h-3.5 w-3.5 mr-1" /> Exportar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
              </Button>
            </div>
          </div>
        )}




        {/* Tabela */}
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(c) => toggleAllVisible(!!c)}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>DDD</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Etiquetas</TableHead>
                {view === "franchisees" && <TableHead>Unidade</TableHead>}
                {view === "franchisees" && <TableHead>Match</TableHead>}
                <TableHead>Importado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={view === "franchisees" ? 15 : 13} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={view === "franchisees" ? 15 : 13} className="text-center py-10 text-muted-foreground">
                  {view === "franchisees" ? "Nenhum franqueado identificado ainda. Clique em \"Sincronizar Franqueados\" para cruzar com o sistema externo." : "Nenhum lead encontrado. Importe uma planilha para começar."}
                </TableCell></TableRow>
              ) : (
                paged.map((r) => (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={(c) => toggleSelected(r.id, !!c)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{r.name || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.is_valid ? formatPhoneDisplay(r.phone_normalized) : (
                        <span className="text-rose-600 dark:text-rose-400" title={r.invalid_reason || ""}>
                          {r.phone_raw || "inválido"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{r.ddd || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.city || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.state || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.region || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {(() => {
                        const o = r.origin || "imported";
                        const cfg =
                          o === "kanban"
                            ? { label: "Kanban", icon: "🎯", cls: "border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300" }
                            : o === "manual"
                            ? { label: "Manual", icon: "✍️", cls: "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300" }
                            : { label: "Importação", icon: "📥", cls: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" };
                        return (
                          <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
                            <span aria-hidden>{cfg.icon}</span> {cfg.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{r.source || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[r.status] || ""}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(r.tags || []).length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          (r.tags || []).map((tagName) => {
                            const color = tagColorMap.get(tagName) || "#6B7280";
                            return (
                              <span
                                key={tagName}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border"
                                style={{ background: `${color}15`, borderColor: `${color}50`, color }}
                              >
                                {tagName}
                                <button
                                  type="button"
                                  className="hover:opacity-70"
                                  onClick={() => removeTagMutation.mutate({ leadId: r.id, tagName })}
                                  title="Remover etiqueta"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </TableCell>
                    {view === "franchisees" && (
                      <TableCell className="text-xs">
                        {r.franchisee_unit_code || r.franchisee_unit_name ? (
                          <div className="flex flex-col">
                            <span className="font-semibold">{r.franchisee_unit_code || "—"}</span>
                            <span className="text-muted-foreground">{r.franchisee_unit_name || ""}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    {view === "franchisees" && (
                      <TableCell>
                        {(() => {
                          const m = r.franchisee_match_type;
                          const cfg = m === "phone"
                            ? { label: "Telefone", icon: "📞", cls: "border-emerald-300 bg-emerald-50 text-emerald-700" }
                            : m === "email"
                            ? { label: "E-mail", icon: "✉️", cls: "border-blue-300 bg-blue-50 text-blue-700" }
                            : m === "name_city"
                            ? { label: "Nome+Cidade", icon: "👤", cls: "border-amber-300 bg-amber-50 text-amber-700" }
                            : null;
                          return cfg ? (
                            <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
                              <span aria-hidden>{cfg.icon}</span> {cfg.label}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>;
                        })()}
                      </TableCell>
                    )}
                    <TableCell className="text-xs">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {view === "franchisees" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-amber-600"
                            onClick={() => unmarkFranchiseeMutation.mutate(r.id)}
                            disabled={unmarkFranchiseeMutation.isPending}
                            title="Desmarcar como franqueado"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetailTarget(r)} title="Ver detalhes">
                          <Search className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTarget(r)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => setDeleteTarget(r)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {filtered.length.toLocaleString("pt-BR")} resultado(s) — Página {page + 1} de {totalPages}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="page-size" className="text-xs">Por página:</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}
              >
                <SelectTrigger id="page-size" className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Label htmlFor="page-input" className="text-xs">Ir para:</Label>
              <Input
                id="page-input"
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") goToPage(); }}
                placeholder={String(page + 1)}
                className="h-8 w-16 text-center"
              />
              <span className="text-xs">/ {totalPages}</span>
              <Button size="sm" variant="outline" className="h-8" onClick={goToPage} disabled={!pageInput}>
                Ir
              </Button>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

      </CardContent>

      {/* Modal: resumo da importação */}
      <Dialog open={!!importSummary} onOpenChange={(o) => !o && setImportSummary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importação concluída</DialogTitle>
            <DialogDescription>{importSummary?.fileName}</DialogDescription>
          </DialogHeader>
          {importSummary && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <SummaryItem label="Linhas lidas" value={importSummary.total} />
              <SummaryItem label="Telefones válidos" value={importSummary.valid} variant="success" />
              <SummaryItem label="Inseridos no banco" value={importSummary.inserted} variant="success" />
              <SummaryItem label="Duplicados na planilha" value={importSummary.duplicatesInFile} variant="warning" />
              <SummaryItem label="Já existiam no banco" value={importSummary.duplicatesInDb} variant="warning" />
              <SummaryItem label="Telefones inválidos" value={importSummary.invalid} variant="danger" />
              <SummaryItem label="Sem DDD identificado" value={importSummary.noDDD} variant="warning" />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportSummary(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: adicionar lead */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar lead manualmente</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Telefone *</Label>
              <Input
                value={form.phone_raw}
                onChange={(e) => setForm({ ...form, phone_raw: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Estado (UF)</Label>
              <Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              disabled={!form.phone_raw.trim() || addLeadMutation.isPending}
              onClick={() => addLeadMutation.mutate(form)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: editar */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar lead</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome</Label>
                <Input value={editTarget.name || ""} onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Telefone</Label>
                <Input value={formatPhoneDisplay(editTarget.phone_normalized)} disabled />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input value={editTarget.city || ""} onChange={(e) => setEditTarget({ ...editTarget, city: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Input maxLength={2} value={editTarget.state || ""} onChange={(e) => setEditTarget({ ...editTarget, state: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label className="text-xs">Região</Label>
                <Input value={editTarget.region || ""} onChange={(e) => setEditTarget({ ...editTarget, region: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Origem</Label>
                <Input value={editTarget.source || ""} onChange={(e) => setEditTarget({ ...editTarget, source: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Status</Label>
                <Select value={editTarget.status} onValueChange={(v) => setEditTarget({ ...editTarget, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea rows={3} value={editTarget.notes || ""} onChange={(e) => setEditTarget({ ...editTarget, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button
              disabled={!editTarget || updateLeadMutation.isPending}
              onClick={() => editTarget && updateLeadMutation.mutate(editTarget)}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: detalhes */}
      <Dialog open={!!detailTarget} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailTarget?.name || "Lead sem nome"}</DialogTitle>
            <DialogDescription>{detailTarget && formatPhoneDisplay(detailTarget.phone_normalized)}</DialogDescription>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-2 text-sm">
              <DetailRow label="DDD" value={detailTarget.ddd} />
              <DetailRow label="Cidade" value={detailTarget.city} />
              <DetailRow label="Estado" value={detailTarget.state} />
              <DetailRow label="Região" value={detailTarget.region} />
              <DetailRow label="Origem" value={detailTarget.source} />
              <DetailRow label="Status" value={detailTarget.status} />
              <DetailRow label="Telefone bruto" value={detailTarget.phone_raw} />
              <DetailRow label="Importado em" value={new Date(detailTarget.created_at).toLocaleString("pt-BR")} />
              {!detailTarget.is_valid && (
                <DetailRow label="Motivo invalidez" value={detailTarget.invalid_reason} variant="danger" />
              )}
              {detailTarget.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="whitespace-pre-wrap">{detailTarget.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailTarget(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: pré-visualização da importação */}
      <Dialog
        open={!!previewData}
        onOpenChange={(o) => {
          if (!o && !confirmImportMutation.isPending) {
            setPreviewData(null);
            setPreviewFile(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da importação</DialogTitle>
            <DialogDescription>{previewFile?.name}</DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <SummaryItem label="Linhas lidas" value={previewData.stats.total} />
                <SummaryItem label="Telefones válidos" value={previewData.stats.valid} variant="success" />
                <SummaryItem label="Inválidos" value={previewData.stats.invalid} variant="danger" />
                <SummaryItem label="Duplicados" value={previewData.stats.duplicatesInFile} variant="warning" />
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  <strong>Coluna de telefone detectada:</strong>{" "}
                  {previewData.detectedColumns.phone ? (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {previewData.detectedColumns.phone.header
                        ? `"${previewData.detectedColumns.phone.header}"`
                        : `coluna ${previewData.detectedColumns.phone.index + 1}`}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({previewData.detectedColumns.phone.method === "header"
                          ? "via cabeçalho"
                          : previewData.detectedColumns.phone.method === "content"
                            ? "via análise de conteúdo"
                            : "coluna única"})
                      </span>
                    </span>
                  ) : (
                    <span className="text-rose-600">não detectada</span>
                  )}
                </p>
                {previewData.detectedColumns.name && (
                  <p>
                    <strong>Nome:</strong> "{previewData.detectedColumns.name.header}"
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {previewData.hasHeader
                    ? "Cabeçalho identificado na primeira linha."
                    : "Planilha sem cabeçalho — todas as linhas serão tratadas como dados."}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Prévia das primeiras linhas:</p>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone bruto</TableHead>
                        <TableHead>Normalizado</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.preview.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{p.name || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{p.phone_raw}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {p.is_valid ? formatPhoneDisplay(p.phone_normalized) : p.phone_normalized}
                          </TableCell>
                          <TableCell>
                            {p.is_valid ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">válido</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">inválido</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {importProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Importando lote {importProgress.current} de {importProgress.total}...</span>
                    <span>{Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%</span>
                  </div>
                  <Progress value={(importProgress.current / Math.max(1, importProgress.total)) * 100} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setPreviewData(null); setPreviewFile(null); }}
              disabled={confirmImportMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => previewData && previewFile && confirmImportMutation.mutate({ result: previewData, file: previewFile })}
              disabled={confirmImportMutation.isPending || !previewData?.rows.length}
            >
              {confirmImportMutation.isPending
                ? "Importando..."
                : `Confirmar e importar ${previewData?.rows.length.toLocaleString("pt-BR") || 0} leads`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm: excluir individual */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o lead {deleteTarget?.name || deleteTarget?.phone_normalized}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteLeadMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: bulk delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir leads selecionados</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente {selected.size} leads. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
            >
              Excluir {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote para Captação */}
      <PromoteToPipelineDialog
        open={promoteOpen}
        count={Array.from(selected).filter((id) => rows.find((r) => r.id === id)?.is_valid).length}
        onClose={() => setPromoteOpen(false)}
        onConfirm={async (extraTag) => {
          await promoteMutation.mutateAsync(extraTag);
        }}
      />

      {/* Histórico de importações */}
      <ImportHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectBatch={(b) => {
          setFilterBatchId(b.id);
          setPage(0);
          setHistoryOpen(false);
          toast.success(`Filtrando leads do lote: ${b.file_name}`);
        }}
      />

      {/* Histórico de exportações */}
      <ExportHistorySheet
        open={exportHistoryOpen}
        onClose={() => setExportHistoryOpen(false)}
        onSelectBatch={(b) => {
          setFilterExportBatchId(b.id);
          setFilterBatchId(null);
          setPage(0);
          setExportHistoryOpen(false);
          toast.success(`Exibindo ${b.total_rows} leads do export: ${b.file_name}`);
        }}
        onRedownload={(b) => redownloadExportBatch(b)}
      />
    </Card>
  );
}

function SummaryItem({ label, value, variant }: { label: string; value: number; variant?: "success" | "warning" | "danger" }) {
  const styles =
    variant === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300" :
    variant === "warning" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300" :
    variant === "danger" ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300" :
    "bg-muted/40 border";
  return (
    <div className={`rounded-lg border p-2.5 ${styles}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-lg font-bold">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function DetailRow({ label, value, variant }: { label: string; value: string | null | undefined; variant?: "danger" }) {
  return (
    <div className="flex justify-between gap-2 border-b border-dashed py-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-sm font-medium ${variant === "danger" ? "text-rose-600" : ""}`}>{value || "—"}</span>
    </div>
  );
}
