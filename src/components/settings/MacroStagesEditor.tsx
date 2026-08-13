import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, RotateCcw, Layers, AlertTriangle, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type MacroStage,
  getDefaultMacroStages,
  getUnassignedStages,
  reconcileMacroStages,
} from "@/lib/macro-stages";
import { getStageLabel } from "@/lib/stage-labels";
import { normalizeStage } from "@/lib/stage-utils";

interface MacroStagesEditorProps {
  stages: string[]; // current board stages
  customLabels: Record<string, string>;
  macros: MacroStage[];
  onChange: (next: MacroStage[]) => void;
}

function genId() {
  return Math.random().toString(36).slice(2, 8);
}

interface SortableMacroProps {
  macro: MacroStage;
  customLabels: Record<string, string>;
  allStages: string[];
  usedStagesElsewhere: Set<string>;
  onUpdate: (patch: Partial<MacroStage>) => void;
  onRemove: () => void;
  onRemoveStage: (index: number) => void;
  onAddStage: (stage: string) => void;
}

function SortableMacro({
  macro,
  customLabels,
  allStages,
  usedStagesElsewhere,
  onUpdate,
  onRemove,
  onRemoveStage,
  onAddStage,
}: SortableMacroProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: macro.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const availableToAdd = allStages.filter(
    (s) =>
      !macro.stages.some((ms) => normalizeStage(ms) === normalizeStage(s)) &&
      !usedStagesElsewhere.has(normalizeStage(s)),
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-background p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          value={macro.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-8 text-sm font-medium flex-1"
          placeholder="Nome da macro-etapa"
        />
        <Select
          value={macro.type}
          onValueChange={(v: "primary" | "secondary") => onUpdate({ type: v })}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary" className="text-xs">Principal</SelectItem>
            <SelectItem value="secondary" className="text-xs">Secundário</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 pl-6 min-h-[28px]">
        {macro.stages.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">Nenhum status atribuído</span>
        ) : (
          macro.stages.map((s, idx) => (
            <span
              key={`${s}-${idx}`}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
            >
              {getStageLabel(s, customLabels)}
              <button
                type="button"
                onClick={() => onRemoveStage(idx)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remover ${s}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {availableToAdd.length > 0 && (
        <div className="pl-6">
          <Select value="" onValueChange={(v) => v && onAddStage(v)}>
            <SelectTrigger className="h-7 w-auto min-w-[180px] text-xs">
              <SelectValue placeholder="+ Adicionar status…" />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {getStageLabel(s, customLabels)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export default function MacroStagesEditor({
  stages,
  customLabels,
  macros,
  onChange,
}: MacroStagesEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Auto-reconcile: drop stages removed from the board, normalize renames, dedupe.
  useEffect(() => {
    if (!stages.length || !macros.length) return;
    const { macros: reconciled, changed } = reconcileMacroStages(macros, stages);
    if (changed) onChange(reconciled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages]);

  const primary = macros.filter((m) => m.type === "primary");
  const secondary = macros.filter((m) => m.type === "secondary");

  const unassigned = useMemo(() => getUnassignedStages(stages, macros), [stages, macros]);

  const updateMacro = (id: string, patch: Partial<MacroStage>) => {
    onChange(macros.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMacro = (id: string) => {
    onChange(macros.filter((m) => m.id !== id));
  };

  const removeStageFromMacro = (id: string, index: number) => {
    onChange(
      macros.map((m) =>
        m.id === id
          ? { ...m, stages: m.stages.filter((_, i) => i !== index) }
          : m,
      ),
    );
  };

  const addStageToMacro = (id: string, stage: string) => {
    // Remove from any other macro first (a status belongs to at most 1)
    const cleaned = macros.map((m) => ({
      ...m,
      stages: m.stages.filter((s) => normalizeStage(s) !== normalizeStage(stage)),
    }));
    onChange(
      cleaned.map((m) => (m.id === id ? { ...m, stages: [...m.stages, stage] } : m)),
    );
  };

  const addNewMacro = (type: "primary" | "secondary") => {
    onChange([
      ...macros,
      {
        id: genId(),
        name: type === "primary" ? "Nova macro-etapa" : "Novo grupo secundário",
        type,
        stages: [],
      },
    ]);
  };

  const restoreDefault = () => {
    onChange(getDefaultMacroStages(stages));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = macros.findIndex((m) => m.id === active.id);
    const newIndex = macros.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(macros, oldIndex, newIndex));
  };

  const usedElsewhere = (currentId: string) => {
    const set = new Set<string>();
    for (const m of macros) {
      if (m.id === currentId) continue;
      for (const s of m.stages) set.add(normalizeStage(s));
    }
    return set;
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3 bg-muted/20">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">
            Macro-Etapas (agrupamento p/ Dashboard)
          </Label>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={restoreDefault}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Restaurar padrão
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Agrupe os status do Kanban em macro-etapas. Usado apenas no Dashboard
        (Pipeline ao Vivo, Funil e Análise de Conversão). Não afeta o Kanban operacional.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={macros.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {/* Primary group */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Funil Principal
            </p>
            {primary.length === 0 && (
              <p className="text-xs italic text-muted-foreground">Nenhuma macro-etapa principal</p>
            )}
            {primary.map((m) => (
              <SortableMacro
                key={m.id}
                macro={m}
                customLabels={customLabels}
                allStages={stages}
                usedStagesElsewhere={usedElsewhere(m.id)}
                onUpdate={(p) => updateMacro(m.id, p)}
                onRemove={() => removeMacro(m.id)}
                onRemoveStage={(s) => removeStageFromMacro(m.id, s)}
                onAddStage={(s) => addStageToMacro(m.id, s)}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => addNewMacro("primary")}
            >
              <Plus className="h-3 w-3 mr-1" />
              Nova macro-etapa principal
            </Button>
          </div>

          {/* Secondary group */}
          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Funil Secundário
            </p>
            {secondary.length === 0 && (
              <p className="text-xs italic text-muted-foreground">Nenhuma macro-etapa secundária</p>
            )}
            {secondary.map((m) => (
              <SortableMacro
                key={m.id}
                macro={m}
                customLabels={customLabels}
                allStages={stages}
                usedStagesElsewhere={usedElsewhere(m.id)}
                onUpdate={(p) => updateMacro(m.id, p)}
                onRemove={() => removeMacro(m.id)}
                onRemoveStage={(s) => removeStageFromMacro(m.id, s)}
                onAddStage={(s) => addStageToMacro(m.id, s)}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => addNewMacro("secondary")}
            >
              <Plus className="h-3 w-3 mr-1" />
              Nova macro-etapa secundária
            </Button>
          </div>
        </SortableContext>
      </DndContext>

      {unassigned.length > 0 && (
        <div className="rounded-md bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/30 p-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-foreground">Status sem grupo:</p>
            <p className="text-muted-foreground">
              {unassigned.map((s) => getStageLabel(s, customLabels)).join(", ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
