import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, X, Filter, Users, Flame, Clock, Calendar, Tag, Layers, Star, Bookmark, Save, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterField } from "@/components/ui/filter-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSavedLeadFilters } from "@/hooks/use-saved-lead-filters";
import { resolveStageColor } from "@/lib/stage-colors";

export interface LeadFilterValues {
  search: string;
  city: string;
  source: string;
  assignedTo: string;
  minScore: string;
  inactiveDays: string;
  /** multi-select stages */
  stages: string[];
  /** multi-select tags */
  tags: string[];
  /** "7" | "30" | "90" | "" */
  createdWithin: string;
  /** has a meeting today */
  meetingToday: boolean;
}

export const EMPTY_FILTERS: LeadFilterValues = {
  search: "", city: "", source: "", assignedTo: "", minScore: "", inactiveDays: "",
  stages: [], tags: [], createdWithin: "", meetingToday: false,
};

interface LeadFiltersProps {
  filters: LeadFilterValues;
  onFiltersChange: (filters: LeadFilterValues) => void;
  currentUserId?: string;
  /** stages of the active board (for multi-select) */
  boardStages?: string[];
  /** stage label/colors map */
  customLabels?: Record<string, any>;
  /** count after filters applied */
  filteredCount?: number;
  /** total count before filters */
  totalCount?: number;
}

interface MultiComboProps {
  values: string[];
  options: { value: string; label: string; color?: string }[];
  placeholder: string;
  onChange: (values: string[]) => void;
  width?: string;
  emptyText?: string;
  icon?: React.ReactNode;
}

