import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import OpenAI from "https://esm.sh/openai@4.73.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function findUserByName(name: string, users: { id: string; name: string }[]): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  const exact = users.find(u => u.name.toLowerCase() === lower);
  if (exact) return exact.id;
  const partial = users.find(u => u.name.toLowerCase().includes(lower) || lower.includes(u.name.toLowerCase()));
  return partial?.id ?? null;
}

const STOPWORDS = new Set(["a","o","os","as","e","de","do","da","dos","das","para","pra","no","na","nos","nas","em","um","uma","com","sem","ao","aos","que","se"]);
function normalizeTaskTitle(text: string): string {
  return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokenizeTitle(text: string): Set<string> {
  return new Set(normalizeTaskTitle(text).split(" ").filter(t => t.length > 1 && !STOPWORDS.has(t)));
}
function titleSimilarity(a: string, b: string): number {
  const na = normalizeTaskTitle(a), nb = normalizeTaskTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = tokenizeTitle(a), tb = tokenizeTitle(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  return inter / (ta.size + tb.size - inter);
}

const priorityMap: Record<string, string> = { alta: "high", media: "medium", média: "medium", baixa: "low" };

// === Helpers de data (espelham src/lib/task-due-date.ts) ===
const PRIORITY_DAYS: Record<string, number> = {
  high: 0, alta: 0, urgente: 0, urgent: 0,
  medium: 2, media: 2, "média": 2,
  low: 5, baixa: 5,
};
function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}
function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  if (days <= 0) {
    while (isWeekend(d)) d.setDate(d.getDate() + 1);
    return d;
  }
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}
function computeDueDateByPriority(priority: string | undefined | null, from: Date = new Date()): string {
  const key = (priority || "").toString().toLowerCase().trim();
  const days = PRIORITY_DAYS[key] ?? 2;
  return localDateString(addBusinessDays(from, days));
}
function isDateInPast(yyyyMmDd: string): boolean {
  if (!yyyyMmDd) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  return d.getTime() < today.getTime();
}
function sanitizeDueDate(date: string | null | undefined, priority: string | undefined | null): string {
  if (!date || isDateInPast(date) || isNaN(new Date(`${date}T00:00:00`).getTime())) {
    return computeDueDateByPriority(priority);
  }
  return date;
}

