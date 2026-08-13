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
  const zoomClientId = Deno.env.get("ZOOM_CLIENT_ID");
  const zoomClientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Handle browser redirect from Zoom (GET with code+state) BEFORE auth check
  {
    const url = new URL(req.url);
    const codeParam = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    if (req.method === "GET" && codeParam && stateParam) {
      if (!zoomClientId || !zoomClientSecret) {
        return new Response("Zoom credentials not configured", { status: 500 });
      }
      const redirectUri = `${supabaseUrl}/functions/v1/zoom-oauth-callback`;
      const tokenRes = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: codeParam,
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        return new Response(
          `<html><body><h2>Erro ao conectar com Zoom</h2><p>${JSON.stringify(tokenData)}</p><script>window.close();</script></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }
      const userRes = await fetch("https://api.zoom.us/v2/users/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      await supabase.from("zoom_oauth_tokens").upsert(
        {
          connected_by: stateParam,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          connected_email: userData.email || null,
          scope: tokenData.scope || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "connected_by" }
      );
      return new Response(
        `<html><body><h2>✅ Zoom conectado com sucesso!</h2><p>Conta: ${userData.email}</p><p>Você pode fechar esta janela.</p><script>try{window.opener&&window.opener.postMessage({source:"zoom-oauth",connected:true},"*")}catch(e){};setTimeout(()=>window.close(),1500);</script></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }
  }

  // Authenticate user (optional for GET status)
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
  const { data: claimsData } = token
    ? await supabase.auth.getUser(token)
    : { data: { user: null } };
  const userId = claimsData?.user?.id ?? null;

  if (req.method === "GET" && !userId) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // GET - check connection status
  if (req.method === "GET") {
    const { data } = await supabase
      .from("zoom_oauth_tokens")
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
    if (!zoomClientId) {
      return new Response(JSON.stringify({ error: "ZOOM_CLIENT_ID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/zoom-oauth-callback`;
    const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${zoomClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;

    return new Response(JSON.stringify({ auth_url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "disconnect") {
    await supabase.from("zoom_oauth_tokens").delete().eq("connected_by", userId);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle OAuth callback (code exchange)
  if (action === "callback" && body.code) {
    if (!zoomClientId || !zoomClientSecret) {
      return new Response(JSON.stringify({ error: "Zoom credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/zoom-oauth-callback`;
    const tokenRes = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: body.code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: "Token exchange failed", details: tokenData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user info
    const userRes = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Upsert token
    await supabase.from("zoom_oauth_tokens").upsert(
      {
        connected_by: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        connected_email: userData.email || null,
        scope: tokenData.scope || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connected_by" }
    );

    return new Response(JSON.stringify({ success: true, email: userData.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle redirect from Zoom (GET with code param) - browser redirect
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (code && state) {
    if (!zoomClientId || !zoomClientSecret) {
      return new Response("Zoom credentials not configured", { status: 500 });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/zoom-oauth-callback`;
    const tokenRes = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return new Response(`<html><body><h2>Erro ao conectar com Zoom</h2><p>${JSON.stringify(tokenData)}</p><script>window.close();</script></body></html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    const userRes = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await supabase.from("zoom_oauth_tokens").upsert(
      {
        connected_by: state,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        connected_email: userData.email || null,
        scope: tokenData.scope || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connected_by" }
    );

    return new Response(
      `<html><body><h2>✅ Zoom conectado com sucesso!</h2><p>Conta: ${userData.email}</p><p>Você pode fechar esta janela.</p><script>setTimeout(() => window.close(), 2000);</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response(JSON.stringify({ error: "Invalid request" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
