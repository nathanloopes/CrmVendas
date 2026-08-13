import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function calculateStageDurations(history: any[]) {
  if (history.length === 0) return "Nenhuma movimentação registrada";

  const durations: string[] = [];
  for (let i = 0; i < history.length; i++) {
    const current = new Date(history[i].changed_at);
    const next = i + 1 < history.length ? new Date(history[i + 1].changed_at) : new Date();
    const diffDays = Math.round((next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    durations.push(`- ${history[i].new_stage}: ${diffDays} dias`);
  }
  return durations.join("\n");
}

function formatNotes(notes: any[]) {
  if (!notes || notes.length === 0) return "Nenhuma nota/interação registrada";
  return notes
    .map((n: any) => {
      const date = new Date(n.created_at).toLocaleDateString("pt-BR");
      const type = n.type || "note";
      const content = n.content
        ? n.content.length > 500
          ? n.content.substring(0, 500) + "..."
          : n.content
        : "(sem conteúdo)";
      return `[${type}] (${date}): ${content}`;
    })
    .join("\n\n");
}

function buildPrompt(lead: any, history: any[], tasks: any[], notes: any[], events: any[], transcriptions: string, stageDurations: string, customPromptTemplate?: string | null) {
  const tasksCompleted = tasks.filter((t: any) => t.status === "completed").length;
  const tasksPending = tasks.filter((t: any) => t.status === "pending").length;
  const meetingsScheduled = events.filter((e: any) => e.status === "scheduled").length;
  const meetingsDone = events.filter((e: any) => e.status === "completed").length;
  const notesFormatted = formatNotes(notes);

  const leadDataSection = `
========== DADOS DO LEAD ==========

Nome: ${lead.name || "Não informado"}
Cidade de interesse: ${lead.city || "Não informada"} / ${lead.state || ""}
Cidade disponível: ${lead.city_available === true ? "Sim" : lead.city_available === false ? "Não" : "Não verificado"}
Cidade mais próxima disponível: ${lead.nearest_available_city || "Não informada"}
Investimento disponível: ${lead.investment || "Não informado"}
Modelo de loja: ${lead.modelo_loja || "Não informado"}
Interesse: ${lead.interest || "Não informado"}
Fonte: ${lead.source || "Não informada"}
Estágio atual: ${lead.stage || "Não definido"}
À frente da operação: ${lead.tipo_proprietario || "Não informado"}
Já foi empreendedor: ${lead.ja_foi_empreendedor ?? "Não informado"}
Criado em: ${lead.created_at}
Follow-ups: 1º: ${lead["1º_follow_up"] || "—"} | 2º: ${lead["2º_follow_up"] || "—"} | 3º: ${lead["3º_follow_up"] || "—"}

========== HISTÓRICO DE ESTÁGIOS (${history.length} movimentações) ==========
${history.map((h: any) => `- ${h.old_stage} → ${h.new_stage} em ${h.changed_at}`).join("\n") || "Nenhuma movimentação"}

========== TEMPO EM CADA ETAPA ==========
${stageDurations}

========== TAREFAS ==========
${tasksCompleted} concluídas, ${tasksPending} pendentes de ${tasks.length} total

========== NOTAS/INTERAÇÕES (${notes.length} registros) ==========
${notesFormatted}

========== REUNIÕES ==========
${meetingsScheduled} agendadas, ${meetingsDone} realizadas de ${events.length} total

========== TRANSCRIÇÃO DA REUNIÃO ==========
${transcriptions || "Nenhuma transcrição disponível"}`;

  if (customPromptTemplate) {
    return customPromptTemplate.replace(/\{\{LEAD_DATA\}\}/g, leadDataSection);
  }

  return `Você é um especialista em análise de leads para expansão de franquias.

Sua função é analisar TODAS as informações disponíveis no card do CRM — dados estruturados, histórico de movimentações, tempo em cada etapa, padrão de comportamento — e PRINCIPALMENTE a transcrição da reunião, que tem peso decisivo na análise.

Com base nisso, atribua um score de 0 a 100 e gere uma análise estratégica completa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CLASSIFICAÇÃO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Quente  (80–100) → Alta probabilidade de fechamento
- Morno   (50–79)  → Precisa de condução estratégica
- Frio    (0–49)   → Baixa prioridade / risco alto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CRITÉRIOS DE AVALIAÇÃO (TOTAL: 100 pontos base)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Avalie cada critério com base no CONTEÚDO REAL da transcrição e no comportamento observado no CRM. Nunca pontue pelo volume de interações — pontue pela QUALIDADE e COERÊNCIA.

──────────────────────────────────────────
1. CAPACIDADE FINANCEIRA (20 pontos)
──────────────────────────────────────────
Analise o que foi dito NA TRANSCRIÇÃO sobre capital disponível, origem dos recursos, necessidade de sócio financeiro, dependência de financiamento, inseguranças financeiras.

Evidências que sustentam pontuação alta:
→ Declara capital próprio disponível com clareza e sem hesitação
→ Já consultou banco/BNDES com visão realista
→ Demonstra entendimento do investimento total (não só taxa)

Evidências que reduzem pontuação:
→ Depende de aprovação de terceiros (marido, sócio, banco)
→ Confunde investimento inicial com capital de giro
→ Demonstra surpresa ou resistência ao valor

Referência de pontuação:
- Capital próprio confirmado + sem dependências → 18–20
- Capital parcial ou depende de financiamento viável → 10–14
- Sem clareza, dependência forte ou resistência ao valor → 0–6

──────────────────────────────────────────
2. FIT GEOGRÁFICO (10 pontos)
──────────────────────────────────────────
Avalie pela cidade de interesse cruzada com disponibilidade real de território.
- Cidade disponível e confirmada → 10
- Cidade próxima disponível, lead aceita alternativa → 5–7
- Cidade indisponível e lead resistente a alternativas → 0–2

──────────────────────────────────────────
3. ESTRUTURA OPERACIONAL — MULHER SÓCIA (15 pontos)
──────────────────────────────────────────
Analise NA TRANSCRIÇÃO se existe sócia mulher operacional confirmada, quem vai estar presente no dia a dia da operação, e o nível de comprometimento real com a execução.

Evidências que sustentam pontuação alta:
→ Sócia mulher nomeada, presente na reunião ou com papel claro definido
→ Demonstra conhecimento do modelo e disposição para operar
→ Fala sobre rotina, equipe, estrutura com clareza

Evidências que reduzem pontuação:
→ Sócia mencionada vagamente, sem papel definido
→ Lead fala por ela sem que ela tenha sido consultada
→ Sócia apenas financeira, sem intenção de operar

Referência de pontuação:
- Sócia operacional confirmada com papel claro → 13–15
- Sócia presente mas papel parcialmente definido → 7–9
- Sem sócia ou sócia apenas financeira → 0–3

──────────────────────────────────────────
4. PERFIL EMPREENDEDOR (10 pontos)
──────────────────────────────────────────
Avalie NA TRANSCRIÇÃO a maturidade empreendedora: como o lead fala sobre negócios, risco, gestão, equipe e crescimento. Não basta ter tido negócio — avalie a mentalidade.

Evidências que sustentam pontuação alta:
→ Já gerenciou equipe, fornecedor, fluxo de caixa
→ Fala de forma natural sobre desafios e aprendizados
→ Não demonstra medo excessivo de risco

Evidências que reduzem pontuação:
→ Nunca empreendeu e demonstra ingenuidade sobre gestão
→ Histórico de negócios mas postura passiva ou delegadora total
→ Confunde franquia com emprego ou renda passiva

Referência de pontuação:
- Empresário ativo com maturidade clara → 8–10
- Alguma experiência, mentalidade em desenvolvimento → 4–6
- Sem experiência ou mentalidade incompatível → 0–2

──────────────────────────────────────────
5. CONEXÃO COM O PÚBLICO (10 pontos)
──────────────────────────────────────────
Avalie NA TRANSCRIÇÃO se o lead demonstra conexão genuína com o público-alvo da marca (mães, crianças, universo infantil). Não é só ser mãe — é entender e se identificar.

Evidências que sustentam pontuação alta:
→ É mãe e fala com naturalidade sobre o universo infantil
→ Relata experiências pessoais com o público-alvo
→ Demonstra empatia genuína, não apenas interesse comercial

Evidências que reduzem pontuação:
→ Não tem filhos e não demonstra proximidade com o universo
→ Visão puramente financeira sem conexão emocional com o negócio
→ Faz perguntas que revelam distância do público

Referência de pontuação:
- Mãe com conexão genuína demonstrada na fala → 8–10
- Tem proximidade (sobrinha, trabalho com crianças etc.) → 4–6
- Sem conexão identificável → 0–2

──────────────────────────────────────────
6. CLAREZA DE DECISÃO (10 pontos)
──────────────────────────────────────────
Avalie NA TRANSCRIÇÃO o quanto o lead demonstra autonomia e clareza para decidir. Esse critério diferencia quem está próximo do fechamento de quem ainda está explorando.

Evidências que sustentam pontuação alta:
→ Fala no próprio nome, sem precisar consultar terceiros para avançar
→ Demonstra que já pensou sobre o assunto antes da reunião
→ Faz perguntas de quem está prestes a decidir (prazo, contrato, próximos passos)

Evidências que reduzem pontuação:
→ "Vou conversar com meu marido / sócio / familiar" sem autonomia própria
→ Terceiriza a decisão para alguém que não participou
→ Perguntas ainda muito introdutórias para o estágio em que está

Referência de pontuação:
- Decisor claro, autônomo, próximo do fechamento → 8–10
- Influenciador principal mas depende de validação → 4–6
- Não é o decisor real ou está muito longe da decisão → 0–2

──────────────────────────────────────────
7. PROTAGONISMO OPERACIONAL (10 pontos)
──────────────────────────────────────────
Avalie NA TRANSCRIÇÃO se o lead quer realmente tocar o negócio ou apenas investir. Analise não só o que ele diz, mas como descreve sua rotina futura e seu papel.

Evidências que sustentam pontuação alta:
→ Descreve cenários práticos de como vai operar
→ Faz perguntas sobre gestão de equipe, fornecedores, dia a dia
→ Demonstra vontade de estar presente fisicamente

Evidências que reduzem pontuação:
→ Pergunta exclusivamente sobre retorno financeiro e ROI
→ Fala em contratar alguém para "tocar" por ele
→ Postura de investidor, não de operador

Referência de pontuação:
- Quer operar, demonstra protagonismo claro → 8–10
- Misto: quer estar presente mas com gestão delegada → 4–6
- Puramente investidor, sem intenção operacional → 0–2

──────────────────────────────────────────
8. ALINHAMENTO DE EXPECTATIVA (10 pontos)
──────────────────────────────────────────
Avalie NA TRANSCRIÇÃO se o lead tem expectativas realistas sobre retorno, prazo de payback, volume de trabalho e modelo de negócio. Expectativa desalinhada = risco alto.

Evidências que sustentam pontuação alta:
→ Demonstra entendimento do tempo de maturação do negócio
→ Não espera retorno imediato ou lucro no primeiro mês
→ Entende que franquia exige gestão ativa, não é renda passiva

Evidências que reduzem pontuação:
→ Pergunta sobre lucro imediato ou payback muito curto
→ Compara a franquia com investimento financeiro passivo
→ Demonstra surpresa com o nível de dedicação exigido

Referência de pontuação:
- Expectativa realista e alinhada com o modelo → 8–10
- Expectativa levemente acima, mas ajustável → 4–6
- Expectativa muito desalinhada, resistente à realidade → 0–2

──────────────────────────────────────────
9. QUALIDADE DO ENGAJAMENTO (5 pontos)
──────────────────────────────────────────
Avalie NA TRANSCRIÇÃO (não pelo número de reuniões) a profundidade das perguntas, o nível de preparo e o interesse demonstrado ao longo da conversa.

Evidências que sustentam pontuação alta:
→ Fez perguntas aprofundadas, específicas e relevantes
→ Chegou preparado, com pesquisa prévia sobre a marca
→ Manteve atenção e participação ativa ao longo de toda a reunião

Evidências que reduzem pontuação:
→ Perguntas muito genéricas ou superficiais
→ Demonstrou distração, pressa ou desinteresse durante a reunião
→ Respondeu de forma monossilábica ou evasiva

Referência de pontuação:
- Engajamento profundo e consistente → 4–5
- Engajamento médio → 2–3
- Passivo ou desinteressado → 0–1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ AJUSTE COMPORTAMENTAL (±10 pontos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Após calcular os 100 pontos base, aplique um ajuste final baseado em comportamento observado no CRM e na transcrição. Seja preciso — justifique cada ajuste.

BÔNUS (até +10):
→ Avança no funil com iniciativa própria, sem precisar de empurrão
→ Executa o que foi combinado antes da próxima etapa
→ Demonstra urgência genuína (motivo real identificado, não pressão externa)
→ Coerência total entre o que fala e o que faz
→ Responde rápido, com qualidade, sem precisar de múltiplos follow-ups

PENALIZAÇÕES (até -10):
→ Ficou parado em etapa por mais de 15 dias sem justificativa
→ Precisou de 3+ follow-ups para avançar uma única etapa
→ Faltou a reunião sem avisar ou desmarcou mais de uma vez
→ Contradição entre fala e ação (disse que ia fazer, não fez)
→ Sinal de energia baixa: respostas secas, sem iniciativa, sem urgência

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 ANÁLISE OBRIGATÓRIA DA TRANSCRIÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Se transcrição disponível, extraia e apresente:

✅ SINAIS POSITIVOS (cite trechos reais ou parafraseie):
→ Perguntas que indicam intenção real de compra
→ Momentos de identificação com o modelo/público
→ Demonstração de autonomia e clareza de decisão
→ Urgência com fundamento real
→ Entendimento genuíno do que está comprando

🚨 SINAIS DE ALERTA (cite trechos reais ou parafraseie):
→ Insegurança financeira revelada na fala
→ Dependência de aprovação de terceiros
→ Expectativa desalinhada com o modelo
→ Foco exclusivo em lucro, sem falar em operação
→ Contradições internas no discurso
→ Hesitações recorrentes sem resolução

⚠️ REGRAS INVIOLÁVEIS:
- Comportamento real > discurso
- Conflito entre fala e ação → penalize sempre
- Nunca pontue por volume de interações — só por qualidade e conteúdo
- Se a transcrição não estiver disponível, sinalize quais critérios ficaram sem evidência e reduza a confiança da análise
- Seja direto e estratégico — análise superficial não tem valor aqui

========== DADOS DO LEAD ==========

Nome: ${lead.name || "Não informado"}
Cidade de interesse: ${lead.city || "Não informada"} / ${lead.state || ""}
Cidade disponível: ${lead.city_available === true ? "Sim" : lead.city_available === false ? "Não" : "Não verificado"}
Cidade mais próxima disponível: ${lead.nearest_available_city || "Não informada"}
Investimento disponível: ${lead.investment || "Não informado"}
Modelo de loja: ${lead.modelo_loja || "Não informado"}
Interesse: ${lead.interest || "Não informado"}
Fonte: ${lead.source || "Não informada"}
Estágio atual: ${lead.stage || "Não definido"}
À frente da operação: ${lead.tipo_proprietario || "Não informado"}
Já foi empreendedor: ${lead.ja_foi_empreendedor ?? "Não informado"}
Criado em: ${lead.created_at}
Follow-ups: 1º: ${lead["1º_follow_up"] || "—"} | 2º: ${lead["2º_follow_up"] || "—"} | 3º: ${lead["3º_follow_up"] || "—"}

========== HISTÓRICO DE ESTÁGIOS (${history.length} movimentações) ==========
${history.map((h: any) => `- ${h.old_stage} → ${h.new_stage} em ${h.changed_at}`).join("\n") || "Nenhuma movimentação"}

========== TEMPO EM CADA ETAPA ==========
${stageDurations}

========== TAREFAS ==========
${tasksCompleted} concluídas, ${tasksPending} pendentes de ${tasks.length} total

========== NOTAS/INTERAÇÕES (${notes.length} registros) ==========
${notesFormatted}

========== REUNIÕES ==========
${meetingsScheduled} agendadas, ${meetingsDone} realizadas de ${events.length} total

========== TRANSCRIÇÃO DA REUNIÃO ==========
${transcriptions || "Nenhuma transcrição disponível"}`;
}

const toolSchema = {
  type: "function",
  function: {
    name: "score_lead",
    description: "Retorna o score avançado do lead com análise estratégica completa",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", description: "Score de 0 a 100" },
        classification: { type: "string", enum: ["Quente", "Morno", "Frio"], description: "Classificação do lead" },
        general_analysis: { type: "string", description: "Análise geral completa do lead com base no CRM + transcrição" },
        transcription_reading: { type: "string", description: "Leitura da transcrição: comportamento, intenção e perfil. Vazio se não houver transcrição." },
        factors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              impact: { type: "string", enum: ["positive", "negative", "neutral"] },
              detail: { type: "string" },
            },
            required: ["name", "impact", "detail"],
            additionalProperties: false,
          },
        },
        strengths: { type: "array", items: { type: "string" }, description: "Pontos fortes do lead" },
        concerns: { type: "array", items: { type: "string" }, description: "Pontos de atenção" },
        risk_level: { type: "string", description: "Risco de não fechamento: Baixo/Médio/Alto + motivo" },
        recommendation: { type: "string", description: "Recomendação estratégica (avançar, nutrir, pressionar, descartar)" },
        next_steps: { type: "array", items: { type: "string" }, description: "Próximos passos recomendados" },
        summary: { type: "string", description: "Resumo executivo em 2-3 frases" },
      },
      required: ["score", "classification", "general_analysis", "transcription_reading", "factors", "strengths", "concerns", "risk_level", "recommendation", "next_steps", "summary"],
      additionalProperties: false,
    },
  },
};

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

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: authError } = await supabaseAuth.auth.getClaims(token);
      if (authError || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [leadRes, historyRes, tasksRes, notesRes, eventsRes, materialsRes] =
      await Promise.all([
        supabase.from("leads").select("*").eq("id", lead_id).single(),
        supabase.from("lead_stage_history").select("*").eq("lead_id", lead_id).order("changed_at", { ascending: true }),
        supabase.from("tasks").select("*").eq("lead_id", lead_id),
        supabase.from("lead_notes").select("id, type, content, created_at").eq("lead_id", lead_id).order("created_at", { ascending: false }),
        supabase.from("calendar_events").select("id, title, status, start_datetime, event_type").eq("lead_id", lead_id),
        supabase.from("lead_materials").select("content, title, type").eq("lead_id", lead_id).eq("type", "transcricao"),
      ]);

    if (leadRes.error || !leadRes.data) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lead = leadRes.data;
    const history = historyRes.data || [];
    const tasks = tasksRes.data || [];
    const notes = notesRes.data || [];
    const events = eventsRes.data || [];
    const materials = materialsRes.data || [];

    const transcriptions = materials
      .filter((m: any) => m.content)
      .map((m: any) => `--- ${m.title} ---\n${m.content}`)
      .join("\n\n");

    const stageDurations = calculateStageDurations(history);

    // Fetch custom prompt and learnings from database
    const [customPromptRes, learningsRes] = await Promise.all([
      supabase.from("ai_prompts").select("prompt_text").eq("prompt_type", "lead_score").single(),
      supabase.from("ai_score_learnings").select("content").order("created_at", { ascending: true }),
    ]);

    let prompt = buildPrompt(lead, history, tasks, notes, events, transcriptions, stageDurations, customPromptRes.data?.prompt_text);

    // Inject learnings into prompt
    const learnings = learningsRes.data || [];
    if (learnings.length > 0) {
      const learningsSection = "\n\n========== APRENDIZADOS ACUMULADOS ==========\nConsidere os seguintes aprendizados ao fazer a análise:\n" +
        learnings.map((l: any, i: number) => `${i + 1}. ${l.content}`).join("\n");
      prompt += learningsSection;
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Você é um analista estratégico de vendas de franquias. Responda APENAS usando a tool fornecida. Seja direto, estratégico e sem enrolação. Avalie pela qualidade do conteúdo, não pelo volume de interações.",
          },
          { role: "user", content: prompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "score_lead" } },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await openaiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No tool call in AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    await supabase.from("leads").update({ lead_score: result.score }).eq("id", lead_id);

    await supabase.from("lead_score_results").upsert({
      lead_id,
      score: result.score,
      classification: result.classification,
      general_analysis: result.general_analysis,
      transcription_reading: result.transcription_reading,
      factors: result.factors,
      strengths: result.strengths,
      concerns: result.concerns,
      risk_level: result.risk_level,
      recommendation: result.recommendation,
      next_steps: result.next_steps,
      summary: result.summary,
    }, { onConflict: "lead_id" });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("score-lead error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
