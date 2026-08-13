import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Columns, Trash2, Plus, Save, GripVertical, Pencil, Check, Bell } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScrollArea } from "@/components/ui/scroll-area";
import MacroStagesEditor from "@/components/settings/MacroStagesEditor";
import { type MacroStage, getDefaultMacroStages } from "@/lib/macro-stages";

const STAGE_COLORS = [
  { name: "Cinza", hex: "#6b7280" },
  { name: "Azul", hex: "#3b82f6" },
  { name: "Roxo", hex: "#a855f7" },
  { name: "Âmbar", hex: "#f59e0b" },
  { name: "Verde", hex: "#10b981" },
  { name: "Verde escuro", hex: "#15803d" },
  { name: "Vermelho", hex: "#ef4444" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Índigo", hex: "#6366f1" },
  { name: "Ciano", hex: "#06b6d4" },
  { name: "Laranja", hex: "#f97316" },
  { name: "Lima", hex: "#84cc16" },
];

interface SystemUser {
  id: string;
  name: string;
  email: string;
}

interface SortableStageItemProps {
  stageKey: string;
  isEditing: boolean;
  editValue: string;
  color: string;
  description: string;
  notificationUserIds: string[];
  allUsers: SystemUser[];
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onEditChange: (val: string) => void;
  onColorChange: (color: string) => void;
  onDescriptionChange: (desc: string) => void;
  onNotificationUsersChange: (userIds: string[]) => void;
  onRemove: () => void;
}

function SortableStageItem({
  stageKey,
  isEditing,
  editValue,
  color,
  description,
  notificationUserIds,
  allUsers,
  onStartEdit,
  onConfirmEdit,
  onEditChange,
  onColorChange,
  onDescriptionChange,
  onNotificationUsersChange,
  onRemove,
}: SortableStageItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stageKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const toggleUser = (userId: string) => {
    if (notificationUserIds.includes(userId)) {
      onNotificationUsersChange(notificationUserIds.filter((id) => id !== userId));
    } else {
      onNotificationUsersChange([...notificationUserIds, userId]);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex flex-wrap items-center gap-2 rounded-md border p-2 bg-background"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {isEditing ? (
        <div className="flex items-center gap-1 min-w-[140px]">
          <Input
            className="h-7 text-sm font-mono"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirmEdit();
              }
            }}
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onConfirmEdit}>
            <Check className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="flex-1 text-sm text-left flex items-center gap-1 hover:text-foreground"
          onClick={onStartEdit}
        >
          {stageKey}
          <Pencil className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      <Popover>
        <PopoverTrigger asChild>
           <button
            type="button"
            className="shrink-0 h-6 w-6 rounded-full border border-border"
            style={{ backgroundColor: color.startsWith('#') ? color : "#6b7280" }}
            title="Cor do status"
           />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="right" align="start">
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {STAGE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c.hex ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  onClick={() => onColorChange(c.hex)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1 border-t">
              <input
                type="color"
                value={color.startsWith('#') ? color : "#6b7280"}
                onChange={(e) => onColorChange(e.target.value)}
                className="h-7 w-7 rounded cursor-pointer border-0 p-0"
              />
              <span className="text-xs text-muted-foreground">Cor personalizada</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Notification users popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`shrink-0 h-7 w-7 rounded-md border flex items-center justify-center transition-colors ${
              notificationUserIds.length > 0
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Notificar ao entrar nesta etapa"
          >
            <Bell className="h-3.5 w-3.5" />
            {notificationUserIds.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {notificationUserIds.length}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" side="right" align="start">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium">Notificar ao entrar nesta etapa</p>
            <p className="text-[10px] text-muted-foreground">Selecione os usuários que receberão notificação</p>
          </div>
          <ScrollArea className="max-h-48">
            <div className="p-2 space-y-1">
              {allUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum usuário</p>
              ) : (
                allUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={notificationUserIds.includes(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                    />
                    <span className="truncate">{u.name}</span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <Input
        className="h-7 text-xs ml-6 flex-1"
        placeholder="Descrição do status (opcional)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />
    </div>
  );
}

export default function KanbanBoardEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [boardName, setBoardName] = useState("");
  const [stages, setStages] = useState<string[]>([]);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [stageColors, setStageColors] = useState<Record<string, string>>({});
  const [stageDescriptions, setStageDescriptions] = useState<Record<string, string>>({});
  const [stageNotifications, setStageNotifications] = useState<Record<string, string[]>>({});
  const [newStageKey, setNewStageKey] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyValue, setEditKeyValue] = useState("");
  const [renamedKeys, setRenamedKeys] = useState<Record<string, string>>({});
  const [macroStages, setMacroStages] = useState<MacroStage[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: boards, isLoading } = useQuery({
    queryKey: ["kanban-boards-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_boards")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: systemUsers = [] } = useQuery({
    queryKey: ["system-users-for-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data || []) as SystemUser[];
    },
  });

  const selectedBoard = boards?.find((b) => b.id === selectedBoardId);

  useEffect(() => {
    if (selectedBoard) {
      setBoardName(selectedBoard.name);
      setStages(selectedBoard.stage_order ?? []);
      const labels = (selectedBoard.custom_labels as Record<string, any>) ?? {};
      const {
        __stage_colors__: colors,
        __stage_descriptions__: descriptions,
        __stage_notifications__: notifications,
        __macro_stages__: macros,
        ...rest
      } = labels;
      setCustomLabels(rest as Record<string, string>);
      setStageColors((colors as Record<string, string>) ?? {});
      setStageDescriptions((descriptions as Record<string, string>) ?? {});
      setStageNotifications((notifications as Record<string, string[]>) ?? {});
      const existingMacros = Array.isArray(macros) ? (macros as MacroStage[]) : [];
      setMacroStages(
        existingMacros.length > 0
          ? existingMacros
          : getDefaultMacroStages(selectedBoard.stage_order ?? []),
      );
      setEditingKey(null);
    }
  }, [selectedBoard]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) throw new Error("Selecione um board");

      for (const [oldKey, newKey] of Object.entries(renamedKeys)) {
        const { error: leadErr } = await supabase
          .from("leads")
          .update({ stage: newKey })
          .eq("board_id", selectedBoardId)
          .eq("stage", oldKey);
        if (leadErr) throw leadErr;
      }

      const { error } = await supabase
        .from("kanban_boards")
        .update({
          name: boardName.trim(),
          stage_order: stages,
          custom_labels: {
            ...customLabels,
            __stage_colors__: stageColors,
            __stage_descriptions__: stageDescriptions,
            __stage_notifications__: stageNotifications,
            __macro_stages__: macroStages as any,
          } as any,
        })
        .eq("id", selectedBoardId);
      if (error) throw error;
    },
    onSuccess: () => {
      setRenamedKeys({});
      toast({ title: "Salvo", description: "Board atualizado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["kanban-boards-settings"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-boards"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-boards-full"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) throw new Error("Selecione um board");
      const { error } = await supabase
        .from("kanban_boards")
        .delete()
        .eq("id", selectedBoardId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedBoardId("");
      toast({ title: "Excluído", description: "Board removido com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["kanban-boards-settings"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-boards"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-boards-full"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = stages.indexOf(active.id as string);
      const newIndex = stages.indexOf(over.id as string);
      setStages(arrayMove(stages, oldIndex, newIndex));
    }
  };

  const removeStage = (index: number) => {
    const key = stages[index];
    setStages(stages.filter((_, i) => i !== index));
    const newLabels = { ...customLabels };
    delete newLabels[key];
    setCustomLabels(newLabels);
    setStageColors(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    setStageDescriptions(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    setStageNotifications(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    setMacroStages(prev =>
      prev.map(m => ({ ...m, stages: m.stages.filter(s => s !== key) })),
    );
  };

  const addStage = () => {
    const key = newStageKey.trim();
    if (!key) return;
    if (stages.includes(key)) {
      toast({ title: "Erro", description: "Status já existe.", variant: "destructive" });
      return;
    }
    setStages([...stages, key]);
    setNewStageKey("");
  };

  const startEditKey = (key: string) => {
    setEditingKey(key);
    setEditKeyValue(key);
  };

  const confirmEditKey = () => {
    if (!editingKey) return;
    const newKey = editKeyValue.trim();
    if (!newKey) {
      toast({ title: "Erro", description: "Nome do status não pode ser vazio.", variant: "destructive" });
      return;
    }
    if (newKey !== editingKey && stages.includes(newKey)) {
      toast({ title: "Erro", description: "Já existe um status com esse nome.", variant: "destructive" });
      return;
    }
    if (newKey !== editingKey) {
      setStages(stages.map((s) => (s === editingKey ? newKey : s)));
      const newLabels = { ...customLabels };
      if (editingKey in newLabels) {
        newLabels[newKey] = newLabels[editingKey];
        delete newLabels[editingKey];
      }
      setCustomLabels(newLabels);
      setStageColors(prev => {
        const updated = { ...prev };
        if (editingKey in updated) {
          updated[newKey] = updated[editingKey];
          delete updated[editingKey];
        }
        return updated;
      });
      setStageDescriptions(prev => {
        const updated = { ...prev };
        if (editingKey in updated) {
          updated[newKey] = updated[editingKey];
          delete updated[editingKey];
        }
        return updated;
      });
      setStageNotifications(prev => {
        const updated = { ...prev };
        if (editingKey in updated) {
          updated[newKey] = updated[editingKey];
          delete updated[editingKey];
        }
        return updated;
      });
      setMacroStages(prev =>
        prev.map(m => ({
          ...m,
          stages: m.stages.map(s => (s === editingKey ? newKey : s)),
        })),
      );
      setRenamedKeys(prev => ({ ...prev, [editingKey]: newKey }));
    }
    setEditingKey(null);
  };

  const updateLabel = (key: string, label: string) => {
    setCustomLabels({ ...customLabels, [key]: label });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Columns className="h-5 w-5" />
          Editar Kanban
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Board</Label>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um board" />
              </SelectTrigger>
              <SelectContent>
                {boards?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedBoardId && (
          <>
            <div>
              <Label>Nome do board</Label>
              <Input value={boardName} onChange={(e) => setBoardName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Status (arraste para reordenar)</Label>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={stages} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {stages.map((stage, i) => (
                      <SortableStageItem
                        key={stage}
                        stageKey={stage}
                        isEditing={editingKey === stage}
                        editValue={editKeyValue}
                        color={stageColors[stage] || "bg-muted-foreground"}
                        description={stageDescriptions[stage] || ""}
                        notificationUserIds={stageNotifications[stage] || []}
                        allUsers={systemUsers}
                        onStartEdit={() => startEditKey(stage)}
                        onConfirmEdit={confirmEditKey}
                        onEditChange={setEditKeyValue}
                        onColorChange={(c) => setStageColors(prev => ({ ...prev, [stage]: c }))}
                        onDescriptionChange={(d) => setStageDescriptions(prev => ({ ...prev, [stage]: d }))}
                        onNotificationUsersChange={(ids) => setStageNotifications(prev => ({ ...prev, [stage]: ids }))}
                        onRemove={() => removeStage(i)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Novo status (ex: proposta)"
                value={newStageKey}
                onChange={(e) => setNewStageKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStage())}
              />
              <Button variant="outline" onClick={addStage}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <MacroStagesEditor
              stages={stages}
              customLabels={customLabels}
              macros={macroStages}
              onChange={setMacroStages}
            />

            <div className="flex items-center gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                Salvar alterações
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleteMutation.isPending}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir board
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir board</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o board "{boardName}"? Esta ação é irreversível.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate()}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
