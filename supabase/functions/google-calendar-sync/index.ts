import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshGoogleToken(supabase: any, tokenRecord: any, googleClientId: string, googleClientSecret: string) {
  if (!tokenRecord.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRecord.refresh_token,
      client_id: googleClientId,
      client_secret: googleClientSecret,
    }),
  });

  const data = await res.json();
  if (!res.ok) return null;

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase.from("google_oauth_tokens").update({
    access_token: data.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("id", tokenRecord.id);

  return data.access_token;
}

async function getValidAccessToken(supabase: any, userId: string, googleClientId: string, googleClientSecret: string) {
  const { data: tokenRecord } = await supabase
    .from("google_oauth_tokens")
    .select("*")
    .eq("connected_by", userId)
    .single();

  if (!tokenRecord) return null;

  const expiresAt = new Date(tokenRecord.expires_at);
  if (expiresAt > new Date(Date.now() + 60000)) {
    return tokenRecord.access_token;
  }

  return refreshGoogleToken(supabase, tokenRecord, googleClientId, googleClientSecret);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!googleClientId || !googleClientSecret) {
    return new Response(JSON.stringify({ error: "Google credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  if (claimsError || !claimsData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  // Sync a CRM event to Google Calendar
  if (action === "sync_event") {
    const { event_id } = body;
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: event } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidAccessToken(supabase, event.responsible_user_id, googleClientId, googleClientSecret);
    if (!accessToken) {
      await supabase.from("calendar_events").update({
        google_calendar_sync_status: "not_connected",
        last_sync_error: "Google Calendar não conectado para este usuário",
      }).eq("id", event_id);

      return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const googleEvent = {
      summary: event.title,
      description: event.description || "",
      location: event.location || "",
      start: { dateTime: event.start_datetime, timeZone: "America/Sao_Paulo" },
      end: { dateTime: event.end_datetime, timeZone: "America/Sao_Paulo" },
      status: event.status === "cancelled" ? "cancelled" : "confirmed",
    };

    try {
      let res;
      if (event.google_calendar_event_id) {
        // Update existing
        res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.google_calendar_event_id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );
      } else {
        // Create new
        res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );
      }

      const result = await res.json();
      if (!res.ok) {
        await supabase.from("calendar_events").update({
          google_calendar_sync_status: "error",
          last_sync_error: JSON.stringify(result),
        }).eq("id", event_id);

        return new Response(JSON.stringify({ error: "Google API error", details: result }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("calendar_events").update({
        google_calendar_event_id: result.id,
        google_calendar_sync_status: "synced",
        google_meet_link: result.hangoutLink || null,
        last_sync_error: null,
      }).eq("id", event_id);

      return new Response(JSON.stringify({ success: true, google_event_id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await supabase.from("calendar_events").update({
        google_calendar_sync_status: "error",
        last_sync_error: errorMsg,
      }).eq("id", event_id);

      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Delete event from Google Calendar
  if (action === "delete_event") {
    const { google_event_id, user_id } = body;
    if (!google_event_id || !user_id) {
      return new Response(JSON.stringify({ error: "google_event_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidAccessToken(supabase, user_id, googleClientId, googleClientSecret);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${google_event_id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    await res.text(); // consume body

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
