import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterField } from "@/components/ui/filter-field";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { getStageLabel } from "@/lib/stage-labels";

interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  stage: string | null;
  source: string | null;
  created_at: string;
  lost_reason?: string | null;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
}

interface KpiDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  leads?: Lead[];
  tasks?: Task[];
  mode: "leads" | "tasks";
  onLeadClick?: (leadId: string) => void;
  customLabels?: Record<string, string>;
}

export function KpiDrilldownDialog({ open, onOpenChange, title, leads = [], tasks = [], mode, onLeadClick, customLabels }: KpiDrilldownDialogProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [lostReasonFilter, setLostReasonFilter] = useState("all");

  const hasLostLeads = useMemo(() => leads.some((l) => l.lost_reason), [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchesSearch =
        !search ||
        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.city || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.lost_reason || "").toLowerCase().includes(search.toLowerCase());
      const matchesStage = stageFilter === "all" || l.stage === stageFilter;
      const matchesReason =
        lostReasonFilter === "all" ||
        (lostReasonFilter === "__none__" ? !l.lost_reason : l.lost_reason === lostReasonFilter);
      return matchesSearch && matchesStage && matchesReason;
    });
  }, [leads, search, stageFilter, lostReasonFilter]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()));
  }, [tasks, search]);

  const stages = useMemo(() => [...new Set(leads.map((l) => l.stage).filter(Boolean))], [leads]);
  const lostReasons = useMemo(
    () => [...new Set(leads.map((l) => l.lost_reason).filter(Boolean))] as string[],
    [leads]
  );

  const exportExcel = () => {
    if (mode === "leads") {
      const data = filteredLeads.map((l) => ({
        Nome: l.name || "",
        Telefone: l.phone || "",
        Email: l.email || "",
        Cidade: l.city || "",
        Estado: l.state || "",
        Estágio: getStageLabel(l.stage || "", customLabels),
        "Motivo da Desqualificação": l.lost_reason || "",
        Fonte: l.source || "",
        "Data de Criação": format(new Date(l.created_at), "dd/MM/yyyy", { locale: ptBR }),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `leads_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    } else {
      const data = filteredTasks.map((t) => ({
        Título: t.title,
        Status: t.status,
        Prioridade: t.priority === "high" ? "Alta" : t.priority === "medium" ? "Média" : "Baixa",
        Prazo: t.due_date ? format(new Date(t.due_date), "dd/MM/yyyy", { locale: ptBR }) : "Sem prazo",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tarefas");
      XLSX.writeFile(wb, `tarefas_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none mb-1 block">
              Buscar
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {mode === "leads" && (
            <FilterField label="Estágio">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos os estágios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estágios</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s!} value={s!}>
                      {getStageLabel(s!, customLabels)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          )}
          {mode === "leads" && hasLostLeads && (
            <FilterField label="Motivo da desqualificação">
              <Select value={lostReasonFilter} onValueChange={setLostReasonFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos os motivos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os motivos</SelectItem>
                  <SelectItem value="__none__">Sem motivo informado</SelectItem>
                  {lostReasons.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          )}
          <Button onClick={exportExcel} variant="outline" size="sm" className="self-end mb-0.5">
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>

        <div className="overflow-auto flex-1 mt-2">
          {mode === "leads" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Estágio</TableHead>
                  {hasLostLeads && <TableHead>Motivo da Desqualificação</TableHead>}
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={hasLostLeads ? 7 : 6} className="text-center text-muted-foreground py-8">
                      Nenhum lead encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((l) => (
                    <TableRow key={l.id} className={onLeadClick ? "cursor-pointer hover:bg-muted/60 transition-colors" : ""} onClick={() => onLeadClick?.(l.id)}>
                      <TableCell className="font-medium">{l.name || "—"}</TableCell>
                      <TableCell>{l.phone || "—"}</TableCell>
                      <TableCell>{l.email || "—"}</TableCell>
                      <TableCell>{l.city || "—"}</TableCell>
                      <TableCell>{getStageLabel(l.stage || "", customLabels)}</TableCell>
                      {hasLostLeads && (
                        <TableCell className="max-w-[260px]">
                          {l.lost_reason ? (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium truncate" title={l.lost_reason}>
                              {l.lost_reason}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>{format(new Date(l.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhuma tarefa encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            t.priority === "high"
                              ? "bg-destructive/10 text-destructive"
                              : t.priority === "medium"
                              ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.priority === "high" ? "Alta" : t.priority === "medium" ? "Média" : "Baixa"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {t.due_date ? format(new Date(t.due_date), "dd/MM/yyyy", { locale: ptBR }) : "Sem prazo"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          {mode === "leads" ? `${filteredLeads.length} lead(s)` : `${filteredTasks.length} tarefa(s)`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
