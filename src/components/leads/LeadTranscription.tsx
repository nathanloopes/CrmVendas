import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Loader2, Upload, CheckCircle, Calendar, ListTodo, AlertTriangle,
  Target, Edit2, Trash2, Plus, ChevronDown, ChevronUp, Save, ArrowRight, MapPin,
  ShieldAlert, Gauge
} from "lucide-react";
import { toast } from "sonner";
import { AIProcessingModal } from "@/components/ai/AIProcessingModal";
import { useAIProgress } from "@/hooks/use-ai-progress";
import { computeDueDateByPriority, sanitizeDueDate } from "@/lib/task-due-date";
import { useRecalculateLeadScore } from "@/hooks/useRecalculateLeadScore";

const TRANSCRIPTION_STATUS = [
  "Lendo transcrição completa...",
  "Identificando participantes e contexto...",
  "Extraindo tarefas e responsáveis...",
  "Detectando reuniões e prazos...",
  "Avaliando riscos e próximos passos...",
];

const CONFIRM_STATUS = [
  "Criando tarefas no sistema...",
  "Notificando responsáveis...",
  "Sincronizando com Google Calendar...",
  "Salvando transcrição como material...",
];

interface LeadTranscriptionProps {
  leadId: string;
  initialTranscription?: string;
}

type Agendamento = {
  deve_agendar: boolean;
  tipo?: string;
  data_sugerida?: string;
  prazo_final?: string;
  responsavel?: string;
  descricao_agenda?: string;
};

type TaskDraft = {
  titulo: string;
  descricao: string;
  descricao_detalhada?: string;
  criterio_conclusao?: string;
  responsavel: string;
  tipo: "lead" | "franquia";
  papel?: string;
  prioridade: string;
  prazo_sugerido_dias: number;
  impacto: string;
  origem: string;
  passos_execucao: string[];
  agendamento: Agendamento;
  data_execucao: string;
  is_reuniao: boolean;
  horario_inicio?: string;
  horario_fim?: string;
};

type Reuniao = {
  status: string;
  data?: string | null;
  responsavel?: string;
};

type AnalysisResult = {
  etapa_atual: string;
  proxima_movimentacao: string;
  reuniao: Reuniao;
  pontos_atencao: string[];
  tarefas_lead: TaskDraft[];
  tarefas_franquia: TaskDraft[];
  proxima_acao_recomendada: string;
  next_meeting: { title: string; start_datetime: string; end_datetime: string; participant_ids: string[] } | null;
  prioridade_lead?: string;
  risco?: string;
};

const reuniaoStatusColors: Record<string, string> = {
  "Agendada": "bg-green-500/15 text-green-700 border-green-300",
  "Precisa agendar": "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  "Reagendar": "bg-orange-500/15 text-orange-700 border-orange-300",
  "Não tem": "bg-muted text-muted-foreground",
};

const papelColors: Record<string, string> = {
  SDR: "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  Comercial: "bg-blue-500/15 text-blue-700 border-blue-300",
  Administrativo: "bg-green-500/15 text-green-700 border-green-300",
};

const papelEmojis: Record<string, string> = {
  SDR: "🟡",
  Comercial: "🔵",
  Administrativo: "🟢",
};

const prioridadeColors: Record<string, string> = {
  Alta: "bg-red-500/15 text-red-700 border-red-300",
  Média: "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  Baixa: "bg-green-500/15 text-green-700 border-green-300",
};

const riscoColors: Record<string, string> = {
  Alto: "bg-red-500/15 text-red-700 border-red-300",
  Médio: "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  Baixo: "bg-green-500/15 text-green-700 border-green-300",
};

