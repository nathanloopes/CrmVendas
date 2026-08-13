import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface AIProcessingModalProps {
  open: boolean;
  progress: number;
  remainingMs?: number;
  isOvertime?: boolean;
  title: string;
  statusMessages?: string[];
  footerText?: string;
}

/**
 * Generic progress modal used by AI-assisted flows.
 * Shows an animated progress bar and rotates through status messages.
 */
export function AIProcessingModal({
  open,
  progress,
  remainingMs,
  isOvertime,
  title,
  statusMessages = [],
  footerText,
}: AIProcessingModalProps) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!open || statusMessages.length === 0) return;
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % statusMessages.length);
    }, 2000);
    return () => clearInterval(id);
  }, [open, statusMessages.length]);

  const remainingSeconds =
    typeof remainingMs === "number" ? Math.ceil(remainingMs / 1000) : null;

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm [&>button]:hidden">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <h3 className="font-semibold text-base">{title}</h3>
            {statusMessages.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1 min-h-[20px]">
                {statusMessages[msgIndex]}
              </p>
            )}
          </div>
          <Progress value={Math.min(100, Math.max(0, progress))} className="w-full" />
          <p className="text-xs text-muted-foreground">
            {isOvertime
              ? "Quase lá, finalizando..."
              : remainingSeconds !== null
                ? `~${remainingSeconds}s restantes`
                : null}
          </p>
          {footerText && (
            <p className="text-[11px] text-muted-foreground/70">{footerText}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AIProcessingModal;
