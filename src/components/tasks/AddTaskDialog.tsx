import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { findDuplicateTasks, type DuplicateTask } from "@/lib/task-duplicates";
import { DuplicateTaskDialog } from "./DuplicateTaskDialog";
import { TaskDetailSheet } from "./TaskDetailSheet";

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LinkType = "lead" | "member";

export function AddTaskDialog({ open, onOpenChange }: AddTaskDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", lead_id: "", due_date: "", member_id: "" });
  const [linkType, setLinkType] = useState<LinkType>("lead");
  const [duplicates, setDuplicates] = useState<DuplicateTask[]>([]);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [checking, setChecking] = useState(false);
  const [viewingTask, setViewingTask] = useState<any>(null);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-select"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, name").order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-select"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
    enabled: open,
  });

  const resetForm = () => {
    setForm({ title: "", description: "", priority: "medium", lead_id: "", due_date: "", member_id: "" });
    setLinkType("lead");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const isLeadMode = linkType === "lead";
      const assignee = isLeadMode ? user.id : (form.member_id || user.id);
      const { data, error } = await supabase.from("tasks").insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        lead_id: isLeadMode ? form.lead_id : null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assigned_to: assignee,
        created_by: user.id,
        type: isLeadMode ? "lead" : "team",
      }).select("id").single();
      if (error) throw error;
      // Register history
      await supabase.from("task_history").insert({
        task_id: data.id,
        user_id: user.id,
        action: "created",
        details: "Tarefa criada",
      });

      // Notify assignee if it's a different user
      if (assignee !== user.id) {
        await supabase.rpc("create_notification", {
          p_user_id: assignee,
          p_type: "task_assigned",
          p_message: `Você recebeu uma nova tarefa: ${form.title}`,
          p_source_id: data.id,
          p_metadata: { leadId: isLeadMode ? form.lead_id : null, taskId: data.id } as any,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada");
      resetForm();
      setShowDupDialog(false);
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const isValid = () => {
    if (!form.title) return false;
    if (linkType === "lead") return !!form.lead_id;
    return !!form.member_id;
  };

  const handleSubmit = async () => {
    if (!isValid()) return;
    setChecking(true);
    try {
      if (linkType === "lead") {
        const dups = await findDuplicateTasks({ leadId: form.lead_id, title: form.title });
        if (dups.length > 0) {
          setDuplicates(dups);
          onOpenChange(false);
          setShowDupDialog(true);
          return;
        }
      }
      mutation.mutate();
    } finally {
      setChecking(false);
    }
  };

  const handleDupDialogChange = (next: boolean) => {
    setShowDupDialog(next);
    if (!next && !mutation.isPending && !mutation.isSuccess) {
      onOpenChange(true);
    }
  };

  const handleViewExisting = async (task: DuplicateTask) => {
    if (user && task.assigned_to && task.assigned_to !== user.id) {
      const { data: lead } = await supabase.from("leads").select("name").eq("id", form.lead_id).single();
      await supabase.rpc("create_notification", {
        p_user_id: task.assigned_to,
        p_type: "task_assigned",
        p_message: `Outro usuário tentou criar uma tarefa parecida no lead "${lead?.name || "Lead"}"`,
        p_source_id: task.id,
        p_metadata: { leadId: form.lead_id, taskId: task.id, duplicate_attempt: true } as any,
      });
    }
    const { data: fullTask } = await supabase.from("tasks").select("*").eq("id", task.id).single();
    setShowDupDialog(false);
    if (fullTask) setViewingTask(fullTask);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Vencimento (data e hora)</Label>
                <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>

            {/* Toggle Vincular a */}
            <div className="grid gap-2">
              <Label>Vincular a *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLinkType("lead")}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    linkType === "lead"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  📋 Lead
                </button>
                <button
                  type="button"
                  onClick={() => setLinkType("member")}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    linkType === "member"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  🧑 Membro da Equipe
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {linkType === "lead"
                  ? "A tarefa será registrada como ação do Lead. Você é o executor."
                  : "A tarefa será atribuída a um membro da equipe, que será o responsável."}
              </p>
            </div>

            {/* Lead select */}
            {linkType === "lead" && (
              <div className="grid gap-2">
                <Label>Lead *</Label>
                <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um lead" /></SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name || "Sem nome"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Member select */}
            {linkType === "member" && (
              <div className="grid gap-2">
                <Label>Responsável *</Label>
                <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um membro da equipe" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!isValid() || mutation.isPending || checking}>
              {checking ? "Verificando..." : mutation.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateTaskDialog
        open={showDupDialog}
        onOpenChange={handleDupDialogChange}
        duplicates={duplicates}
        onViewExisting={handleViewExisting}
        onCreateAnyway={() => mutation.mutate()}
        isCreating={mutation.isPending}
      />

      {viewingTask && (
        <TaskDetailSheet task={viewingTask} onClose={() => setViewingTask(null)} />
      )}
    </>
  );
}
