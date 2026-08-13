import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper padrão para qualquer campo dentro de uma barra de filtros.
 * Renderiza um pequeno rótulo acima do controle para que o usuário
 * sempre saiba o que cada filtro representa, mesmo após selecionar uma opção.
 */
export function FilterField({ label, children, className }: FilterFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">
        {label}
      </span>
      {children}
    </div>
  );
}
