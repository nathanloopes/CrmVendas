import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface SendToKanbanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: any;
}

export function SendToKanbanDialog({ open, onOpenChange, candidate }: SendToKanbanDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [boardId, setBoardId] = useState<string>("");
  const [stage, setStage] = useState<string>("");
  const [sdrId, setSdrId] = useState<string>("");

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("kanban_boards")
        .select("id, name, stage_order, custom_labels")
        .order("sort_order", { ascending: true });
      return data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("status", "active");
      return data || [];
    },
  });

  // City availability lookup
  const { data: cityCheck, isLoading: cityLoading } = useQuery({
    queryKey: ["city-check", candidate?.cidade, candidate?.estado],
    enabled: !!candidate?.cidade && !!candidate?.estado && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("available_cities" as any)
        .select("status")
        .ilike("city", candidate.cidade)
        .ilike("state", candidate.estado)
        .maybeSingle();
      return (data ?? null) as unknown as { status: string } | null;
    },
  });

  useEffect(() => {
    if (boards.length && !boardId) {
      const br = boards.find((b: any) => (b.name || "").toLowerCase().includes("brasil")) || boards[0];
      setBoardId(br.id);
      setStage(((br.stage_order as string[]) || [])[0] || "");
    }
  }, [boards, boardId]);

  const selectedBoard = boards.find((b: any) => b.id === boardId);
  const stages: string[] = (selectedBoard?.stage_order as string[]) || [];
  const labels: Record<string, string> = (selectedBoard?.custom_labels as Record<string, string>) || {};

  const cityAvailable: boolean | null = cityCheck
    ? cityCheck.status === "available"
    : null;

  const cityBadge = cityLoading ? (
    <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verificando...</Badge>
  ) : cityAvailable === true ? (
    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">🟢 Cidade disponível</Badge>
  ) : cityAvailable === false ? (
    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">🔴 Cidade ocupada / reservada</Badge>
  ) : (
    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">⚪ Cidade não cadastrada</Badge>
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!candidate) throw new Error("Sem candidato");
      const phoneNorm = String(candidate.telefone || "").replace(/\D/g, "");

      // Duplicate check
      const { data: existing } = await supabase
        .from("leads")
        .select("id, name")
        .eq("phone", phoneNorm)
        .maybeSingle();

      if (existing) {
        // Already exists - just link the triagem record
        await supabase
          .from("triagem_franqueado" as any)
          .update({
            lead_id: existing.id,
            converted_at: new Date().toISOString(),
            converted_by: user?.id ?? null,
          })
          .eq("id", candidate.id);
        return { id: existing.id, existed: true };
      }

      const interest = candidate.diagnostico
        ? `Triagem (${candidate.classificacao} • ${candidate.score}/100): ${candidate.diagnostico}`
        : `Triagem ${candidate.classificacao} • ${candidate.score}/100`;

      const { data: inserted, error } = await supabase
        .from("leads")
        .insert({
          name: candidate.nome,
          phone: phoneNorm,
          city: candidate.cidade || null,
          state: candidate.estado || null,
          city_of_interest: candidate.cidade || null,
          state_of_interest: candidate.estado || null,
          city_available: cityAvailable,
          source: "Triagem - Conhecer Perfil",
          interest,
          lead_score: candidate.score ?? null,
          tags: ["triagem", candidate.classificacao].filter(Boolean),
          board_id: boardId || null,
          stage: stage || stages[0] || "captação",
          sdr_responsible_id: sdrId || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase
        .from("triagem_franqueado" as any)
        .update({
          lead_id: inserted!.id,
          converted_at: new Date().toISOString(),
          converted_by: user?.id ?? null,
        })
        .eq("id", candidate.id);

      return { id: inserted!.id, existed: false };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["triagem-franqueado"] });
      toast.success(res.existed ? "Lead já existia — vinculado ao candidato." : "Candidato enviado para o Kanban!");
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      if (msg.includes("DUPLICATE_LEAD")) {
        toast.error("Já existe um lead com este telefone.");
      } else {
        toast.error(msg || "Erro ao enviar para o Kanban");
      }
    },
  });

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar para o Kanban</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-slate-50/60 p-3 space-y-1.5">
            <p className="font-medium">{candidate.nome}</p>
            <p className="text-sm text-muted-foreground">📞 {candidate.telefone}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {candidate.cidade ?? "—"}{candidate.estado ? `/${candidate.estado}` : ""}
            </p>
            <div className="pt-1">{cityBadge}</div>
          </div>

          <div className="grid gap-2">
            <Label>Quadro (País)</Label>
            <Select value={boardId} onValueChange={(v) => {
              setBoardId(v);
              const b = boards.find((x: any) => x.id === v);
              setStage(((b?.stage_order as string[]) || [])[0] || "");
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {boards.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {stages.length > 0 && (
            <div className="grid gap-2">
              <Label>Etapa inicial</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s} value={s}>{labels[s] || s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>SDR responsável (opcional)</Label>
            <Select value={sdrId || "none"} onValueChange={(v) => setSdrId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !boardId}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar para Kanban
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
