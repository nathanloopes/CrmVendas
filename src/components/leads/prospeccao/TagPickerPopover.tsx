import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useLeadDatabaseTags,
  useCreateLeadDatabaseTag,
  TAG_PALETTE,
  type LeadDatabaseTag,
} from "@/hooks/use-lead-database-tags";

interface Props {
  trigger?: React.ReactNode;
  countLabel: number;
  onApply: (tag: LeadDatabaseTag) => Promise<void> | void;
  disabled?: boolean;
}

export function TagPickerPopover({ trigger, countLabel, onApply, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [color, setColor] = useState(TAG_PALETTE[0]);
  const [applying, setApplying] = useState(false);

  const { data: tags = [], isLoading } = useLeadDatabaseTags();
  const createTag = useCreateLeadDatabaseTag();

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));
  const exactMatch = tags.find((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  async function handlePick(tag: LeadDatabaseTag) {
    try {
      setApplying(true);
      await onApply(tag);
      setOpen(false);
      setSearch("");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aplicar etiqueta");
    } finally {
      setApplying(false);
    }
  }

  async function handleCreateAndApply() {
    if (!search.trim()) return;
    try {
      setApplying(true);
      const created = await createTag.mutateAsync({ name: search.trim(), color });
      await onApply(created);
      setOpen(false);
      setSearch("");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar etiqueta");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" disabled={disabled}>
            <Tag className="h-3.5 w-3.5 mr-1" /> Aplicar etiqueta
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3">
        <div>
          <Label className="text-xs">Buscar ou criar etiqueta</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex: Hot lead, Prioridade A…"
            className="h-8 mt-1"
            autoFocus
          />
        </div>

        <div className="max-h-44 overflow-y-auto -mx-1">
          {isLoading ? (
            <div className="text-xs text-muted-foreground px-1 py-2">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground px-1 py-2">Nenhuma etiqueta encontrada.</div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={applying}
                onClick={() => handlePick(t)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm text-left"
              >
                <span
                  className="h-3 w-3 rounded-full border"
                  style={{ background: t.color }}
                />
                <span className="flex-1 truncate">{t.name}</span>
              </button>
            ))
          )}
        </div>

        {search.trim() && !exactMatch && (
          <div className="border-t pt-2 space-y-2">
            <p className="text-[11px] text-muted-foreground">Criar nova etiqueta:</p>
            <div className="flex flex-wrap gap-1.5">
              {TAG_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-5 w-5 rounded-full border-2 transition ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={applying}
              onClick={handleCreateAndApply}
            >
              {applying ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1" />
              )}
              Criar “{search.trim()}” e aplicar a {countLabel}
            </Button>
          </div>
        )}

        {exactMatch && (
          <Button
            size="sm"
            className="w-full"
            disabled={applying}
            onClick={() => handlePick(exactMatch)}
          >
            {applying ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-1" />
            )}
            Aplicar a {countLabel}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
