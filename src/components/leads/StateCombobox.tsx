import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { BRAZILIAN_STATES } from "@/lib/brazilian-states";
import { PARAGUAY_DEPARTMENTS } from "@/lib/paraguay-locations";

interface StateComboboxProps {
  value: string;
  onChange: (value: string) => void;
  country?: "BR" | "PY";
}

export function StateCombobox({ value, onChange, country = "BR" }: StateComboboxProps) {
  const [open, setOpen] = useState(false);

  const options = country === "PY"
    ? PARAGUAY_DEPARTMENTS.map((d) => ({ label: d.label, value: d.value }))
    : BRAZILIAN_STATES.map((s) => ({ label: s.label, value: s.value }));

  const selected = options.find((s) => s.value === value);
  const placeholder = country === "PY" ? "Selecionar departamento..." : "Selecionar estado...";
  const searchPlaceholder = country === "PY" ? "Buscar departamento..." : "Buscar estado...";
  const emptyText = country === "PY" ? "Nenhum departamento encontrado." : "Nenhum estado encontrado.";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? `${selected.label} (${selected.value})` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="nenhum"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Nenhum
              </CommandItem>
              {options.map((s) => (
                <CommandItem
                  key={s.value}
                  value={`${s.label} ${s.value}`}
                  onSelect={() => {
                    onChange(s.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === s.value ? "opacity-100" : "opacity-0")} />
                  {s.label} ({s.value})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
