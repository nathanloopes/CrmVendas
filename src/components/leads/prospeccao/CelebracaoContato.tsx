import { useEffect } from "react";
import { X } from "lucide-react";

type Variant = "contato" | "crm";

interface CelebracaoContatoProps {
  open: boolean;
  onClose: () => void;
  variant: Variant;
  leadName: string;
  contagemHoje?: number;
}

export function CelebracaoContato({ open, onClose, variant, leadName, contagemHoje }: CelebracaoContatoProps) {
  // Auto-dismiss após 5s
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  const emoji = variant === "crm" ? "🚀" : "🎉";
  const titulo = variant === "crm" ? "Lead enviado pro CRM!" : "Arrasou, Beatriz!";
  const subtitulo = variant === "crm"
    ? `${leadName} está a caminho da reunião. Excelente trabalho!`
    : `Contato com ${leadName} registrado!`;

  // Card de meta (só para variant="contato")
  let metaCard: { texto: string; bg: string; border: string; color: string } | null = null;
  if (variant === "contato" && contagemHoje !== undefined) {
    if (contagemHoje === 1) {
      metaCard = { texto: "🎯 Primeiro contato do dia! Ótimo começo.", bg: "#ECFDF5", border: "#6EE7B7", color: "#065F46" };
    } else if (contagemHoje === 3) {
      metaCard = { texto: "🔥 3 contatos hoje! Você está em chama.", bg: "#ECFDF5", border: "#6EE7B7", color: "#065F46" };
    } else if (contagemHoje === 5) {
      metaCard = { texto: "👑 5 contatos hoje! Meta do dia atingida!", bg: "#FFFBEB", border: "#FBBF24", color: "#92400E" };
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-[90vw] max-w-[380px] rounded-2xl bg-card shadow-xl animate-scale-in border border-border"
        style={{ padding: "28px 32px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão X */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Saudação */}
        <div className="text-center">
          <div
            className="mx-auto inline-block animate-bounce"
            style={{ fontSize: "40px", lineHeight: 1, animationIterationCount: 2, animationDuration: "0.6s" }}
          >
            {emoji}
          </div>
          <h3 className="mt-2 font-semibold text-foreground" style={{ fontSize: "20px" }}>
            {titulo}
          </h3>
          <p className="mt-1 text-muted-foreground" style={{ fontSize: "13px" }}>
            {subtitulo}
          </p>
        </div>

        {/* Card de meta diária */}
        {metaCard && (
          <div
            className={`mt-3 rounded-[10px] text-center font-semibold ${
              metaCard.texto.startsWith("👑")
                ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/50 text-amber-800 dark:text-amber-200"
                : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200"
            }`}
            style={{ padding: "10px 14px", fontSize: "13px" }}
          >
            {metaCard.texto}
          </div>
        )}
      </div>
    </div>
  );
}
