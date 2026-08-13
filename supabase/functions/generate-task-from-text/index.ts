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

    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Texto muito curto. Forneça pelo menos 5 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // Fetch leads for context
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: leads } = await supabase.from("leads").select("id, name").order("name").limit(500);
    const leadNames = (leads || []).map(l => `${l.name} (ID: ${l.id})`).join("\n");

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente de CRM especializado em extrair tarefas de textos. O usuário vai colar um texto (mensagem, e-mail, anotação, etc.) e você deve extrair UMA OU MAIS tarefas acionáveis.

Para cada tarefa extraída, retorne:
- title: título curto e claro da tarefa (máx 80 caracteres)
- description: descrição detalhada com contexto do texto original
- priority: "high", "medium" ou "low" (baseado na urgência do texto)
- due_date_suggestion: sugestão de prazo em dias a partir de hoje (ex: 1, 3, 7, null se não houver indicação)
- lead_name_match: nome do lead mencionado no texto que melhor corresponde a um da lista abaixo, ou null

Lista de leads disponíveis:
${leadNames}

Regras:
- Extraia tarefas concretas e acionáveis
- Se o texto mencionar datas específicas, converta para dias a partir de hoje
- Se mencionar "urgente", "imediato", "agora", use priority "high" e due_date_suggestion 1
- Responda APENAS com JSON válido no formato: { "tasks": [...] }
- Mínimo 1, máximo 5 tarefas`,
        },
        {
          role: "user",
          content: `Extraia tarefas do seguinte texto:\n\n${text}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content);
    
    // Match lead names to IDs
    const tasks = (parsed.tasks || []).map((t: any) => {
      let lead_id = null;
      if (t.lead_name_match && leads) {
        const match = leads.find(l => 
          l.name?.toLowerCase().includes(t.lead_name_match.toLowerCase()) ||
          t.lead_name_match.toLowerCase().includes(l.name?.toLowerCase() || "")
        );
        if (match) lead_id = match.id;
      }
      return {
        title: t.title || "Tarefa sem título",
        description: t.description || "",
        priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
        due_date_suggestion: typeof t.due_date_suggestion === "number" ? t.due_date_suggestion : null,
        lead_id,
        lead_name: lead_id ? leads?.find(l => l.id === lead_id)?.name : null,
      };
    });

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-task-from-text error:", e);
    const status = e?.status === 429 ? 429 : e?.status === 402 ? 402 : 500;
    return new Response(JSON.stringify({ error: e.message || "Erro ao processar texto" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
