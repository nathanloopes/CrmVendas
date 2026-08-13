import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Search, ChevronRight, Filter, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import {
  useLeadExportBatches,
  useDeleteLeadExport,
  type LeadExportBatch,
} from "@/hooks/use-lead-export-batches";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectBatch: (batch: LeadExportBatch) => void;
  onRedownload?: (batch: LeadExportBatch) => void;
}

const SCOPE_LABEL: Record<LeadExportBatch["scope"], string> = {
  all: "Todos",
  filtered: "Filtrados",
  selected: "Selecionados",
  batch: "Lote",
};

export function ExportHistorySheet({ open, onClose, onSelectBatch, onRedownload }: Props) {
  const { user } = useAuth();
  const { data: batches = [], isLoading } = useLeadExportBatches();
  const deleteExport = useDeleteLeadExport();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LeadExportBatch | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(
      (b) =>
        (b.file_name || "").toLowerCase().includes(q) ||
        (b.creator_name || "").toLowerCase().includes(q)
    );
  }, [batches, search]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Histórico de exportações
          </SheetTitle>
          <SheetDescription>
            Selecione um lote exportado para abrir exatamente aqueles leads na tabela e aplicar etiquetas, enviar para Captação ou re-exportar.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por arquivo ou usuário…"
              className="pl-8 h-9"
            />
          </div>

          <ScrollArea className="h-[calc(100vh-220px)] -mx-6 px-6">
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center">
                Nenhuma exportação encontrada.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((b) => {
                  const isOwner = b.created_by === user?.id;
                  const Icon = b.format === "xlsx" ? FileSpreadsheet : FileText;
                  return (
                    <div
                      key={b.id}
                      className="rounded-xl border bg-card hover:bg-muted/50 transition p-3 group"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectBatch(b)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate flex items-center gap-1.5">
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              {b.file_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(b.created_at).toLocaleString("pt-BR")}
                              {b.creator_name && <> · por {b.creator_name}</>}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {b.format}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {SCOPE_LABEL[b.scope]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300">
                            {b.total_rows.toLocaleString("pt-BR")} leads
                          </Badge>
                        </div>
                        <p className="mt-2 text-[11px] text-primary inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <Filter className="h-3 w-3" /> Filtrar leads deste export
                        </p>
                      </button>

                      <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-dashed">
                        {onRedownload && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRedownload(b);
                            }}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" /> Baixar novamente
                          </Button>
                        )}
                        {isOwner && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(b);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro de exportação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove apenas o registro do histórico. Os leads exportados não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteExport.mutateAsync(deleteTarget.id);
                  toast.success("Registro removido");
                } catch (e: any) {
                  toast.error(e?.message || "Erro ao remover");
                } finally {
                  setDeleteTarget(null);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
