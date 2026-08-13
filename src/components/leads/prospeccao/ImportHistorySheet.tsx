import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Search, ChevronRight, Filter, FileSpreadsheet } from "lucide-react";
import { useLeadImportBatches, type LeadImportBatch } from "@/hooks/use-lead-import-batches";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectBatch: (batch: LeadImportBatch) => void;
}

export function ImportHistorySheet({ open, onClose, onSelectBatch }: Props) {
  const { data: batches = [], isLoading } = useLeadImportBatches();
  const [search, setSearch] = useState("");

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
            <History className="h-5 w-5" /> Histórico de importações
          </SheetTitle>
          <SheetDescription>
            Selecione um lote para abrir os leads e aplicar etiquetas ou enviar para Captação.
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
                Nenhuma importação encontrada.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectBatch(b)}
                    className="w-full text-left rounded-xl border bg-card hover:bg-muted/50 transition p-3 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate flex items-center gap-1.5">
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
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
                      <Badge variant="outline" className="text-[10px]">
                        {b.total_rows.toLocaleString("pt-BR")} linhas
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300">
                        {b.valid_rows.toLocaleString("pt-BR")} válidos
                      </Badge>
                      {b.invalid_rows > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300">
                          {b.invalid_rows} inválidos
                        </Badge>
                      )}
                      {b.duplicate_rows > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300">
                          {b.duplicate_rows} duplicados
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-primary inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <Filter className="h-3 w-3" /> Filtrar leads deste lote
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
