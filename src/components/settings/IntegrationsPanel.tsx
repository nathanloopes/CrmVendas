import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Video, Calendar, Link2, Unlink, ExternalLink, AlertCircle } from "lucide-react";

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  connectedEmail?: string | null;
  connectedAt?: string | null;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  disconnectLoading: boolean;
}

function IntegrationCard({ title, description, icon, connected, connectedEmail, connectedAt, loading, onConnect, onDisconnect, disconnectLoading }: IntegrationCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold">{title}</h4>
          <Badge variant={connected ? "default" : "outline"} className="text-[10px]">
            {connected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
        {connected && connectedEmail && (
          <p className="text-xs text-muted-foreground mb-2">
            Conta: <span className="font-medium text-foreground">{connectedEmail}</span>
          </p>
        )}
        <div className="flex gap-2">
          {connected ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={onDisconnect}
              disabled={disconnectLoading}
            >
              <Unlink className="h-3 w-3" />
              {disconnectLoading ? "Desconectando..." : "Desconectar"}
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={onConnect}
              disabled={loading}
            >
              <Link2 className="h-3 w-3" />
              {loading ? "Conectando..." : "Conectar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPanel() {
  const queryClient = useQueryClient();
  const [connectingZoom, setConnectingZoom] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Listen for OAuth popup completion
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const src = (e.data as { source?: string } | null)?.source;
      if (src === "google-oauth") {
        queryClient.invalidateQueries({ queryKey: ["google-calendar-connection-status"] });
        toast.success("Google Calendar conectado");
      } else if (src === "zoom-oauth") {
        queryClient.invalidateQueries({ queryKey: ["zoom-connection-status"] });
        toast.success("Zoom conectado");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [queryClient]);

  // Check Zoom connection status
  const { data: zoomStatus, isLoading: zoomLoading } = useQuery({
    queryKey: ["zoom-connection-status"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("zoom-oauth-callback", {
        method: "GET",
        body: undefined,
      });
      return data || { connected: false };
    },
    retry: false,
    refetchOnWindowFocus: false,
    enabled: hasSession === true,
  });

  // Check Google Calendar connection status
  const { data: googleStatus, isLoading: googleLoading } = useQuery({
    queryKey: ["google-calendar-connection-status"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("google-calendar-oauth-callback", {
        method: "GET",
        body: undefined,
      });
      return data || { connected: false };
    },
    retry: false,
    refetchOnWindowFocus: false,
    enabled: hasSession === true,
  });

  const handleConnectZoom = async () => {
    setConnectingZoom(true);
    try {
      const { data, error } = await supabase.functions.invoke("zoom-oauth-callback", {
        body: { action: "get_auth_url" },
      });
      if (error) throw error;
      if (data?.auth_url) {
        window.open(data.auth_url, "_blank", "width=600,height=700");
      } else {
        toast.error("Não foi possível obter a URL de autorização do Zoom. Verifique se as credenciais OAuth foram configuradas.");
      }
    } catch (err) {
      toast.error("Erro ao conectar com Zoom. Verifique se a Edge Function está configurada.");
    } finally {
      setConnectingZoom(false);
    }
  };

  const handleDisconnectZoom = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("zoom-oauth-callback", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zoom desconectado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["zoom-connection-status"] });
    },
    onError: () => toast.error("Erro ao desconectar Zoom"),
  });

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth-callback", {
        body: { action: "get_auth_url" },
      });
      if (error) throw error;
      if (data?.auth_url) {
        window.open(data.auth_url, "_blank", "width=600,height=700");
      } else {
        toast.error("Não foi possível obter a URL de autorização do Google. Verifique se as credenciais OAuth foram configuradas.");
      }
    } catch (err) {
      toast.error("Erro ao conectar com Google Calendar. Verifique se a Edge Function está configurada.");
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("google-calendar-oauth-callback", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Google Calendar desconectado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["google-calendar-connection-status"] });
    },
    onError: () => toast.error("Erro ao desconectar Google Calendar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ExternalLink className="h-5 w-5" />
          Integrações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="text-xs">
            Para ativar as integrações, é necessário configurar as credenciais OAuth (Client ID e Secret) nas variáveis de ambiente das Edge Functions.
          </p>
        </div>

        <IntegrationCard
          title="Zoom"
          description="Gere links de reunião automaticamente e envie convites aos leads via WhatsApp."
          icon={<Video className="h-5 w-5" />}
          connected={!!zoomStatus?.connected}
          connectedEmail={zoomStatus?.connected_email}
          connectedAt={zoomStatus?.connected_at}
          loading={zoomLoading || connectingZoom}
          onConnect={handleConnectZoom}
          onDisconnect={() => handleDisconnectZoom.mutate()}
          disconnectLoading={handleDisconnectZoom.isPending}
        />

        <IntegrationCard
          title="Google Calendar"
          description="Sincronize reuniões bidirecionalmente entre o CRM e o Google Calendar."
          icon={<Calendar className="h-5 w-5" />}
          connected={!!googleStatus?.connected}
          connectedEmail={googleStatus?.connected_email}
          connectedAt={googleStatus?.connected_at}
          loading={googleLoading || connectingGoogle}
          onConnect={handleConnectGoogle}
          onDisconnect={() => handleDisconnectGoogle.mutate()}
          disconnectLoading={handleDisconnectGoogle.isPending}
        />
      </CardContent>
    </Card>
  );
}
