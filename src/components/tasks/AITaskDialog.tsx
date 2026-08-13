import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Pencil, ClipboardList, Users, Mic, Square, Trash2, X, CalendarDays } from "lucide-react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { findDuplicateTasks, type DuplicateTask } from "@/lib/task-duplicates";
import { cn } from "@/lib/utils";
import { useMeetingRecorder } from "@/hooks/use-meeting-recorder";
import { AIProcessingModal } from "@/components/ai/AIProcessingModal";
import { useAIProgress } from "@/hooks/use-ai-progress";

const TASK_GEN_STATUS = [
  "Interpretando descrição...",
  "Identificando responsáveis...",
  "Estruturando checklist...",
  "Definindo prioridades e prazos...",
  "Verificando duplicatas...",
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type LinkType = "lead" | "team";

interface AITask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  due_date_suggestion: number | null;
  due_date: string | null;
  lead_id: string | null;
  lead_name: string | null;
  selected?: boolean;
  duplicates?: DuplicateTask[];
  linkType: LinkType;
  member_id?: string;
  editing?: boolean;
}

interface AITaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AITaskDialog({ open, onOpenChange }: AITaskDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [step, setStep] = useState<"input" | "preview">("input");
  const { isRecording, duration, partialTranscription, startRecording, stopRecording } = useMeetingRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsTranscribing(true);
      try {
        const transcribed = await stopRecording();
        if (transcribed && transcribed.trim()) {
          setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${transcribed.trim()}` : transcribed.trim()));
          toast.success("Áudio transcrito com sucesso!");
        } else {
          toast.warning("Nenhum áudio detectado.");
        }
      } finally {
        setIsTranscribing(false);
      }
    } else {
      await startRecording();
    }
  };

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

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-task-from-text", {
        body: { text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const generated = data.tasks as AITask[];

      const enriched: AITask[] = await Promise.all(
        generated.map(async (t) => {
          const linkType: LinkType = t.lead_id ? "lead" : "team";
          const initialDueDate =
            typeof t.due_date_suggestion === "number" && t.due_date_suggestion >= 0
              ? format(addDays(new Date(), t.due_date_suggestion), "yyyy-MM-dd")
              : null;
          const base: AITask = {
            ...t,
            selected: true,
            editing: false,
            duplicates: [],
            linkType,
            member_id: undefined,
            due_date: initialDueDate,
          };
          if (!t.lead_id) return base;
          const dups = await findDuplicateTasks({ leadId: t.lead_id, title: t.title });
          return { ...base, duplicates: dups, selected: dups.length === 0 };
        })
      );
      return enriched;
    },
    onSuccess: (data) => {
      setTasks(data);
      setStep("preview");
      const dupCount = data.filter((t) => (t.duplicates?.length ?? 0) > 0).length;
      if (dupCount > 0) {
        toast.warning(`${dupCount} tarefa${dupCount > 1 ? "s" : ""} já existe${dupCount > 1 ? "m" : ""} no lead — desmarcada${dupCount > 1 ? "s" : ""} por padrão`);
      }
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao processar texto com IA");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const selected = tasks.filter((t) => t.selected);
      if (selected.length === 0) throw new Error("Selecione pelo menos uma tarefa");

      let createdCount = 0;
      let skippedCount = 0;

      for (const task of selected) {
        const isLeadMode = task.linkType === "lead";

        // Validate
        if (isLeadMode && !task.lead_id) {
          skippedCount++;
          continue;
        }
        if (!isLeadMode && !task.member_id) {
          skippedCount++;
          continue;
        }

        const dueDate = task.due_date
          ? new Date(`${task.due_date}T12:00:00`).toISOString()
          : null;

        const assignee = isLeadMode ? user.id : (task.member_id || user.id);

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title: task.title,
            description: task.description,
            priority: task.priority,
            lead_id: isLeadMode ? task.lead_id : null,
            due_date: dueDate,
            assigned_to: assignee,
            created_by: user.id,
            type: isLeadMode ? "lead" : "team",
          })
          .select("id")
          .single();
        if (error) throw error;

        await supabase.from("task_history").insert({
          task_id: data.id,
          user_id: user.id,
          action: "created",
          details: "Tarefa criada via IA",
        });

        if (!isLeadMode && assignee !== user.id) {
          await supabase.rpc("create_notification", {
            p_user_id: assignee,
            p_type: "task_assigned",
            p_message: `Você recebeu uma nova tarefa: ${task.title}`,
            p_source_id: data.id,
            p_metadata: { taskId: data.id } as any,
          });
        }

        createdCount++;
      }

      return { createdCount, skippedCount };
    },
    onSuccess: ({ createdCount, skippedCount }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (createdCount > 0) {
        toast.success(`${createdCount} tarefa${createdCount > 1 ? "s" : ""} criada${createdCount > 1 ? "s" : ""} com sucesso!`);
      }
      if (skippedCount > 0) {
        toast.warning(`${skippedCount} tarefa${skippedCount > 1 ? "s" : ""} ignorada${skippedCount > 1 ? "s" : ""} por falta de vínculo (Lead ou Membro)`);
      }
      if (createdCount > 0) handleClose();
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao criar tarefas");
    },
  });

  const handleClose = () => {
    setText("");
    setTasks([]);
    setStep("input");
    onOpenChange(false);
  };

  const updateTask = (idx: number, patch: Partial<AITask>) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleTask = (idx: number) => {
    updateTask(idx, { selected: !tasks[idx].selected });
  };

  return (
    <>
      <AITaskProgressModal isPending={generateMutation.isPending} />
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar Tarefas com IA
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <>
            <div className="grid gap-3 py-3">
              <Label>
                Cole o texto (e-mail, mensagem, anotação, etc.) ou grave um áudio para a IA extrair tarefas:
              </Label>
              <Textarea
                value={isTranscribing ? (partialTranscription || "Transcrevendo áudio...") : text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ex: Preciso ligar para o João amanhã para confirmar a reunião de sexta. Também preciso enviar o contrato para a Maria com urgência..."
                className="min-h-[160px]"
                disabled={isRecording || isTranscribing}
              />

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  onClick={handleToggleRecording}
                  disabled={isTranscribing}
                  className={cn("gap-2", isRecording && "animate-pulse")}
                >
                  {isTranscribing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Transcrevendo áudio...</>
                  ) : isRecording ? (
                    <><Square className="h-4 w-4 fill-current" />Parar gravação</>
                  ) : (
                    <><Mic className="h-4 w-4" />Gravar áudio</>
                  )}
                </Button>
                {isRecording && (
                  <span className="text-sm font-mono text-destructive tabular-nums">
                    {formatDuration(duration)}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                A IA irá identificar tarefas, prioridades, prazos e leads mencionados no texto.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={text.trim().length < 5 || generateMutation.isPending || isRecording || isTranscribing}
                className="gap-2"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Analisando...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Gerar Tarefas</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "preview" && (
          <>
            <div className="grid gap-3 py-2">
              {tasks.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Todas as tarefas foram removidas. Volte para gerar novamente.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A IA identificou {tasks.length} tarefa{tasks.length > 1 ? "s" : ""}. Revise, edite e selecione as que deseja criar:
                </p>
              )}
              {tasks.map((task, idx) => {
                const isDuplicate = (task.duplicates?.length ?? 0) > 0;
                const selectedLead = leads.find((l) => l.id === task.lead_id);
                const selectedMember = users.find((u) => u.id === task.member_id);
                const isLeadMode = task.linkType === "lead";
                return (
                  <Card
                    key={idx}
                    className={`p-4 border-2 transition-colors ${
                      task.selected ? "border-primary/40 bg-primary/5" : "border-transparent opacity-60"
                    } ${isDuplicate ? "border-amber-300 dark:border-amber-700" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.selected}
                        onCheckedChange={() => toggleTask(idx)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {!task.editing && <span className="font-medium text-sm truncate">{task.title}</span>}
                            {!task.editing && task.due_date && (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {format(new Date(`${task.due_date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                              </Badge>
                            )}
                            {isDuplicate && (
                              <Badge variant="outline" className="text-[10px] gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                Já existe
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => updateTask(idx, { editing: !task.editing })}
                            >
                              <Pencil className="h-3 w-3" />
                              {task.editing ? "Fechar" : "Editar"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeTask(idx)}
                              title="Excluir tarefa sugerida"
                            >
                              <Trash2 className="h-3 w-3" />
                              Excluir
                            </Button>
                          </div>
                        </div>

                        {!task.editing && task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        )}
                        {!task.editing && isLeadMode && (selectedLead?.name || task.lead_name) && (
                          <p className="text-xs text-primary">📋 Lead: {selectedLead?.name || task.lead_name}</p>
                        )}
                        {!task.editing && !isLeadMode && selectedMember && (
                          <p className="text-xs text-primary">🧑 Membro: {selectedMember.name}</p>
                        )}
                        {!task.editing && !isLeadMode && !selectedMember && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ Selecione um membro da equipe</p>
                        )}
                        {isDuplicate && !task.editing && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            Tarefa parecida já está pendente neste lead: "{task.duplicates![0].title}"
                          </p>
                        )}

                        {task.editing && (
                          <div className="grid gap-3 pt-2">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">Título</Label>
                              <Input
                                value={task.title}
                                onChange={(e) => updateTask(idx, { title: e.target.value })}
                                className="h-9"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">Descrição</Label>
                              <Textarea
                                value={task.description}
                                onChange={(e) => updateTask(idx, { description: e.target.value })}
                                rows={2}
                                className="text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="grid gap-1.5">
                                <Label className="text-xs">Prioridade</Label>
                                <Select
                                  value={task.priority}
                                  onValueChange={(v) => updateTask(idx, { priority: v as AITask["priority"] })}
                                >
                                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="high">🔴 Alta</SelectItem>
                                    <SelectItem value="medium">🟡 Média</SelectItem>
                                    <SelectItem value="low">🔵 Baixa</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-xs">Data de entrega</Label>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="date"
                                    min={format(new Date(), "yyyy-MM-dd")}
                                    value={task.due_date ?? ""}
                                    onChange={(e) =>
                                      updateTask(idx, {
                                        due_date: e.target.value === "" ? null : e.target.value,
                                      })
                                    }
                                    className="h-9"
                                  />
                                  {task.due_date && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 shrink-0 text-muted-foreground"
                                      onClick={() => updateTask(idx, { due_date: null })}
                                      title="Sem prazo"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-1.5">
                              <Label className="text-xs">Vincular a</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  type="button"
                                  variant={isLeadMode ? "default" : "outline"}
                                  size="sm"
                                  className={cn("h-9 gap-2 justify-start", isLeadMode && "ring-2 ring-primary/30")}
                                  onClick={() => updateTask(idx, { linkType: "lead" })}
                                >
                                  <ClipboardList className="h-4 w-4" />
                                  Lead
                                </Button>
                                <Button
                                  type="button"
                                  variant={!isLeadMode ? "default" : "outline"}
                                  size="sm"
                                  className={cn("h-9 gap-2 justify-start", !isLeadMode && "ring-2 ring-primary/30")}
                                  onClick={() => updateTask(idx, { linkType: "team" })}
                                >
                                  <Users className="h-4 w-4" />
                                  Membro da Equipe
                                </Button>
                              </div>
                            </div>

                            {isLeadMode ? (
                              <div className="grid gap-1.5">
                                <Label className="text-xs">Lead vinculado</Label>
                                <Select
                                  value={task.lead_id || "__none__"}
                                  onValueChange={(v) =>
                                    updateTask(idx, { lead_id: v === "__none__" ? null : v })
                                  }
                                >
                                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione um lead" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Sem lead</SelectItem>
                                    {leads.map((l) => (
                                      <SelectItem key={l.id} value={l.id}>{l.name || "Sem nome"}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">Executor: você (criador da tarefa)</p>
                              </div>
                            ) : (
                              <div className="grid gap-1.5">
                                <Label className="text-xs">Membro responsável</Label>
                                <Select
                                  value={task.member_id || ""}
                                  onValueChange={(v) => updateTask(idx, { member_id: v })}
                                >
                                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione um membro" /></SelectTrigger>
                                  <SelectContent>
                                    {users.map((u) => (
                                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">Tarefa interna — sem lead vinculado</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>Voltar</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!tasks.some((t) => t.selected) || createMutation.isPending}
                className="gap-2"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Criando...</>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Criar {tasks.filter((t) => t.selected).length} Tarefa{tasks.filter((t) => t.selected).length > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AITaskProgressModal({ isPending }: { isPending: boolean }) {
  const { progress, remainingMs, isOvertime } = useAIProgress(isPending, 7000);
  return (
    <AIProcessingModal
      open={isPending}
      progress={progress}
      remainingMs={remainingMs}
      isOvertime={isOvertime}
      title="Gerando Tarefas"
      statusMessages={TASK_GEN_STATUS}
      footerText="IA estruturando suas tarefas"
    />
  );
}