const FUNNEL_STAGES = [
  "Dados Incompletos", "Qualificação", "Material Reunião", "Reunião Agendada",
  "Reunião do Dia", "Reagendamento", "Envio de COF", "Stand-By",
  "Contrato", "Fechamento", "Realocar no CRM", "Ganho", "Perdido",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { error: authError } = await supabaseAuth.auth.getClaims(token);
    if (authError) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { lead_id, transcription_text, user_id, mode = "analyze", analysis } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch users for name matching (incluindo função organizacional)
    const { data: users } = await supabase.from("users").select("id, name, email, funcao");
    const userList = users || [];

    // Fetch lead info (incluindo SDR responsável para fallback de tarefas do lead)
    const { data: lead } = await supabase
      .from("leads")
      .select("name, sdr_responsible_id, commercial_responsible_id")
      .eq("id", lead_id)
      .single();

    // ===== MODE: CONFIRM =====
    if (mode === "confirm") {
      if (!analysis) {
        return new Response(JSON.stringify({ error: "analysis required for confirm mode" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tasksCreated: any[] = [];
      const tasksSkipped: any[] = [];
      const notifiedUserIds = new Set<string>();

      // Build unified task list from tarefas_franquia (time interno) and tarefas_lead
      const teamTasks = (analysis.tarefas_franquia || []).map((t: any) => ({ ...t, tipo: "franquia" }));
      const leadTasks = (analysis.tarefas_lead || []).map((t: any) => ({
        titulo: t.titulo || t.acao || t.tarefa || "",
        descricao: t.descricao || t.objetivo || "",
        descricao_detalhada: t.descricao_detalhada || t.objetivo || t.descricao || "",
        criterio_conclusao: t.criterio_conclusao || "",
        responsavel: t.responsavel || "",
        tipo: "lead",
        papel: t.papel || "SDR",
        prioridade: t.prioridade || "media",
        prazo_sugerido_dias: t.prazo_sugerido_dias || 7,
        impacto: t.impacto || "medio",
        origem: t.origem || "Cobrança ao Lead",
        passos_execucao: t.passos_execucao || [],
        agendamento: t.agendamento || { deve_agendar: false },
        data_execucao: t.data_execucao || "",
        is_reuniao: t.is_reuniao || false,
        horario_inicio: t.horario_inicio,
        horario_fim: t.horario_fim,
      }));

      const allTasks = [...leadTasks, ...teamTasks];

      // Pre-fetch existing pending tasks for this lead (for duplicate detection)
      const { data: existingPending } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("lead_id", lead_id)
        .neq("status", "completed");
      const existingTasks = existingPending || [];

      for (const task of allTasks) {
        // Duplicate check
        const dup = existingTasks.find((et) => titleSimilarity(task.titulo, et.title || "") >= 0.85);
        if (dup) {
          tasksSkipped.push({ title: task.titulo, existing_id: dup.id, existing_title: dup.title, reason: "duplicate" });
          continue;
        }

        // === Resolução do executor ===
        // Tarefas do lead → SDR responsável do lead (cobra o lead).
        // Tarefas internas → usuário casado pelo nome; fallback para criador.
        let assignedId: string;
        if (task.tipo === "lead") {
          assignedId = lead?.sdr_responsible_id
            || findUserByName(task.responsavel, userList)
            || user_id;
        } else {
          assignedId = findUserByName(task.responsavel, userList) || user_id;
        }

        // Recupera função organizacional real do executor resolvido
        const executorUser = userList.find((u: any) => u.id === assignedId);
        const funcaoRealCrm = (executorUser as any)?.funcao || null;
        const papelSugeridoIa = task.papel
          || (task.tipo === "lead" ? "SDR" : null);

        // Sanitiza: nunca aceita data no passado; recalcula pela prioridade se inválida
        const rawDue = task.data_execucao || task.agendamento?.prazo_final || "";
        const dueDate = sanitizeDueDate(rawDue, task.prioridade);
        const priority = priorityMap[task.prioridade?.toLowerCase()] || "medium";

        // Format description: descrição detalhada + checklist + critério
        const descParts: string[] = [];
        const detailed = task.descricao_detalhada || task.descricao || "";
        if (detailed) descParts.push(detailed);
        if (task.passos_execucao?.length) {
          descParts.push("\n### Passos de Execução\n" + task.passos_execucao.map((p: string) => `- [ ] ${p}`).join("\n"));
        }
        if (task.criterio_conclusao) {
          descParts.push(`\n### ✅ Critério de Conclusão\n${task.criterio_conclusao}`);
        }
        const description = descParts.join("\n");

        const taskMetadata = {
          papel_sugerido_ia: papelSugeridoIa,
          funcao_real_crm: funcaoRealCrm,
          criterio_conclusao: task.criterio_conclusao || null,
          descricao_detalhada: task.descricao_detalhada || null,
          origem_transcricao: true,
          tipo_origem: task.tipo, // "lead" ou "franquia"
          responsavel_sugerido: task.responsavel || null,
        };

        const { data: insertedTask, error } = await supabase.from("tasks").insert({
          title: task.titulo,
          description,
          priority,
          assigned_to: assignedId,
          created_by: user_id,
          lead_id,
          due_date: dueDate,
          status: "pending",
          type: "follow_up",
          metadata: taskMetadata,
        }).select("id").single();

        if (!error) {
          tasksCreated.push({
            id: insertedTask?.id,
            title: task.titulo,
            assigned_to_name: executorUser?.name || task.responsavel,
            papel_ia: papelSugeridoIa,
            funcao_crm: funcaoRealCrm,
            tipo: task.tipo,
            impacto: task.impacto,
            origem: task.origem,
          });
          notifiedUserIds.add(assignedId);
          // Add freshly created task to dedup pool to avoid intra-batch duplicates
          existingTasks.push({ id: insertedTask?.id || "", title: task.titulo });

          // Create calendar event if scheduling is needed or task is a meeting
          if (task.agendamento?.deve_agendar || task.is_reuniao) {
            const eventDate = sanitizeDueDate(task.data_execucao || task.agendamento?.data_sugerida || "", task.prioridade);
            const startTime = task.horario_inicio || "09:00";
            const endTime = task.horario_fim || "10:00";
            const startDatetime = `${eventDate}T${startTime}:00.000Z`;
            const endDatetime = `${eventDate}T${endTime}:00.000Z`;

            const eventDescParts = [task.descricao || ""];
            if (task.passos_execucao?.length) {
              eventDescParts.push("\n### Passos de Execução\n" + task.passos_execucao.map((p: string) => `- [ ] ${p}`).join("\n"));
            }
            eventDescParts.push(`\n**Prioridade:** ${task.prioridade || "media"} | **Impacto:** ${task.impacto || "medio"}`);
            if (task.origem) eventDescParts.push(`**Origem:** ${task.origem}`);
            eventDescParts.push(`**Responsável:** ${task.responsavel || "N/A"}`);

            await supabase.from("calendar_events").insert({
              title: task.agendamento?.descricao_agenda || task.titulo,
              start_datetime: startDatetime,
              end_datetime: endDatetime,
              responsible_user_id: assignedId,
              created_by: user_id,
              lead_id,
              event_type: task.is_reuniao ? "meeting" : (task.agendamento?.tipo === "reuniao" ? "meeting" : "task"),
              status: "scheduled",
              description: eventDescParts.join("\n"),
            });
          }
        }
      }

      // Insert meeting if present
      let meetingScheduled = null;
      if (analysis.next_meeting) {
        const m = analysis.next_meeting;
        const participantIds = (m.participant_ids || []).map((nameOrId: string) => {
          return findUserByName(nameOrId, userList) || nameOrId;
        });

        const meetingDescParts = [];
        if (analysis.etapa_atual) {
          meetingDescParts.push(`**Etapa Atual:** ${analysis.etapa_atual}`);
        }
        if (analysis.proxima_movimentacao) {
          meetingDescParts.push(`**Próxima Movimentação:** ${analysis.proxima_movimentacao}`);
        }
        if (analysis.pontos_atencao?.length) {
          meetingDescParts.push(`**Pontos de Atenção:** ${analysis.pontos_atencao.join(", ")}`);
        }

        const { error } = await supabase.from("calendar_events").insert({
          title: m.title,
          start_datetime: m.start_datetime,
          end_datetime: m.end_datetime,
          responsible_user_id: user_id,
          created_by: user_id,
          lead_id,
          event_type: "meeting",
          status: "scheduled",
          attendees: participantIds,
          description: meetingDescParts.join("\n") || null,
        });
        if (!error) {
          meetingScheduled = { title: m.title, date: m.start_datetime };
          participantIds.forEach((id: string) => notifiedUserIds.add(id));
        }
      }

      // Send notifications
      const notifications = [];
      for (const uid of notifiedUserIds) {
        if (uid === user_id) continue;
        notifications.push({
          user_id: uid,
          type: "task_created",
          message: `Novas tarefas foram criadas a partir da transcrição da reunião do lead "${lead?.name || "Lead"}"`,
          metadata: { lead_id, source: "transcription" },
        });
      }
      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }

      // Save formatted summary as a note
      const summaryParts = [];
      summaryParts.push(`## 📊 Análise de Reunião\n`);
      if (analysis.etapa_atual) {
        summaryParts.push(`**Etapa Atual:** ${analysis.etapa_atual} → **Próxima:** ${analysis.proxima_movimentacao || "N/A"}`);
      }
      if (analysis.reuniao) {
        summaryParts.push(`**Reunião:** ${analysis.reuniao.status} ${analysis.reuniao.data ? `| ${analysis.reuniao.data}` : ""}`);
      }
      if (analysis.momento_lead || analysis.prioridade_lead) {
        summaryParts.push(`**Momento do Lead:** ${analysis.momento_lead || analysis.prioridade_lead}`);
        if (analysis.momento_lead_justificativa) summaryParts.push(`> ${analysis.momento_lead_justificativa}`);
      }
      if (analysis.risco_perda || analysis.risco) {
        summaryParts.push(`**Risco de Perda:** ${analysis.risco_perda || analysis.risco}`);
        if (analysis.risco_motivo) summaryParts.push(`> ${analysis.risco_motivo}`);
      }
      if (analysis.pontos_atencao?.length) {
        summaryParts.push(`\n**Pontos de Atenção:** ${analysis.pontos_atencao.join(", ")}`);
      }
      if (tasksCreated.length) {
        summaryParts.push(`\n**Tarefas criadas:** ${tasksCreated.length}`);
        tasksCreated.forEach(t => summaryParts.push(`- ${t.title} → ${t.assigned_to_name}`));
      }
      if (analysis.proxima_acao_recomendada) {
        summaryParts.push(`\n**Próxima ação:** ${analysis.proxima_acao_recomendada}`);
      }

      await supabase.from("lead_notes").insert({
        lead_id,
        content: summaryParts.join("\n"),
        type: "transcription",
        created_by: user_id,
      });

      return new Response(JSON.stringify({
        success: true,
        tasks_created: tasksCreated,
        tasks_skipped: tasksSkipped,
        meeting_scheduled: meetingScheduled,
        notifications_sent: notifications.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== MODE: ANALYZE (default) =====
    if (!transcription_text) {
      return new Response(JSON.stringify({ error: "transcription_text required for analyze mode" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const userNames = userList.map(u => `${u.name} (ID: ${u.id})`).join(", ");

    // Fetch custom prompt from database
    const { data: customPromptData } = await supabase
      .from("ai_prompts")
      .select("prompt_text")
      .eq("prompt_type", "transcription")
      .single();

    let systemPrompt: string;
    if (customPromptData?.prompt_text) {
      systemPrompt = customPromptData.prompt_text
        .replace(/\{\{TODAY_DATE\}\}/g, new Date().toISOString().split("T")[0])
        .replace(/\{\{FUNNEL_STAGES\}\}/g, FUNNEL_STAGES.map(s => `- ${s}`).join("\n"))
        .replace(/\{\{USER_NAMES\}\}/g, userNames)
        .replace(/\{\{USER_ID\}\}/g, user_id);
    } else {
      systemPrompt = `🧠 PROMPT — EXTRATOR DE TAREFAS DE REUNIÃO COMERCIAL V1.1

Você é um operador de CRM especializado em expansão de franquias.

Sua função é ler a transcrição de uma reunião comercial e extrair todas as tarefas, compromissos e próximos passos — explícita ou implicitamente mencionados — organizados por responsável.

Você não resume. Não explica. Não analisa. Apenas gera operação clara e acionável.

👥 PARTICIPANTES E PAPÉIS

Identifique o nome de cada pessoa pelo contexto da fala e atribua o papel correto:

| Papel | Quem é | O que faz |
|-------|--------|-----------|
| SDR | Quem fez o primeiro contato / agendou a reunião | Follow-up, confirmação, reagendamento, continuidade operacional |
| COMERCIAL | Quem conduziu a reunião e apresentou o negócio | Conduz reunião, negocia, define próximos passos |
| ADMINISTRATIVO | Responsável por documentos e formalização | Envia COF, contratos, solicita dados formais |
| LEAD | Potencial franqueado | Toma decisões, pede informações, demonstra interesse |

Sempre preencha o responsável no formato: Nome — Papel (ex: Thiago — Comercial, Bia — SDR). Se o nome não aparecer na transcrição, use: A definir — Papel.

🔍 O QUE CAPTURAR

Compromissos assumidos em voz alta — "vou te mandar", "vou enviar", "a gente agenda"

Próximos passos combinados — reunião marcada, documentação prometida, dados a coletar

Tarefas implícitas — "preciso ver as datas do treinamento" vira tarefa

Dúvidas do lead sem resposta — ficou sem resposta na reunião, vira tarefa de retorno

Reunião agendada ou a agendar — data, horário e pauta se mencionados

🚫 REGRAS INVIOLÁVEIS

Nunca invente informações ausentes na transcrição

Nunca atribua tarefa para o papel errado

Tarefas começam sempre com verbo no infinitivo (Enviar, Agendar, Confirmar, Compartilhar...)

O campo Prazo sugerido segue esta lógica:

Alta → até 2 dias após a reunião

Média → até 5 dias após a reunião

Baixa → até 10 dias após a reunião

Se a data da reunião não estiver na transcrição: Calcular a partir da data de hoje (${new Date().toISOString().split("T")[0]})

O campo Prazo final é sempre deixado em branco para preenchimento manual

Sempre gere pelo menos uma tarefa
Sempre avalie se existe ou precisa de reunião
Sempre preencher todos os campos
Sempre definir próxima etapa

EXECUÇÃO (OBRIGATÓRIO): Para cada tarefa, gerar:
"passos_execucao": [sequência clara e lógica do que deve ser feito, como um checklist acionável]
Regras: Passos objetivos e operacionais, Ordem cronológica, Sem generalizações.

FUNIL DISPONÍVEL (use EXATAMENTE estes nomes):
${FUNNEL_STAGES.map(s => `- ${s}`).join("\n")}

Usuários do sistema disponíveis: ${userNames}
Mapeie os responsáveis para os nomes corretos dos usuários. Fallback: use o ID ${user_id}.`;
    }

    // === ÂNCORA FORTE DE DATA (sempre prefixada, mesmo com prompt customizado) ===
    const todayStr = new Date().toISOString().split("T")[0];
    const dateAnchor = `\n\n⚠️ DATA DE HOJE: ${todayStr} (formato YYYY-MM-DD).
REGRA INVIOLÁVEL DE PRAZOS:
- NUNCA gere uma data anterior a ${todayStr}.
- IGNORE totalmente qualquer data presente na transcrição como ponto de partida — ela pode ser antiga.
- Calcule TODOS os prazos a partir de HOJE (${todayStr}).
- Tarefa fácil/urgente (prioridade ALTA) → mesmo dia (${todayStr}).
- Tarefa de complexidade MÉDIA → +2 dias úteis a partir de hoje.
- Tarefa BAIXA / planejamento → +5 dias úteis a partir de hoje.
- Pule sábado e domingo: se cair em fim de semana, mova para a segunda-feira seguinte.
- O campo "prazo_sugerido" deve ser uma string YYYY-MM-DD ≥ ${todayStr}.`;
    systemPrompt = systemPrompt + dateAnchor;

    const taskItemSchema = {
      type: "object",
      properties: {
        tarefa: { type: "string", description: "Verbo no infinitivo + ação clara e curta" },
        contexto: { type: "string", description: "De onde veio essa tarefa na conversa — 1 linha" },
        descricao_detalhada: {
          type: "string",
          description: "2 a 4 frases: contexto da reunião que originou a tarefa, porquê dela existir e resultado esperado. Escrita para alguém que NÃO participou da reunião.",
        },
        criterio_conclusao: {
          type: "string",
          description: "Frase começando com 'Pronto quando...' descrevendo objetivamente como saber que terminou.",
        },
        responsavel: { type: "string", description: "Nome — Papel (ex: Thiago — Comercial, Bia — SDR)" },
        prazo_sugerido: { type: "string", description: "Data YYYY-MM-DD baseada na prioridade: Alta=0-2d, Média=2-5d, Baixa=5-10d úteis a partir de hoje" },
        prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
        passos_execucao: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 6,
          description: "Mínimo 3, máximo 6 passos operacionais em ordem cronológica, sem generalizações.",
        },
      },
      required: ["tarefa", "contexto", "descricao_detalhada", "criterio_conclusao", "responsavel", "prazo_sugerido", "prioridade", "passos_execucao"],
    };

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [{
      type: "function",
      function: {
        name: "extract_crm_data",
        description: "Extract CRM operational data from franchise sales conversation with role-based task distribution",
        parameters: {
          type: "object",
          properties: {
            etapa_atual: {
              type: "string",
              enum: FUNNEL_STAGES,
              description: "Current funnel stage",
            },
            proxima_movimentacao: {
              type: "string",
              enum: FUNNEL_STAGES,
              description: "Suggested next funnel stage",
            },
            reuniao: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["Não mencionada", "Agendada", "Precisa agendar", "Reagendar"] },
                data: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
                horario: { type: ["string", "null"], description: "HH:MM or null" },
                pauta: { type: ["string", "null"], description: "O que foi combinado tratar na reunião" },
                responsavel_confirmar: { type: "string", description: "Nome — Papel (ex: Bia — SDR)" },
              },
              required: ["status"],
            },
            tarefas_sdr: {
              type: "array",
              description: "Tasks for SDR role",
              items: taskItemSchema,
            },
            tarefas_comercial: {
              type: "array",
              description: "Tasks for Commercial role",
              items: taskItemSchema,
            },
            tarefas_administrativo: {
              type: "array",
              description: "Tasks for Administrative role",
              items: taskItemSchema,
            },
            tarefas_lead: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  acao: { type: "string", description: "O que o lead precisa fazer ou decidir (verbo no infinitivo)" },
                  objetivo: { type: "string", description: "Por que isso destrava o avanço do processo" },
                  passos_execucao: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 2,
                    maxItems: 4,
                    description: "2-4 passos que o SDR vai executar para cobrar o lead",
                  },
                  criterio_conclusao: {
                    type: "string",
                    description: "Frase 'Pronto quando o lead...' descrevendo o que indica que o lead cumpriu",
                  },
                },
                required: ["acao", "objetivo", "passos_execucao", "criterio_conclusao"],
              },
            },
            momento_lead: {
              type: "string",
              enum: ["Curioso", "Interessado", "Avançando", "Quente para fechar", "Indeciso", "Frio"],
              description: "Current lead engagement moment",
            },
            momento_lead_justificativa: {
              type: "string",
              description: "1 frase com base na conversa justificando o momento do lead",
            },
            risco_perda: {
              type: "string",
              enum: ["Baixo", "Médio", "Alto"],
              description: "Risk of losing this lead",
            },
            risco_motivo: {
              type: "string",
              description: "1 frase objetiva explicando o risco de perda",
            },
            pontos_atencao: {
              type: "array",
              items: { type: "string" },
              description: "Máximo 4 pontos de atenção",
            },
            proxima_acao_recomendada: { type: "string" },
            next_meeting: {
              type: ["object", "null"],
              properties: {
                title: { type: "string" },
                start_datetime: { type: "string" },
                end_datetime: { type: "string" },
                participant_ids: { type: "array", items: { type: "string" } },
              },
              required: ["title", "start_datetime", "end_datetime", "participant_ids"],
            },
          },
          required: ["etapa_atual", "proxima_movimentacao", "reuniao", "tarefas_sdr", "tarefas_comercial", "tarefas_administrativo", "tarefas_lead", "momento_lead", "momento_lead_justificativa", "risco_perda", "risco_motivo", "pontos_atencao", "proxima_acao_recomendada"],
        },
      },
    }];

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Conversa sobre o lead "${lead?.name || "Lead"}":\n\n${transcription_text}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extract_crm_data" } },
      });
    } catch (aiErr: any) {
      console.error("OpenAI SDK error:", aiErr?.status, aiErr?.message);
      if (aiErr?.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiErr?.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione fundos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw aiErr;
    }

    const toolCall = completion.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const extracted = JSON.parse(toolCall.function.arguments);

    // Helper to map role-based tasks to unified tarefas_franquia format
    // SEMPRE sanitiza prazo_sugerido: se for inválido, vazio ou no passado, recalcula pela prioridade
    const mapRoleTasks = (tasks: any[], papel: string) => (tasks || []).map((t: any) => {
      const safeDate = sanitizeDueDate(t.prazo_sugerido, t.prioridade);
      const diffMs = new Date(`${safeDate}T00:00:00`).getTime() - Date.now();
      return {
        titulo: t.tarefa,
        descricao: t.descricao_detalhada || t.contexto || "",
        descricao_detalhada: t.descricao_detalhada || "",
        criterio_conclusao: t.criterio_conclusao || "",
        responsavel: t.responsavel,
        tipo: "franquia",
        papel,
        prioridade: t.prioridade,
        prazo_sugerido_dias: Math.max(0, Math.round(diffMs / 86400000)),
        impacto: "medio",
        origem: t.contexto || "",
        passos_execucao: t.passos_execucao || [],
        agendamento: { deve_agendar: false },
        data_execucao: safeDate,
        is_reuniao: false,
      };
    });

    const tarefasFranquia = [
      ...mapRoleTasks(extracted.tarefas_sdr, "SDR"),
      ...mapRoleTasks(extracted.tarefas_comercial, "Comercial"),
      ...mapRoleTasks(extracted.tarefas_administrativo, "Administrativo"),
    ];

    // Map tarefas_lead — sempre cobrança via SDR; inclui passos e critério de conclusão
    const tarefasLead = (extracted.tarefas_lead || []).map((t: any) => ({
      titulo: t.acao,
      descricao: t.objetivo,
      descricao_detalhada: t.objetivo || "",
      criterio_conclusao: t.criterio_conclusao || "",
      responsavel: "", // Resolvido no confirm para o SDR do lead
      tipo: "lead",
      papel: "SDR", // Cobrança ao lead = SDR executa
      prioridade: "media",
      prazo_sugerido_dias: 2,
      impacto: "medio",
      origem: "Cobrança ao Lead",
      passos_execucao: t.passos_execucao || [],
      agendamento: { deve_agendar: false },
      data_execucao: computeDueDateByPriority("media"),
      is_reuniao: false,
    }));

    return new Response(JSON.stringify({
      mode: "analyze",
      etapa_atual: extracted.etapa_atual,
      proxima_movimentacao: extracted.proxima_movimentacao,
      reuniao: extracted.reuniao || { status: "Não mencionada" },
      pontos_atencao: (extracted.pontos_atencao || []).slice(0, 4),
      tarefas_lead: tarefasLead,
      tarefas_franquia: tarefasFranquia,
      proxima_acao_recomendada: extracted.proxima_acao_recomendada || "",
      next_meeting: extracted.next_meeting || null,
      momento_lead: extracted.momento_lead || "Interessado",
      momento_lead_justificativa: extracted.momento_lead_justificativa || "",
      risco_perda: extracted.risco_perda || "Médio",
      risco_motivo: extracted.risco_motivo || "",
      // Backwards compat
      prioridade_lead: extracted.momento_lead || "Média",
      risco: extracted.risco_perda || "Médio",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-transcription error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
