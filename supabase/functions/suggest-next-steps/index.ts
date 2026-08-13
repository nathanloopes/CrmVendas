import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import OpenAI from "https://esm.sh/openai@4.73.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { error: authError } = await supabaseAuth.auth.getClaims(token);
    if (authError) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch lead data
    const { data: lead } = await supabase.from("leads").select("*").eq("id", lead_id).single();
    if (!lead) throw new Error("Lead not found");

    // Fetch related data in parallel
    const [notesRes, tasksRes, historyRes] = await Promise.all([
      supabase.from("lead_notes").select("content, type, created_at").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("tasks").select("title, status, priority, due_date").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("lead_stage_history").select("old_stage, new_stage, changed_at").eq("lead_id", lead_id).order("changed_at", { ascending: false }).limit(10),
    ]);

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const leadSummary = `
Lead: ${lead.name || "Sem nome"}
Estágio atual: ${lead.stage || "N/A"}
Cidade: ${lead.city || "N/A"} - ${lead.state || "N/A"}
Interesse: ${lead.interest || "N/A"}
Investimento: ${lead.investment || "N/A"}
Fonte: ${lead.source || "N/A"}
Último contato: ${lead.last_contact || "N/A"}
Próximo contato: ${lead.next_contact || "N/A"}
Tags: ${(lead.tags || []).join(", ") || "Nenhuma"}
Motivo de perda: ${lead.lost_reason || "N/A"}

Notas recentes:
${(notesRes.data || []).map(n => `- [${n.type}] ${n.content?.substring(0, 200)}`).join("\n") || "Nenhuma nota"}

Tarefas:
${(tasksRes.data || []).map(t => `- ${t.title} (${t.status}, prioridade: ${t.priority}, prazo: ${t.due_date || "sem prazo"})`).join("\n") || "Nenhuma tarefa"}

Histórico de estágios:
${(historyRes.data || []).map(h => `- ${h.old_stage} → ${h.new_stage} em ${h.changed_at}`).join("\n") || "Sem histórico"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um consultor comercial especialista em franquias. Analise os dados do lead e sugira os próximos passos para avançá-lo no funil de vendas.

Regras:
- Retorne exatamente de 3 a 5 sugestões práticas e acionáveis
- Cada sugestão deve ter um título curto e uma descrição detalhada
- Priorize as sugestões por urgência/impacto
- Considere o estágio atual, tarefas pendentes e histórico
- Use linguagem profissional em português brasileiro
- Se o lead estiver como "perdido", sugira estratégias de recuperação
- Responda APENAS com JSON válido no formato especificado`,
        },
        {
          role: "user",
          content: `Analise este lead e sugira próximos passos:\n\n${leadSummary}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const suggestions = JSON.parse(content);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("suggest-next-steps error:", e);
    const status = e?.status === 429 ? 429 : e?.status === 402 ? 402 : 500;
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
