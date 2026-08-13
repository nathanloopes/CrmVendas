import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAvailableCities } from "@/hooks/use-available-cities";

interface CityComboboxProps {
  value: string;
  onChange: (value: string) => void;
  cities: string[];
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * When true, mostra apenas um aviso visual (Disponível/Ocupada/Reservada)
   * ao lado do nome da cidade — NÃO bloqueia a seleção. O usuário pode
   * escolher qualquer cidade da lista IBGE ou digitar livremente.
   */
  availableOnly?: boolean;
  /** UF usada para consultar a tabela available_cities e exibir o status. */
  uf?: string;
}

export function CityCombobox({
  value,
  onChange,
  cities,
  isLoading,
  disabled,
  availableOnly,
  uf,
}: CityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: availableRows = [] } = useAvailableCities(availableOnly ? uf : undefined);

  const statusByCity = useMemo(() => {
    const map = new Map<string, "available" | "reserved" | "occupied">();
    if (availableOnly) {
      availableRows.forEach((r) => map.set(r.city.toLowerCase(), r.status));
    }
    return map;
  }, [availableOnly, availableRows]);

  const items = useMemo(() => {
    return cities.map((c) => {
      const status = statusByCity.get(c.toLowerCase()) || null;
      return {
        city: c,
        status,
        note:
          status === "occupied"
            ? "Ocupada"
            : status === "reserved"
              ? "Reservada"
              : status === "available"
                ? "Disponível"
                : null,
      };
    });
  }, [cities, statusByCity]);

  const trimmed = search.trim();
  const hasExact = trimmed
    ? items.some((i) => i.city.toLowerCase() === trimmed.toLowerCase())
    : true;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {value || "Selecionar cidade..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar ou digitar cidade..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Carregando..." : "Nenhuma cidade encontrada."}
            </CommandEmpty>

            {trimmed && !hasExact && (
              <CommandGroup heading="Personalizada">
                <CommandItem
                  value={`__custom__${trimmed}`}
                  onSelect={() => {
                    onChange(trimmed);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Usar "{trimmed}"</span>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup>
              {items.map((item) => {
                const isOccupied = item.status === "occupied";
                const isReserved = item.status === "reserved";
                return (
                  <CommandItem
                    key={item.city}
                    value={item.city}
                    onSelect={() => {
                      onChange(item.city);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === item.city ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1">{item.city}</span>
                    {item.note && (
                      <span
                        className={cn(
                          "ml-2 inline-flex items-center gap-1 text-[10px]",
                          isOccupied && "text-rose-600 dark:text-rose-400",
                          isReserved && "text-amber-600 dark:text-amber-400",
                          item.status === "available" && "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {(isOccupied || isReserved) && <Lock className="h-3 w-3" />}
                        {item.note}
                      </span>
                    )}
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
