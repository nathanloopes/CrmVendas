import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LeadDocuments } from "./LeadDocuments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, ExternalLink, Loader2, Mic, Copy, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface LeadMaterialsProps {
  leadId: string;
}

export function LeadMaterials({ leadId }: LeadMaterialsProps) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [viewingMaterial, setViewingMaterial] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["lead-materials", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_materials")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-materials", leadId] });
      toast.success("Material excluído com sucesso!");
      if (viewingMaterial && viewingMaterial.id === deletingId) {
        setViewingMaterial(null);
      }
      setDeletingId(null);
    },
    onError: () => {
      toast.error("Erro ao excluir material.");
      setDeletingId(null);
    },
  });

  const handleCopy = async () => {
    if (!viewingMaterial?.content) return;
    await navigator.clipboard.writeText(viewingMaterial.content);
    setCopied(true);
    toast.success("Transcrição copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClick = (m: any) => {
    if (m.content) {
      setViewingMaterial(m);
    } else if (m.url) {
      window.open(m.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : materials.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum material anexado.</p>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center gap-1">
              <button
                onClick={() => handleClick(m)}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex-1 text-left"
              >
                {m.type === "transcricao" ? (
                  <Mic className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                  {m.description && <p className="text-xs text-muted-foreground truncate">{m.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{m.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(m.created_at), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                {m.content ? (
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingId(m.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewingMaterial} onOpenChange={(open) => { if (!open) setViewingMaterial(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{viewingMaterial?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto max-h-[65vh] border rounded-md p-4">
            <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {viewingMaterial?.content}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={() => setDeletingId(viewingMaterial?.id)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            )}
            <Button variant="outline" onClick={handleCopy} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este material? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingId) deleteMutation.mutate(deletingId);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator />
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Documentos</h3>
        <LeadDocuments leadId={leadId} />
      </div>
    </div>
  );
}
