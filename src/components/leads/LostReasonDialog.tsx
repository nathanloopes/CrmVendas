import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface LostReasonDialogProps {
  open: boolean;
  reasons: string[];
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function LostReasonDialog({ open, reasons, onConfirm, onCancel }: LostReasonDialogProps) {
  const [selected, setSelected] = useState("");
  const [customReason, setCustomReason] = useState("");

  const isOther = selected === "__other__";
  const canConfirm = isOther ? customReason.trim().length > 0 : selected.length > 0;

  const handleConfirm = () => {
    const reason = isOther ? customReason.trim() : selected;
    if (reason) {
      onConfirm(reason);
      setSelected("");
      setCustomReason("");
    }
  };

  const handleCancel = () => {
    setSelected("");
    setCustomReason("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motivo da perda</DialogTitle>
          <DialogDescription>
            Selecione o motivo pelo qual este lead foi perdido.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2 my-2">
          {reasons.map((reason) => (
            <div key={reason} className="flex items-center space-x-2">
              <RadioGroupItem value={reason} id={`reason-${reason}`} />
              <Label htmlFor={`reason-${reason}`} className="cursor-pointer text-sm">
                {reason}
              </Label>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="__other__" id="reason-other" />
            <Label htmlFor="reason-other" className="cursor-pointer text-sm">
              Outro
            </Label>
          </div>
        </RadioGroup>

        {isOther && (
          <Input
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Digite o motivo..."
            autoFocus
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
