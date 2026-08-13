// READ-ONLY no sistema externo. WRITE apenas em public.lead_database.
// Cruza leads da Base de Dados com profiles do sistema externo e marca os que já são franqueados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let v = String(raw).replace(/[^0-9]/g, "");
  // remove prefixo Brasil 55 quando presente em números longos
  if (v.length >= 12 && v.startsWith("55")) v = v.slice(2);
  return v;
}

function normEmail(raw: string | null | undefined): string {
  return (raw || "").trim().toLowerCase();
}

function normText(raw: string | null | undefined): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const EXTERNAL_URL = Deno.env.get("FRANQUEADOS_SUPABASE_URL")!;
    const EXTERNAL_KEY = Deno.env.get("FRANQUEADOS_SUPABASE_ANON_KEY")!;

    // Auth: aceita JWT do usuário (botão manual) OU service-role / cron
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const isCron = token === SERVICE_ROLE;

    if (!isCron) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u, error: ue } = await userClient.auth.getUser();
      if (ue || !u?.user) return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const externalDb = createClient(EXTERNAL_URL, EXTERNAL_KEY, { db: { schema: "public" } });

    // 1) Carregar profiles + units + links
    //    IMPORTANTE: sistema externo é READ-ONLY. Filtramos APENAS franqueados aqui;
    //    colaboradores/gerentes/atendentes NÃO entram na lead_database.
    const [profilesRes, linksRes, unitsRes] = await Promise.all([
      externalDb.from("profiles").select("id, full_name, email, phone").limit(20000),
      externalDb
        .from("user_unit_links")
        .select("user_id, unit_id, is_active, role_in_unit")
        .eq("is_active", true)
        .limit(20000),
      externalDb.from("units").select("id, code, name, city, state").limit(20000),
    ]);

    if (profilesRes.error) throw new Error("profiles: " + profilesRes.error.message);
    if (linksRes.error) throw new Error("links: " + linksRes.error.message);
    if (unitsRes.error) throw new Error("units: " + unitsRes.error.message);

    // Diagnóstico: quais role_in_unit existem hoje no sistema externo
    const distinctRoles = Array.from(
      new Set(
        (linksRes.data || []).map((l: any) =>
          (l.role_in_unit ?? "(null)").toString().toLowerCase()
        )
      )
    );
    console.log("sistema externo role_in_unit distintas:", distinctRoles);

    // Filtro: somente vínculos que claramente representam franqueado/proprietário/sócio
    const FRANCHISEE_ROLE_RX = /(franqueado|franchise|propriet|owner|titular|s[óo]cio)/i;
    const franchiseeLinks = (linksRes.data || []).filter((l: any) =>
      FRANCHISEE_ROLE_RX.test((l.role_in_unit || "").toString())
    );
    console.log(
      `Links totais: ${linksRes.data?.length || 0} | Franqueados após filtro: ${franchiseeLinks.length}`
    );

    const unitsById = new Map<string, any>();
    (unitsRes.data || []).forEach((u: any) => unitsById.set(u.id, u));

    // Apenas vínculos de franqueado entram nos índices
    const linksByUserId = new Map<string, any>();
    franchiseeLinks.forEach((l: any) => {
      if (!linksByUserId.has(l.user_id)) linksByUserId.set(l.user_id, l);
    });
    const franchiseeUserIds = new Set<string>(franchiseeLinks.map((l: any) => l.user_id));

    // Índices em memória — somente profiles que SÃO franqueados
    const byPhone = new Map<string, any>();
    const byEmail = new Map<string, any>();
    const byNameCity = new Map<string, any>(); // chave: name|city

    for (const p of profilesRes.data || []) {
      if (!franchiseeUserIds.has(p.id)) continue; // ignora colaboradores

      const link = linksByUserId.get(p.id);
      const unit = link ? unitsById.get(link.unit_id) : null;
      const enriched = { profile: p, unit };

      const ph = normPhone(p.phone);
      if (ph && ph.length >= 10) byPhone.set(ph, enriched);

      const em = normEmail(p.email);
      if (em) byEmail.set(em, enriched);

      const nm = normText(p.full_name);
      const ct = normText(unit?.city);
      if (nm && ct) byNameCity.set(`${nm}|${ct}`, enriched);
    }

    // ============================================================
    // 2) PULL: importar APENAS franqueados ativos do sistema externo
    //    para a lead_database (upsert por phone_normalized).
    // ============================================================
    let pulled = 0;        // novos inseridos
    let pullUpdated = 0;   // já existiam e foram marcados
    let pullSkipped = 0;   // sem telefone válido
    const totalFranchisees = franchiseeLinks.length;

    for (const link of franchiseeLinks) {
      const profile = (profilesRes.data || []).find((p: any) => p.id === link.user_id);
      if (!profile) { pullSkipped++; continue; }
      const unit = unitsById.get(link.unit_id);

      const phNorm = normPhone(profile.phone);
      if (!phNorm || phNorm.length < 10) { pullSkipped++; continue; }

      const ddd = phNorm.length >= 10 ? phNorm.substring(0, 2) : null;

      // Verifica se já existe
      const { data: existing } = await admin
        .from("lead_database")
        .select("id")
        .eq("phone_normalized", phNorm)
        .maybeSingle();

      const payload: any = {
        name: profile.full_name || "Franqueado sem nome",
        phone_raw: profile.phone || phNorm,
        phone_normalized: phNorm,
        country_code: "55",
        ddd,
        city: unit?.city || null,
        state: unit?.state || null,
        source: "sistema externo",
        status: "Convertido",
        is_valid: true,
        origin: "franqueado",
        is_franchisee: true,
        franchisee_match_type: "external_pull",
        franchisee_unit_code: unit?.code || null,
        franchisee_unit_name: unit?.name || null,
        franchisee_profile_id: profile.id,
        franchisee_matched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: upErr } = await admin
          .from("lead_database")
          .update(payload)
          .eq("id", existing.id);
        if (!upErr) pullUpdated++;
      } else {
        const { error: insErr } = await admin
          .from("lead_database")
          .insert(payload);
        if (!insErr) pulled++;
      }
    }

    // ============================================================
    // 2.1) PURGE: limpar registros que entraram errado em pulls
    //      anteriores (colaboradores marcados como external_pull).
    // ============================================================
    const validProfileIds = Array.from(franchiseeUserIds);
    let purgedDeleted = 0;
    let purgedUnflagged = 0;

    // Busca todos os registros marcados via external_pull cujo profile_id
    // NÃO está mais na lista de franqueados válidos.
    // (Usar paginação para evitar limites do PostgREST com .in() grande.)
    const PURGE_PAGE = 1000;
    let pOffset = 0;
    while (true) {
      const { data: suspects, error: sErr } = await admin
        .from("lead_database")
        .select("id, origin, kanban_lead_id, franchisee_profile_id")
        .eq("franchisee_match_type", "external_pull")
        .order("created_at", { ascending: true })
        .range(pOffset, pOffset + PURGE_PAGE - 1);

      if (sErr) { console.error("purge select:", sErr.message); break; }
      if (!suspects || suspects.length === 0) break;

      for (const s of suspects) {
        if (!s.franchisee_profile_id) continue;
        if (franchiseeUserIds.has(s.franchisee_profile_id)) continue; // ainda válido

        // Não é mais franqueado — corrige
        if (s.origin === "franqueado" && !s.kanban_lead_id) {
          // Foi criado pelo pull e nunca virou lead — pode deletar
          const { error: dErr } = await admin
            .from("lead_database")
            .delete()
            .eq("id", s.id);
          if (!dErr) purgedDeleted++;
        } else {
          // Já existia antes — apenas tira os flags
          const { error: uErr } = await admin
            .from("lead_database")
            .update({
              is_franchisee: false,
              franchisee_match_type: null,
              franchisee_unit_code: null,
              franchisee_unit_name: null,
              franchisee_profile_id: null,
              franchisee_matched_at: null,
              origin: s.kanban_lead_id ? "kanban" : "imported",
              updated_at: new Date().toISOString(),
            })
            .eq("id", s.id);
          if (!uErr) purgedUnflagged++;
        }
      }

      if (suspects.length < PURGE_PAGE) break;
      pOffset += PURGE_PAGE;
    }
    console.log(`PURGE: deletados=${purgedDeleted} | desmarcados=${purgedUnflagged}`);


    // ============================================================
    // 3) MATCH: varredura nos leads ainda não marcados
    //    (cobre leads vindos de import/kanban que batem por nome+cidade)
    // ============================================================
    let scanned = 0;
    let matched = 0;
    const byType = { phone: 0, email: 0, name_city: 0 };
    const PAGE = 1000;
    let offset = 0;

    while (true) {
      const { data: leads, error: lerr } = await admin
        .from("lead_database")
        .select("id, name, phone_normalized, city")
        .eq("is_franchisee", false)
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE - 1);

      if (lerr) throw new Error("leads: " + lerr.message);
      if (!leads || leads.length === 0) break;

      const updates: any[] = [];
      for (const l of leads) {
        scanned++;
        const ph = normPhone(l.phone_normalized);
        let hit: any = null;
        let type: "phone" | "email" | "name_city" | null = null;

        if (ph && byPhone.has(ph)) {
          hit = byPhone.get(ph);
          type = "phone";
        }
        // sem email no lead_database; pulamos email-only por enquanto
        if (!hit) {
          const nm = normText(l.name);
          const ct = normText(l.city);
          if (nm && ct) {
            const key = `${nm}|${ct}`;
            if (byNameCity.has(key)) {
              hit = byNameCity.get(key);
              type = "name_city";
            }
          }
        }

        if (hit && type) {
          matched++;
          byType[type]++;
          updates.push({
            id: l.id,
            type,
            unit: hit.unit,
            profileId: hit.profile.id,
          });
        }
      }

      // Aplica em paralelo (em lotes pequenos para não travar)
      for (const up of updates) {
        await admin
          .from("lead_database")
          .update({
            is_franchisee: true,
            franchisee_match_type: up.type,
            franchisee_unit_code: up.unit?.code || null,
            franchisee_unit_name: up.unit?.name || null,
            franchisee_profile_id: up.profileId,
            franchisee_matched_at: new Date().toISOString(),
            origin: "franqueado",
            updated_at: new Date().toISOString(),
          })
          .eq("id", up.id);
      }

      if (leads.length < PAGE) break;
      offset += PAGE;
    }

    return json({
      ok: true,
      totalFranchisees,
      distinctRoles,
      pulled,
      pullUpdated,
      pullSkipped,
      purgedDeleted,
      purgedUnflagged,
      scanned,
      matched,
      byType,
    });
  } catch (err) {
    console.error("match-franchisees error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