export function LeadTranscription({ leadId, initialTranscription }: LeadTranscriptionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recalcScore = useRecalculateLeadScore();
  const [text, setText] = useState(initialTranscription || "");
  const [draftMaterialId, setDraftMaterialId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (initialTranscription) {
      setText(initialTranscription);
    }
  }, [initialTranscription]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [draft, setDraft] = useState<AnalysisResult | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const { progress: analyzeProgress, remainingMs: analyzeRemaining, isOvertime: analyzeOvertime } = useAIProgress(loading, 12000);
  const { progress: confirmProgress, remainingMs: confirmRemaining, isOvertime: confirmOvertime } = useAIProgress(confirming, 8000);

  const { data: users = [] } = useQuery({
    queryKey: ["users-select"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name, funcao").eq("status", "active").order("name");
      return data || [];
    },
  });

  // Save / update transcription content as a draft material so it never gets lost.
  const saveDraftMaterial = async (content: string, sourceFileName?: string) => {
    if (!content.trim()) return null;
    const now = new Date();
    const stamp = now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const title = sourceFileName
      ? `Transcrição (rascunho) - ${sourceFileName} - ${stamp}`
      : `Transcrição (rascunho) - ${stamp}`;

    if (draftMaterialId) {
      const { error } = await supabase
        .from("lead_materials")
        .update({ content, title })
        .eq("id", draftMaterialId);
      if (error) {
        console.error("Error updating draft material:", error);
        return draftMaterialId;
      }
      queryClient.invalidateQueries({ queryKey: ["lead-materials", leadId] });
      return draftMaterialId;
    }

    const { data, error } = await supabase
      .from("lead_materials")
      .insert({
        lead_id: leadId,
        title,
        type: "transcricao",
        content,
        created_by: user?.id || null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("Error creating draft material:", error);
      toast.error("Não foi possível salvar o rascunho da transcrição.");
      return null;
    }
    setDraftMaterialId(data.id);
    queryClient.invalidateQueries({ queryKey: ["lead-materials", leadId] });
    return data.id;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-selecting same file later

    const name = file.name.toLowerCase();
    const isTxt = name.endsWith(".txt");
    const isRich = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");

    if (!isTxt && !isRich) {
      toast.error("Formato não suportado. Envie .txt, .pdf, .doc ou .docx");
      return;
    }

    try {
      let extracted = "";
      if (isTxt) {
        extracted = await file.text();
      } else {
        setExtracting(true);
        const fd = new FormData();
        fd.append("file", file);
        const { data, error } = await supabase.functions.invoke("extract-transcription-text", {
          body: fd,
        });
        if (error || !data?.text) {
          const msg = (data as any)?.error || error?.message || "Falha ao extrair texto do arquivo.";
          toast.error(msg);
          return;
        }
        extracted = data.text as string;
      }

      if (!extracted.trim()) {
        toast.error("Arquivo sem texto legível.");
        return;
      }

      setText(extracted);
      const id = await saveDraftMaterial(extracted, file.name);
      if (id) toast.success("Transcrição salva nos Materiais como rascunho.");
    } catch (err) {
      console.error("File upload error:", err);
      toast.error("Erro ao ler o arquivo.");
    } finally {
      setExtracting(false);
    }
  };


  const processTranscription = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setDraft(null);
    setConfirmed(false);

    // Always persist what the user has, BEFORE calling the AI, so it never gets lost.
    await saveDraftMaterial(text);

    try {
      const { data, error } = await supabase.functions.invoke("process-transcription", {
        body: { lead_id: leadId, transcription_text: text, user_id: user?.id, mode: "analyze" },
      });

      if (error) {
        let message = "Erro ao processar transcrição";
        try {
          const body = typeof error === "object" && "context" in error
            ? await (error as any).context?.json?.().catch(() => null)
            : null;
          message = body?.error || data?.error || error.message || message;
        } catch { /* keep default */ }

        if (message.includes("créditos") || message.includes("credits") || message.includes("Créditos")) {
          toast.error("Créditos insuficientes. Verifique a configuração da chave OpenAI.");
        } else if (message.includes("Rate limit") || message.includes("429")) {
          toast.error("Limite de requisições atingido. Tente novamente em alguns minutos.");
        } else {
          toast.error(message);
        }
        return;
      }

      if (data?.error) { toast.error(data.error); return; }

      const result = data as AnalysisResult;
      const initTask = (t: TaskDraft): TaskDraft => ({
        ...t,
        // Garante que a data nunca esteja no passado e respeita a complexidade (prioridade)
        data_execucao: sanitizeDueDate(t.data_execucao, t.prioridade),
        is_reuniao: t.is_reuniao ?? (t.agendamento?.tipo === "reuniao"),
        horario_inicio: t.horario_inicio || "09:00",
        horario_fim: t.horario_fim || "10:00",
      });
      result.tarefas_franquia = result.tarefas_franquia.map(initTask);
      result.tarefas_lead = result.tarefas_lead.map(initTask);

      setDraft(result);
      toast.success("Análise gerada! Revise e edite antes de confirmar.");
    } catch (err: any) {
      console.error("LeadTranscription error:", err);
      toast.error("Não foi possível processar. Verifique a configuração da IA.");
    } finally {
      setLoading(false);
    }
  };

  const confirmTasks = async () => {
    if (!draft) return;
    setConfirming(true);

    try {
      const { data, error } = await supabase.functions.invoke("process-transcription", {
        body: { lead_id: leadId, user_id: user?.id, mode: "confirm", analysis: draft },
      });

      if (error) {
        const body = typeof error === "object" && "context" in error
          ? await (error as any).context?.json?.().catch(() => null)
          : null;
        toast.error(body?.error || error.message || "Erro ao gerar tarefas");
        return;
      }

      if (data?.error) { toast.error(data.error); return; }

      const today = new Date().toLocaleDateString("pt-BR");
      const finalTitle = `Transcrição de Reunião - ${today}`;

      // Promote the existing draft material (or insert if for some reason it's missing).
      if (draftMaterialId) {
        const { error: matError } = await supabase
          .from("lead_materials")
          .update({ title: finalTitle, content: text })
          .eq("id", draftMaterialId);
        if (matError) {
          console.error("Error promoting draft material:", matError);
          toast.error("Erro ao salvar transcrição nos materiais.");
        } else {
          queryClient.invalidateQueries({ queryKey: ["lead-materials", leadId] });
          setDraftMaterialId(null);
        }
      } else {
        const { error: matError } = await supabase.from("lead_materials").insert({
          lead_id: leadId,
          title: finalTitle,
          type: "transcricao",
          content: text,
          created_by: user?.id || null,
        });
        if (matError) {
          console.error("Error saving transcription as material:", matError);
          toast.error("Erro ao salvar transcrição nos materiais.");
        } else {
          queryClient.invalidateQueries({ queryKey: ["lead-materials", leadId] });
        }
      }

      setConfirmed(true);
      // Regra automática: nova transcrição confirmada → score recalcula
      recalcScore.mutate(leadId);
      toast.success(`${data.tasks_created?.length || 0} tarefas criadas! ${data.notifications_sent || 0} notificações enviadas.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao confirmar tarefas.");
    } finally {
      setConfirming(false);
    }
  };

  const updateTask = (tipo: "lead" | "franquia", index: number, updates: Partial<TaskDraft>) => {
    if (!draft) return;
    const key = tipo === "lead" ? "tarefas_lead" : "tarefas_franquia";
    const tasks = [...draft[key]];
    tasks[index] = { ...tasks[index], ...updates };
    setDraft({ ...draft, [key]: tasks });
  };

  const removeTask = (tipo: "lead" | "franquia", index: number) => {
    if (!draft) return;
    const key = tipo === "lead" ? "tarefas_lead" : "tarefas_franquia";
    setDraft({ ...draft, [key]: draft[key].filter((_, i) => i !== index) });
  };

  const removeAtencao = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, pontos_atencao: draft.pontos_atencao.filter((_, i) => i !== index) });
  };

  const addNewTask = (tipo: "lead" | "franquia", papel?: string) => {
    if (!draft) return;
    const defaultPriority = "Média";
    const defaultDate = computeDueDateByPriority(defaultPriority);
    const newTask: TaskDraft = {
      titulo: "",
      descricao: "",
      descricao_detalhada: "",
      criterio_conclusao: "",
      responsavel: "",
      tipo,
      papel: papel || (tipo === "franquia" ? "SDR" : "SDR"),
      prioridade: defaultPriority,
      prazo_sugerido_dias: 2,
      impacto: "",
      origem: tipo === "lead" ? "Cobrança ao Lead" : "manual",
      passos_execucao: [],
      agendamento: { deve_agendar: false },
      data_execucao: defaultDate,
      is_reuniao: false,
      horario_inicio: "09:00",
      horario_fim: "10:00",
    };
    const key = tipo === "lead" ? "tarefas_lead" : "tarefas_franquia";
    const updated = [...draft[key], newTask];
    setDraft({ ...draft, [key]: updated });
    setEditingTask(`${tipo}-${updated.length - 1}`);
  };

  const updateStep = (tipo: "lead" | "franquia", taskIdx: number, stepIdx: number, value: string) => {
    if (!draft) return;
    const key = tipo === "lead" ? "tarefas_lead" : "tarefas_franquia";
    const tasks = [...draft[key]];
    const passos = [...tasks[taskIdx].passos_execucao];
    passos[stepIdx] = value;
    tasks[taskIdx] = { ...tasks[taskIdx], passos_execucao: passos };
    setDraft({ ...draft, [key]: tasks });
  };

  const addStep = (tipo: "lead" | "franquia", taskIdx: number) => {
    if (!draft) return;
    const key = tipo === "lead" ? "tarefas_lead" : "tarefas_franquia";
    const tasks = [...draft[key]];
    tasks[taskIdx] = { ...tasks[taskIdx], passos_execucao: [...tasks[taskIdx].passos_execucao, ""] };
    setDraft({ ...draft, [key]: tasks });
  };

  const removeStep = (tipo: "lead" | "franquia", taskIdx: number, stepIdx: number) => {
    if (!draft) return;
    const key = tipo === "lead" ? "tarefas_lead" : "tarefas_franquia";
    const tasks = [...draft[key]];
    tasks[taskIdx] = { ...tasks[taskIdx], passos_execucao: tasks[taskIdx].passos_execucao.filter((_, i) => i !== stepIdx) };
    setDraft({ ...draft, [key]: tasks });
  };

  const taskKey = (tipo: string, idx: number) => `${tipo}-${idx}`;

  // Group franquia tasks by papel
  const groupedByRole = (tasks: TaskDraft[]) => {
    const groups: Record<string, { tasks: TaskDraft[]; indices: number[] }> = {};
    tasks.forEach((t, i) => {
      const papel = t.papel || "Outros";
      if (!groups[papel]) groups[papel] = { tasks: [], indices: [] };
      groups[papel].tasks.push(t);
      groups[papel].indices.push(i);
    });
    return groups;
  };

  const renderTeamTaskCard = (task: TaskDraft, idx: number) => {
    const key = taskKey("franquia", idx);
    const isEditing = editingTask === key;
    const isExpanded = expandedTask === key;

    // Resolve nome -> usuário cadastrado para exibir função real do CRM
    const resolvedUser = users.find(u => {
      if (!task.responsavel) return false;
      const resp = task.responsavel.toLowerCase().split("—")[0].trim();
      return u.name.toLowerCase().includes(resp) || resp.includes(u.name.toLowerCase());
    });
    const funcaoRealCrm = (resolvedUser as any)?.funcao || null;
    const papelIa = task.papel || "—";
    const papelDivergente = funcaoRealCrm && papelIa !== "—" &&
      funcaoRealCrm.toLowerCase() !== papelIa.toLowerCase();

    const checklistInsuficiente = (task.passos_execucao || []).filter(p => p.trim()).length < 3;

    return (
      <div key={key} className={`border rounded-lg p-3 bg-background space-y-2 ${papelDivergente ? "border-amber-300" : ""} ${checklistInsuficiente ? "ring-1 ring-amber-200" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input value={task.titulo} onChange={e => updateTask("franquia", idx, { titulo: e.target.value })} className="mb-1" placeholder="Verbo + ação clara (ex: Enviar contrato COF)" />
            ) : (
              <p className="font-medium text-sm">{task.titulo}</p>
            )}

            {/* Linha de identificação do executor: nome | papel IA | função CRM */}
            <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
              {isEditing ? (
                <Select value={task.responsavel} onValueChange={v => updateTask("franquia", idx, { responsavel: v })}>
                  <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Responsável" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name} {(u as any).funcao ? `· ${(u as any).funcao}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="text-xs font-medium">
                  👤 {resolvedUser?.name || task.responsavel || "A definir"}
                </Badge>
              )}

              {/* Badge: papel sugerido pela IA */}
              <Badge variant="outline" className={`text-xs ${papelColors[papelIa] || ""}`}>
                Papel IA: {papelIa}
              </Badge>

              {/* Badge: função organizacional real do CRM */}
              {funcaoRealCrm && (
                <Badge
                  variant="outline"
                  className={`text-xs ${papelDivergente ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                  title={papelDivergente
                    ? `A IA sugeriu ${papelIa}, mas o usuário cadastrado é ${funcaoRealCrm}. Confirme antes de salvar.`
                    : "Função organizacional do executor confere com o papel sugerido"}
                >
                  Função CRM: {funcaoRealCrm}{papelDivergente && " ⚠️"}
                </Badge>
              )}

              {isEditing ? (
                <Select value={task.prioridade} onValueChange={v => updateTask("franquia", idx, { prioridade: v })}>
                  <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="text-xs capitalize">{task.prioridade}</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTask(isEditing ? null : key)}>
              {isEditing ? <Save className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTask("franquia", idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedTask(isExpanded ? null : key)}>
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Aviso de divergência papel IA vs função CRM */}
        {papelDivergente && !isEditing && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            ⚠️ A IA sugeriu papel <strong>{papelIa}</strong>, mas <strong>{resolvedUser?.name}</strong> é cadastrado como <strong>{funcaoRealCrm}</strong>. Revise antes de confirmar.
          </div>
        )}

        {isEditing && (
          <>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Descrição detalhada (contexto + resultado esperado)</Label>
              <Textarea
                value={task.descricao_detalhada || task.descricao}
                onChange={e => updateTask("franquia", idx, { descricao_detalhada: e.target.value, descricao: e.target.value })}
                rows={3}
                className="text-sm"
                placeholder="Explique para alguém que não estava na reunião: por que essa tarefa existe e qual o resultado esperado."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Critério de Conclusão</Label>
              <Input
                value={task.criterio_conclusao || ""}
                onChange={e => updateTask("franquia", idx, { criterio_conclusao: e.target.value })}
                className="h-8 text-xs"
                placeholder="Pronto quando..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Data de execução <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={task.data_execucao || ""}
                  onChange={e => updateTask("franquia", idx, { data_execucao: e.target.value })}
                  className="h-8 text-xs"
                  required
                />
                {!task.data_execucao && <p className="text-xs text-destructive">Data obrigatória</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Horário</Label>
                <div className="flex gap-1 items-center">
                  <Input type="time" value={task.horario_inicio || ""} onChange={e => updateTask("franquia", idx, { horario_inicio: e.target.value })} className="h-8 text-xs" placeholder="Início" />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input type="time" value={task.horario_fim || ""} onChange={e => updateTask("franquia", idx, { horario_fim: e.target.value })} className="h-8 text-xs" placeholder="Fim" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={task.is_reuniao || false} onCheckedChange={v => updateTask("franquia", idx, { is_reuniao: v })} />
              <Label className="text-xs">Marcar como reunião</Label>
            </div>
          </>
        )}

        {!isEditing && (
          <>
            {(task.descricao_detalhada || task.descricao) && (
              <p className="text-xs text-muted-foreground leading-relaxed">{task.descricao_detalhada || task.descricao}</p>
            )}
            <div className="flex flex-wrap gap-1.5 items-center">
              {task.data_execucao && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(task.data_execucao + "T12:00:00").toLocaleDateString("pt-BR")}
                </Badge>
              )}
              {(task.horario_inicio || task.horario_fim) && (
                <Badge variant="outline" className={`text-xs ${task.is_reuniao ? "bg-primary/10 text-primary" : ""}`}>
                  {task.is_reuniao ? "Reunião " : ""}{task.horario_inicio || "?"} - {task.horario_fim || "?"}
                </Badge>
              )}
              {checklistInsuficiente && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  ⚠️ Mínimo 3 passos
                </Badge>
              )}
            </div>
          </>
        )}

        {isExpanded && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <p className="text-xs font-medium mb-1.5">Passos de Execução {checklistInsuficiente && <span className="text-amber-600">(mínimo 3)</span>}:</p>
              <div className="space-y-1">
                {task.passos_execucao.map((passo, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground w-4">{pIdx + 1}.</span>
                    {isEditing ? (
                      <>
                        <Input value={passo} onChange={e => updateStep("franquia", idx, pIdx, e.target.value)} className="h-7 text-xs flex-1" />
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeStep("franquia", idx, pIdx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs">{passo}</span>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addStep("franquia", idx)}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar passo
                  </Button>
                )}
              </div>
            </div>
            {task.criterio_conclusao && (
              <div className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
                <p className="text-xs font-medium text-emerald-800 mb-0.5">✅ Critério de Conclusão</p>
                <p className="text-xs text-emerald-700">{task.criterio_conclusao}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLeadTaskCard = (task: TaskDraft, idx: number) => {
    const key = taskKey("lead", idx);
    const isEditing = editingTask === key;

    return (
      <div key={key} className="border rounded-lg p-3 bg-background space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <>
                <div className="space-y-1 mb-1">
                  <Label className="text-xs font-medium">Ação do Lead</Label>
                  <Input value={task.titulo} onChange={e => updateTask("lead", idx, { titulo: e.target.value })} className="h-8 text-xs" placeholder="O que o lead precisa fazer" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Objetivo / Por que importa</Label>
                  <Textarea value={task.descricao_detalhada || task.descricao} onChange={e => updateTask("lead", idx, { descricao_detalhada: e.target.value, descricao: e.target.value })} rows={2} className="text-xs" />
                </div>
                <div className="space-y-1 mt-2">
                  <Label className="text-xs font-medium">Critério de Conclusão</Label>
                  <Input value={task.criterio_conclusao || ""} onChange={e => updateTask("lead", idx, { criterio_conclusao: e.target.value })} className="h-8 text-xs" placeholder="Pronto quando o lead..." />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Prioridade</Label>
                    <Select value={task.prioridade || "media"} onValueChange={v => updateTask("lead", idx, { prioridade: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Data</Label>
                    <Input type="date" value={task.data_execucao || ""} onChange={e => updateTask("lead", idx, { data_execucao: e.target.value })} className="h-8 text-xs" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="font-medium text-sm">{task.titulo}</p>
                {(task.descricao_detalhada || task.descricao) && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.descricao_detalhada || task.descricao}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-800 border-yellow-200">
                    🧑‍💼 Cobrança via SDR do Lead
                  </Badge>
                  {task.prioridade && <Badge variant="outline" className="text-xs capitalize">{task.prioridade}</Badge>}
                  {task.data_execucao && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(task.data_execucao + "T12:00:00").toLocaleDateString("pt-BR")}
                    </Badge>
                  )}
                </div>
                {task.criterio_conclusao && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1 mt-1.5">
                    <p className="text-[11px] text-emerald-700">✅ {task.criterio_conclusao}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTask(isEditing ? null : key)}>
              {isEditing ? <Save className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTask("lead", idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <AIProcessingModal
        open={loading}
        progress={analyzeProgress}
        remainingMs={analyzeRemaining}
        isOvertime={analyzeOvertime}
        title="Processando Reunião"
        statusMessages={TRANSCRIPTION_STATUS}
        footerText="IA analisando transcrição completa"
      />
      <AIProcessingModal
        open={confirming}
        progress={confirmProgress}
        remainingMs={confirmRemaining}
        isOvertime={confirmOvertime}
        title="Confirmando Tarefas"
        statusMessages={CONFIRM_STATUS}
        footerText="Sincronizando tarefas e notificações"
      />

      {/* Step 1: Input */}
      {!confirmed && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Cole a conversa de WhatsApp ou transcrição de reunião. A IA vai identificar a etapa no funil, sugerir movimentação e gerar tarefas distribuídas por papel (SDR, Comercial, Administrativo).
          </p>
          <Textarea
            placeholder="Cole a conversa aqui..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="mb-2"
            disabled={loading}
          />
          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={processTranscription} disabled={!text.trim() || loading || extracting}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Processar
            </Button>
            <label>
              <Button variant="outline" asChild disabled={extracting}>
                <span>
                  {extracting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  {extracting ? "Extraindo..." : "Enviar arquivo"}
                </span>
              </Button>
              <input
                type="file"
                accept=".txt,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={handleFileUpload}
                disabled={extracting}
              />
            </label>
            {draftMaterialId && (
              <span className="text-xs text-muted-foreground">
                ✓ Rascunho salvo em Materiais
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aceita .txt, .pdf, .doc e .docx. A transcrição é salva automaticamente nos Materiais ao processar ou enviar arquivo.
          </p>
        </div>
      )}

      {/* Step 2: Editable Preview */}
      {draft && !confirmed && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">📋 Análise CRM — Revise e Edite</h3>
          </div>

          {/* Funnel Position + Priority/Risk */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" /> Posição no Funil
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                {draft.etapa_atual}
              </Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <Badge variant="outline" className="text-xs bg-green-500/15 text-green-700 border-green-300">
                {draft.proxima_movimentacao}
              </Badge>
            </div>

            {/* Priority & Risk */}
            <div className="flex items-center gap-3 flex-wrap">
              {draft.prioridade_lead && (
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Prioridade:</span>
                  <Badge variant="outline" className={`text-xs ${prioridadeColors[draft.prioridade_lead] || ""}`}>
                    {draft.prioridade_lead}
                  </Badge>
                </div>
              )}
              {draft.risco && (
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Risco:</span>
                  <Badge variant="outline" className={`text-xs ${riscoColors[draft.risco] || ""}`}>
                    {draft.risco}
                  </Badge>
                </div>
              )}
            </div>

            {/* Reunião status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Reunião:</span>
              <Badge variant="outline" className={`text-xs ${reuniaoStatusColors[draft.reuniao.status] || ""}`}>
                {draft.reuniao.status}
              </Badge>
              {draft.reuniao.data && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {draft.reuniao.data}
                </Badge>
              )}
              {draft.reuniao.responsavel && (
                <span className="text-xs text-muted-foreground">({draft.reuniao.responsavel})</span>
              )}
            </div>
          </div>

          {/* Pontos de Atenção */}
          {draft.pontos_atencao.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Pontos de Atenção
              </h4>
              {draft.pontos_atencao.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm pl-1 group">
                  <span className="text-destructive">•</span>
                  <span className="flex-1">{r}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeAtencao(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Tasks - Time Interno grouped by role */}
          {(() => {
            const groups = groupedByRole(draft.tarefas_franquia);
            const roleOrder = ["SDR", "Comercial", "Administrativo"];
            const sortedRoles = [...roleOrder];
            Object.keys(groups).forEach(r => { if (!sortedRoles.includes(r)) sortedRoles.push(r); });

            return (
              <div className="space-y-3">
                {sortedRoles.map(role => (
                  <div key={role} className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-1.5">
                      <ListTodo className="h-4 w-4 text-primary" />
                      <span>{papelEmojis[role] || "📋"} Tarefas — {role}</span>
                      <Badge variant="outline" className={`text-xs ml-1 ${papelColors[role] || ""}`}>
                        {groups[role]?.tasks.length || 0}
                      </Badge>
                    </h4>
                    {groups[role]?.tasks.map((t, localIdx) => {
                      const globalIdx = groups[role].indices[localIdx];
                      return renderTeamTaskCard(t, globalIdx);
                    })}
                    <Button variant="ghost" size="sm" className="w-full border border-dashed" onClick={() => addNewTask("franquia", role)}>
                      <Plus className="h-3 w-3 mr-1" /> Nova Tarefa {role}
                    </Button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Tasks - Lead */}
          {(
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-1.5">
                <ListTodo className="h-4 w-4 text-primary" /> 🧑‍💼 Tarefas do Lead ({draft.tarefas_lead.length})
              </h4>
              {draft.tarefas_lead.map((t, i) => renderLeadTaskCard(t, i))}
              <Button variant="ghost" size="sm" className="w-full border border-dashed" onClick={() => addNewTask("lead")}>
                <Plus className="h-3 w-3 mr-1" /> Nova Tarefa do Lead
              </Button>
            </div>
          )}

          {/* Próxima Ação */}
          {draft.proxima_acao_recomendada && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" /> Próxima Ação Recomendada
              </h4>
              <p className="text-sm">{draft.proxima_acao_recomendada}</p>
            </div>
          )}

          {/* Meeting */}
          {draft.next_meeting && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Reunião sugerida: {draft.next_meeting.title} — {draft.next_meeting.start_datetime}</span>
              </div>
            </div>
          )}

          {/* Confirm Button */}
          <div className="flex gap-2 pt-2 border-t">
            {(() => {
              const teamTasks = draft.tarefas_franquia;
              const missingDates = teamTasks.some(t => !t.data_execucao);
              const totalTasks = draft.tarefas_lead.length + draft.tarefas_franquia.length;
              return (
                <>
                  {missingDates && (
                    <p className="text-xs text-destructive w-full mb-1">Todas as tarefas do time devem ter uma data de execução.</p>
                  )}
                  <Button onClick={confirmTasks} disabled={confirming || missingDates} className="flex-1">
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Gerar Tarefas ({totalTasks})
                  </Button>
                </>
              );
            })()}
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmed */}
      {confirmed && (
        <div className="border rounded-lg p-6 bg-muted/30 text-center space-y-3">
          <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
          <h3 className="font-semibold">Tarefas Geradas com Sucesso!</h3>
          <p className="text-sm text-muted-foreground">
            As tarefas foram criadas, agendamentos inseridos no calendário e notificações enviadas aos responsáveis.
            Confira na aba <strong>Tarefas</strong> e a transcrição em <strong>Materiais</strong>.
          </p>
          <Button variant="outline" onClick={() => { setDraft(null); setConfirmed(false); setText(""); setDraftMaterialId(null); }}>
            Processar Nova Conversa
          </Button>
        </div>
      )}
    </div>
  );
}
