// Edge function: cria a conta de autenticação para um e-mail aprovado
// e devolve uma senha temporária para o admin repassar ao usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  const pickFrom = (set: string) =>
    set[Math.floor(Math.random() * set.length)];

  const required = [
    pickFrom(upper),
    pickFrom(lower),
    pickFrom(digits),
    pickFrom(symbols),
  ];
  const rest = Array.from({ length: length - required.length }, () =>
    pickFrom(all)
  );
  return [...required, ...rest]
    .sort(() => Math.random() - 0.5)
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Confirma role admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(
        JSON.stringify({ error: "Apenas admins podem aprovar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      request_id,
      email,
      name,
      equipe,
      funcao,
      nivel,
      send_invite_email = true,
    } = body ?? {};

    if (!email || !funcao || !nivel) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: email, funcao, nivel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const derivedRole =
      funcao === "Administrativo" && nivel === "Administrativo"
        ? "admin"
        : "agent";

    // 1) Upsert em approved_emails
    const { error: insertErr } = await admin
      .from("approved_emails")
      .upsert(
        {
          email: normalizedEmail,
          invited_user_name: name ?? null,
          role: derivedRole,
          equipe: equipe ?? null,
          funcao,
          nivel,
          status: "pending",
        },
        { onConflict: "email" }
      );
    if (insertErr) throw insertErr;

    // 2) Verifica se o usuário já existe e cria se necessário
    let temporaryPassword: string | null = null;
    let userId: string | null = null;
    let alreadyExisted = false;

    // Procura usuário existente paginando até encontrar
    let page = 1;
    let found: any = null;
    while (page <= 10 && !found) {
      const { data: list } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      const users = list?.users ?? [];
      found = users.find(
        (u: any) => (u.email ?? "").toLowerCase() === normalizedEmail
      );
      if (users.length < 200) break;
      page++;
    }

    if (found) {
      alreadyExisted = true;
      userId = found.id;
    } else {
      temporaryPassword = generatePassword(12);
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: normalizedEmail,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { name: name ?? null },
        });
      if (createErr) throw createErr;
      userId = created.user?.id ?? null;
    }

    // 3) Garante registro em public.users
    if (userId) {
      await admin
        .from("users")
        .upsert(
          {
            id: userId,
            email: normalizedEmail,
            name: name ?? normalizedEmail.split("@")[0],
            role: derivedRole,
            equipe: equipe ?? null,
            funcao,
            nivel,
            status: "active",
          },
          { onConflict: "id" }
        );

      if (derivedRole === "admin") {
        await admin
          .from("user_roles")
          .upsert(
            { user_id: userId, role: "admin" },
            { onConflict: "user_id,role" }
          );
      }
    }

    // 4) Marca approved_emails como used
    await admin
      .from("approved_emails")
      .update({
        status: "used",
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq("email", normalizedEmail);

    // 5) Atualiza access_requests
    if (request_id) {
      await admin
        .from("access_requests")
        .update({
          status: "approved",
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request_id);
    }

    // 6) Envia e-mail de redefinição (link para /reset-password)
    let emailSent = false;
    if (send_invite_email) {
      try {
        const origin =
          req.headers.get("origin") ??
          req.headers.get("referer")?.split("/").slice(0, 3).join("/") ??
          "";
        const redirectTo = origin ? `${origin}/reset-password` : undefined;
        const { error: linkErr } = await admin.auth.resetPasswordForEmail(
          normalizedEmail,
          redirectTo ? { redirectTo } : undefined
        );
        if (!linkErr) emailSent = true;
        else console.error("resetPasswordForEmail error", linkErr);
      } catch (e) {
        console.error("invite email error", e);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        already_existed: alreadyExisted,
        temporary_password: temporaryPassword,
        email_sent: emailSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("approve-access-request error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
