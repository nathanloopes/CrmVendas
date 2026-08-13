import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, LayoutGrid, Rows3, Columns3, Maximize2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import type { KanbanDensity, KanbanColumnWidth } from "@/hooks/use-kanban-layout-prefs";

type Board = Tables<"kanban_boards">;

interface KanbanToolbarProps {
  boards: Board[];
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  onAddLead: () => void;
  density?: KanbanDensity;
  columnWidth?: KanbanColumnWidth;
  onDensityChange?: (density: KanbanDensity) => void;
  onColumnWidthChange?: (width: KanbanColumnWidth) => void;
}

export function KanbanToolbar({
  boards,
  selectedBoardId,
  onSelectBoard,
  onAddLead,
  density = "comfortable",
  columnWidth = "default",
  onDensityChange,
  onColumnWidthChange,
}: KanbanToolbarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const TEMPLATE_BOARD_ID = "11111111-1111-1111-1111-111111111111";

  const createMutation = useMutation({
    mutationFn: async () => {
      // Buscar configuração do board template (Brasil) para herdar etapas, cores, descrições e macros
      let stageOrder: string[] | null = null;
      let customLabels: Record<string, any> | null = null;

      const { data: template } = await supabase
        .from("kanban_boards")
        .select("stage_order, custom_labels")
        .eq("id", TEMPLATE_BOARD_ID)
        .maybeSingle();

      if (template) {
        stageOrder = (template.stage_order as string[]) ?? null;
        const labels = (template.custom_labels as Record<string, any>) ?? {};
        // Reseta notificações para o novo board configurar do zero
        customLabels = { ...labels, __stage_notifications__: {} };
      } else {
        toast.warning(
          "Configuração padrão indisponível — kanban criado vazio. Configure as etapas em Configurações.",
        );
      }

      const { data, error } = await supabase
        .from("kanban_boards")
        .insert({
          name: newName,
          description: newDesc || null,
          created_by: user!.id,
          is_global: true,
          sort_order: boards.length,
          ...(stageOrder ? { stage_order: stageOrder } : {}),
          ...(customLabels ? { custom_labels: customLabels as any } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-boards"] });
      toast.success("Kanban criado com sucesso");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      onSelectBoard(data.id);
    },
    onError: () => toast.error("Erro ao criar kanban"),
  });

  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <LayoutGrid className="h-5 w-5 text-muted-foreground shrink-0" />
          {boards.map((board) => (
            <Button
              key={board.id}
              variant={selectedBoardId === board.id ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectBoard(board.id)}
            >
              {board.name}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Kanban
          </Button>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {onDensityChange && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    value={density}
                    onValueChange={(v) => v && onDensityChange(v as KanbanDensity)}
                    className="border rounded-md"
                  >
                    <ToggleGroupItem value="compact" className="h-8 px-2">
                      <Rows3 className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="comfortable" className="h-8 px-2">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </TooltipTrigger>
                <TooltipContent>Densidade dos cards</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onColumnWidthChange && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    value={columnWidth}
                    onValueChange={(v) => v && onColumnWidthChange(v as KanbanColumnWidth)}
                    className="border rounded-md"
                  >
                    <ToggleGroupItem value="narrow" className="h-8 px-2 text-[11px]">S</ToggleGroupItem>
                    <ToggleGroupItem value="default" className="h-8 px-2 text-[11px]">M</ToggleGroupItem>
                    <ToggleGroupItem value="wide" className="h-8 px-2 text-[11px]">L</ToggleGroupItem>
                  </ToggleGroup>
                </TooltipTrigger>
                <TooltipContent>Largura das colunas</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live
          </span>
          <Button onClick={onAddLead} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Novo Lead
          </Button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Kanban</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: México, EUA..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
