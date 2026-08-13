import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_PROMPT = `Você é um assistente de análise de leads comerciais. Gere uma timeline resumida e objetiva com tudo que aconteceu com esse lead.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch prompt from ai_prompts table
    const { data: promptRow } = await supabase
      .from("ai_prompts")
      .select("prompt_text")
      .eq("prompt_type", "lead_summary")
      .single();

    const systemPrompt = promptRow?.prompt_text || FALLBACK_PROMPT;

    // Fetch all data in parallel
    const [leadRes, notesRes, materialsRes, historyRes, eventsRes, tasksRes, scoreRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", lead_id).single(),
      supabase.from("lead_notes").select("*").eq("lead_id", lead_id).order("created_at", { ascending: true }),
      supabase.from("lead_materials").select("*").eq("lead_id", lead_id).order("created_at", { ascending: true }),
      supabase.from("lead_stage_history").select("*").eq("lead_id", lead_id).order("changed_at", { ascending: true }),
      supabase.from("calendar_events").select("*").eq("lead_id", lead_id).order("start_datetime", { ascending: true }),
      supabase.from("tasks").select("*").eq("lead_id", lead_id).order("created_at", { ascending: true }),
      supabase.from("lead_score_results").select("*").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(1),
    ]);

    const lead = leadRes.data;
    const notes = notesRes.data || [];
    const materials = materialsRes.data || [];
    const history = historyRes.data || [];
    const events = eventsRes.data || [];
    const tasks = tasksRes.data || [];
    const scoreData = scoreRes.data?.[0] || null;

    // Format context
    const leadInfo = lead ? `
## Dados do Lead
- Nome: ${lead.name || "Não informado"}
- Telefone: ${lead.phone || "Não informado"}
- Email: ${lead.email || "Não informado"}
- Cidade: ${lead.city || "Não informado"} / ${lead.state || ""}
- Interesse: ${lead.interest || "Não informado"}
- Investimento: ${lead.investment || "Não informado"}
- Etapa atual: ${lead.stage || "Não informado"}
- Origem: ${lead.source || "Não informado"}
- Modelo de loja: ${lead.modelo_loja || "Não informado"}
- Criado em: ${lead.created_at}
- Última atualização: ${lead.updated_at || "Não registrado"}
` : "Lead não encontrado";

    const notesText = notes.length > 0
      ? notes.map(n => `- [${n.created_at}] (${n.type || "note"}): ${n.content?.substring(0, 500)}`).join("\n")
      : "Nenhuma nota registrada";

    const materialsText = materials.length > 0
      ? materials.map(m => `- [${m.created_at}] ${m.title} (${m.type}): ${m.description || "sem descrição"}`).join("\n")
      : "Nenhum material enviado";

    const historyText = history.length > 0
      ? history.map(h => `- [${h.changed_at}] ${h.old_stage} → ${h.new_stage}`).join("\n")
      : "Nenhuma movimentação registrada";

    // Calculate time in current stage
    const now = new Date();
    const entryDate = history.length > 0
      ? new Date(history[history.length - 1].changed_at)
      : (lead?.created_at ? new Date(lead.created_at) : now);
    const diffMs = now.getTime() - entryDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const currentStageTime = `${diffDays} dias e ${diffHours} horas`;

    // Calculate time spent in each stage
    let stageTimesText = "";
    if (history.length > 0) {
      const stageTimes: string[] = [];
      const firstEntryDate = lead?.created_at ? new Date(lead.created_at) : new Date(history[0].changed_at);
      const firstDiff = new Date(history[0].changed_at).getTime() - firstEntryDate.getTime();
      const firstDays = Math.floor(firstDiff / (1000 * 60 * 60 * 24));
      const firstHours = Math.floor((firstDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      stageTimes.push(`- ${history[0].old_stage}: ${firstDays} dias e ${firstHours} horas`);

      for (let i = 0; i < history.length - 1; i++) {
        const start = new Date(history[i].changed_at);
        const end = new Date(history[i + 1].changed_at);
        const d = end.getTime() - start.getTime();
        const days = Math.floor(d / (1000 * 60 * 60 * 24));
        const hours = Math.floor((d % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        stageTimes.push(`- ${history[i].new_stage}: ${days} dias e ${hours} horas`);
      }

      stageTimes.push(`- ${lead?.stage || history[history.length - 1].new_stage} (atual): ${currentStageTime}`);
      stageTimesText = `\n## Tempo em cada etapa\n${stageTimes.join("\n")}`;
    }

    // Enrich leadInfo with current stage time
    const stageTimeInfo = `\n- Tempo na etapa atual (${lead?.stage || "desconhecida"}): ${currentStageTime}`;

    const eventsText = events.length > 0
      ? events.map(e => `- [${e.start_datetime}] ${e.title} (${e.status}) - ${e.event_type}`).join("\n")
      : "Nenhuma reunião registrada";

    const tasksText = tasks.length > 0
      ? tasks.map(t => `- [${t.created_at}] ${t.title} (${t.status}, prioridade: ${t.priority})${t.due_date ? ` - prazo: ${t.due_date}` : ""}`).join("\n")
      : "Nenhuma tarefa registrada";

    const scoreText = scoreData
      ? `
## Score do Lead
- Pontuação: ${scoreData.score}
- Classificação: ${scoreData.classification}
- Nível de risco: ${scoreData.risk_level || "Não informado"}
- Resumo: ${scoreData.summary || "Não disponível"}
- Análise geral: ${scoreData.general_analysis || "Não disponível"}
- Recomendação: ${scoreData.recommendation || "Não disponível"}
- Fatores positivos: ${scoreData.strengths ? JSON.stringify(scoreData.strengths) : "Não registrado"}
- Fatores negativos: ${scoreData.concerns ? JSON.stringify(scoreData.concerns) : "Não registrado"}
- Fatores de análise: ${scoreData.factors ? JSON.stringify(scoreData.factors) : "Não registrado"}
- Leitura de transcrição: ${scoreData.transcription_reading || "Não disponível"}
`
      : "Nenhum score registrado para este lead";

    const userPrompt = `${leadInfo}${stageTimeInfo}

## Notas e Transcrições
${notesText}

## Materiais Enviados
${materialsText}

## Movimentações no Funil
${historyText}
${stageTimesText}

## Reuniões
${eventsText}

## Tarefas
${tasksText}

${scoreText}`;

    // Call OpenAI
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao gerar resumo com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiRes.json();
    const summary = openaiData.choices?.[0]?.message?.content || "Não foi possível gerar o resumo.";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("lead-summary error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