function MultiCombo({ values, options, placeholder, onChange, width = "w-44", emptyText = "Nada encontrado", icon }: MultiComboProps) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };
  const summary = values.length === 0
    ? placeholder
    : values.length === 1
    ? options.find((o) => o.value === values[0])?.label || values[0]
    : `${values.length} selecionados`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`${width} h-9 justify-between font-normal`}>
          <span className="flex items-center gap-1.5 truncate">
            {icon}
            <span className="truncate">{summary}</span>
          </span>
          {values.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{values.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const checked = values.includes(o.value);
                return (
                  <CommandItem key={o.value} onSelect={() => toggle(o.value)} className="cursor-pointer">
                    <span className={`h-3.5 w-3.5 rounded-sm border mr-2 flex items-center justify-center ${checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                      {checked && <span className="text-[10px] leading-none">✓</span>}
                    </span>
                    {o.color && <span className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: o.color }} />}
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface SingleComboProps {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string) => void;
  width?: string;
  icon?: React.ReactNode;
}

function SingleCombo({ value, options, placeholder, onChange, width = "w-40", icon }: SingleComboProps) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`${width} h-9 justify-between font-normal`}>
          <span className="flex items-center gap-1.5 truncate">
            {icon}
            <span className="truncate">{current?.label || placeholder}</span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nada encontrado</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => { onChange(""); setOpen(false); }} className="cursor-pointer text-muted-foreground">
                {placeholder}
              </CommandItem>
              {options.map((o) => (
                <CommandItem key={o.value} onSelect={() => { onChange(o.value); setOpen(false); }} className="cursor-pointer">
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function LeadFilters({
  filters, onFiltersChange, currentUserId,
  boardStages = [], customLabels = {},
  filteredCount, totalCount,
}: LeadFiltersProps) {
  const stageColors = (customLabels?.__stage_colors__ as Record<string, string>) || {};
  const { data: cities = [] } = useQuery({
    queryKey: ["lead-cities"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("city").not("city", "is", null).range(0, 4999);
      const unique = [...new Set(data?.map((d) => d.city).filter(Boolean) as string[])].sort();
      return unique;
    },
    staleTime: 300000,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["lead-sources"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("source").not("source", "is", null).range(0, 4999);
      const unique = [...new Set(data?.map((d) => d.source).filter(Boolean) as string[])].sort();
      return unique;
    },
    staleTime: 300000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("status", "active");
      return data || [];
    },
    staleTime: 300000,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["lead-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("tags").not("tags", "is", null).range(0, 4999);
      const set = new Set<string>();
      data?.forEach((row) => (row.tags as string[] | null)?.forEach((t) => t && set.add(t)));
      return Array.from(set).sort();
    },
    staleTime: 300000,
  });

  const set = <K extends keyof LeadFilterValues>(field: K, value: LeadFilterValues[K]) =>
    onFiltersChange({ ...filters, [field]: value });

  const hasFilters =
    filters.city || filters.source || filters.assignedTo || filters.minScore || filters.inactiveDays ||
    (filters.stages?.length ?? 0) > 0 || (filters.tags?.length ?? 0) > 0 ||
    filters.createdWithin || filters.meetingToday;
  const isFilteredByMe = currentUserId && filters.assignedTo === currentUserId;

  const clearAll = () =>
    onFiltersChange({ ...EMPTY_FILTERS, search: filters.search });

  const stageOptions = useMemo(
    () => boardStages.map((s, idx) => ({
      value: s,
      label: (customLabels?.[s] as string) || s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      color: resolveStageColor(s, { customColor: stageColors[s], stageIndex: idx, totalPipelineStages: boardStages.length }),
    })),
    [boardStages, customLabels, stageColors]
  );

  // Saved filters
  const { items: savedItems, save: saveFilter, remove: removeFilter } = useSavedLeadFilters(currentUserId);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  return (
    <div className="flex flex-col gap-2 w-full overflow-hidden">
      {isFilteredByMe ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm">
          <Filter className="h-4 w-4 shrink-0" />
          <span className="font-medium">Mostrando apenas seus leads</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-2 h-7 gap-1 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
            onClick={() => onFiltersChange({ ...filters, assignedTo: "" })}
          >
            <Users className="h-3.5 w-3.5" />
            Ver todos os leads
          </Button>
        </div>
      ) : currentUserId ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
          <Users className="h-4 w-4 shrink-0" />
          <span className="font-medium">Mostrando todos os leads</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-2 h-7 gap-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
            onClick={() => onFiltersChange({ ...filters, assignedTo: currentUserId })}
          >
            <Filter className="h-3.5 w-3.5" />
            Ver meus leads
          </Button>
        </div>
      ) : null}

      {/* Saved filters chips */}
      {savedItems.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
          {savedItems.map((item) => (
            <Badge
              key={item.id}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => onFiltersChange({ ...item.filters, search: filters.search })}
            >
              {item.name}
              <button
                className="ml-0.5 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); removeFilter(item.id); }}
                title="Remover filtro"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3 flex-wrap w-full overflow-hidden bg-card rounded-xl shadow-sm border border-border p-3">
        <FilterField label="Buscar">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome, telefone, email, tag, fonte..."
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              className="pl-9"
            />
          </div>
        </FilterField>

        <FilterField label="Cidade">
          <SingleCombo
            value={filters.city}
            options={cities.map((c) => ({ value: c, label: c }))}
            placeholder="Todas cidades"
            onChange={(v) => set("city", v)}
          />
        </FilterField>

        <FilterField label="Fonte">
          <SingleCombo
            value={filters.source}
            options={sources.map((s) => ({ value: s, label: s }))}
            placeholder="Todas fontes"
            onChange={(v) => set("source", v)}
          />
        </FilterField>

        <FilterField label="Responsável">
          <SingleCombo
            value={filters.assignedTo}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            placeholder="Todos"
            onChange={(v) => set("assignedTo", v)}
          />
        </FilterField>

        {boardStages.length > 0 && (
          <FilterField label="Status">
            <MultiCombo
              values={filters.stages}
              options={stageOptions}
              placeholder="Todos status"
              onChange={(v) => set("stages", v)}
              icon={<Layers className="h-3.5 w-3.5" />}
            />
          </FilterField>
        )}

        {allTags.length > 0 && (
          <FilterField label="Tags">
            <MultiCombo
              values={filters.tags}
              options={allTags.map((t) => ({ value: t, label: t }))}
              placeholder="Todas tags"
              onChange={(v) => set("tags", v)}
              icon={<Tag className="h-3.5 w-3.5" />}
            />
          </FilterField>
        )}

        <FilterField label="Score">
          <Select value={filters.minScore || "all"} onValueChange={(v) => set("minScore", v === "all" ? "" : v)}>
            <SelectTrigger className="w-40">
              <div className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" />
                <SelectValue placeholder="Todos scores" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos scores</SelectItem>
              <SelectItem value="hot">🔥 ≥ 70 (Quente)</SelectItem>
              <SelectItem value="warm">🟡 ≥ 40 (Morno)</SelectItem>
              <SelectItem value="cold">🔵 &lt; 40 (Frio)</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Criação">
          <Select value={filters.createdWithin || "all"} onValueChange={(v) => set("createdWithin", v === "all" ? "" : v)}>
            <SelectTrigger className="w-36">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <SelectValue placeholder="Todos" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Inatividade">
          <Select value={filters.inactiveDays || "all"} onValueChange={(v) => set("inactiveDays", v === "all" ? "" : v)}>
            <SelectTrigger className="w-44">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <SelectValue placeholder="Todos" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="3">&gt; 3 dias inativo</SelectItem>
              <SelectItem value="7">&gt; 7 dias inativo</SelectItem>
              <SelectItem value="15">&gt; 15 dias inativo</SelectItem>
              <SelectItem value="30">&gt; 30 dias inativo</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Reunião hoje">
          <div className="h-9 flex items-center gap-2 px-3 rounded-md border bg-background">
            <Switch checked={filters.meetingToday} onCheckedChange={(v) => set("meetingToday", v)} />
            <span className="text-xs text-muted-foreground">Apenas</span>
          </div>
        </FilterField>

        <div className="flex items-center gap-2 self-end mb-0.5 ml-auto">
          {typeof filteredCount === "number" && typeof totalCount === "number" && (
            <span className="text-xs text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{filteredCount}</span> de {totalCount} leads
            </span>
          )}
          {hasFilters && (
            <>
              <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)} className="gap-1 h-8">
                <Save className="h-3.5 w-3.5" /> Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-muted-foreground h-8">
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar filtro</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="filter-name">Nome do filtro</Label>
            <Input
              id="filter-name"
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ex: Quentes sem contato 7d"
              onKeyDown={(e) => {
                if (e.key === "Enter" && saveName.trim()) {
                  saveFilter(saveName, filters);
                  setSaveName("");
                  setSaveOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancelar</Button>
            <Button
              disabled={!saveName.trim()}
              onClick={() => {
                saveFilter(saveName, filters);
                setSaveName("");
                setSaveOpen(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
