import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Handle OAuth redirect from Google (browser redirect with code in URL)
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (req.method === "GET" && code && state) {
    if (!googleClientId || !googleClientSecret) {
      return new Response("Google credentials not configured", { status: 500 });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-oauth-callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: googleClientId,
        client_secret: googleClientSecret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return new Response(
        `<html><body><h2>Erro ao conectar com Google</h2><p>${JSON.stringify(tokenData)}</p><script>window.close();</script></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await supabase.from("google_oauth_tokens").upsert(
      {
        connected_by: state,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt,
        connected_email: userData.email || null,
        scope: tokenData.scope || null,
        token_type: tokenData.token_type || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connected_by" }
    );

    return new Response(
      `<html><body><h2>✅ Google Calendar conectado com sucesso!</h2><p>Conta: ${userData.email}</p><p>Você pode fechar esta janela.</p><script>try{window.opener&&window.opener.postMessage({source:"google-oauth",connected:true},"*")}catch(e){};setTimeout(()=>window.close(),1500);</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Authenticate user for API calls (optional for GET status)
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
  const { data: claimsData } = token
    ? await supabase.auth.getUser(token)
    : { data: { user: null } };
  const userId = claimsData?.user?.id ?? null;

  // GET sem auth válido → desconectado (200), evita ruído na UI
  if (req.method === "GET" && !userId) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Demais métodos exigem usuário autenticado
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // GET - check connection status
  if (req.method === "GET") {
    const { data } = await supabase
      .from("google_oauth_tokens")
      .select("connected_email, connected_at")
      .eq("connected_by", userId)
      .single();

    return new Response(
      JSON.stringify(data ? { connected: true, connected_email: data.connected_email, connected_at: data.connected_at } : { connected: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // POST actions
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "get_auth_url") {
    if (!googleClientId) {
      return new Response(JSON.stringify({ error: "GOOGLE_CLIENT_ID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-oauth-callback`;
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${userId}&access_type=offline&prompt=consent`;

    return new Response(JSON.stringify({ auth_url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "disconnect") {
    await supabase.from("google_oauth_tokens").delete().eq("connected_by", userId);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Invalid request" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
