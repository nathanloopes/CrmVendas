import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";

interface Props {
  open: boolean;
  count: number;
  defaultTag?: string;
  onClose: () => void;
  onConfirm: (extraTag: string | null) => Promise<void>;
}

export function PromoteToPipelineDialog({ open, count, defaultTag, onClose, onConfirm }: Props) {
  const [extraTag, setExtraTag] = useState(defaultTag ?? `Origem Base ${new Date().toLocaleDateString("pt-BR")}`);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(extraTag.trim() || null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar para Captação Ativa</DialogTitle>
          <DialogDescription>
            Você está enviando <strong>{count}</strong> lead(s) para o pipeline principal de Captação Ativa.
            Eles aparecerão no Kanban no estágio <strong>Captação</strong>. Telefones já existentes serão ignorados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs">Etiqueta de rastreio (opcional)</Label>
          <Input
            value={extraTag}
            onChange={(e) => setExtraTag(e.target.value)}
            placeholder="Ex: Origem Base 27/04"
            disabled={loading}
          />
          <p className="text-[11px] text-muted-foreground">
            Esta etiqueta será aplicada a todos os leads enviados, facilitando filtrar este lote depois.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
