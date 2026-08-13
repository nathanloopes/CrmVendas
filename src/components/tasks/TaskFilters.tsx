import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterField } from "@/components/ui/filter-field";

interface TaskFiltersProps {
  status: string;
  onStatusChange: (v: string) => void;
}

export function TaskFilters({ status, onStatusChange }: TaskFiltersProps) {
  return (
    <div className="flex items-end gap-3">
      <FilterField label="Status">
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="completed">Concluídas</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );
}
