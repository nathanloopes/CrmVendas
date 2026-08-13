import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save } from "lucide-react";

export default function StaleLeadAlertSettingsPanel() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(3);
  const [intervalHours, setIntervalHours] = useState(24);

  const { data: settings } = useQuery({
    queryKey: ["global-kanban-settings-stale"],
    queryFn: async () => {
      const { data } = await supabase
        .from("global_kanban_settings")
        .select("custom_labels")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .single();
      return data;
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (settings?.custom_labels) {
      const labels = settings.custom_labels as Record<string, any>;
      if (labels.__stale_lead_alert_days__) {
        setDays(Number(labels.__stale_lead_alert_days__));
      }
      if (labels.__stale_lead_notify_interval_hours__) {
        setIntervalHours(Number(labels.__stale_lead_notify_interval_hours__));
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const currentLabels = (settings?.custom_labels as Record<string, any>) || {};
      const updatedLabels = {
        ...currentLabels,
        __stale_lead_alert_days__: days,
        __stale_lead_notify_interval_hours__: intervalHours,
      };

      const { error } = await supabase
        .from("global_kanban_settings")
        .update({ custom_labels: updatedLabels })
        .eq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Configuração salva" });
      queryClient.invalidateQueries({ queryKey: ["global-kanban-settings-stale"] });
      queryClient.invalidateQueries({ queryKey: ["stale-lead-alert-days"] });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Alerta de lead parado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stale-days">Dias sem movimentação para alertar</Label>
              <Input
                id="stale-days"
                type="number"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                O alerta será enviado ao SDR (ou Administrativo para Envio de COF) quando o lead ficar parado por esse tempo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notify-interval">Intervalo entre notificações (horas)</Label>
              <Input
                id="notify-interval"
                type="number"
                min={1}
                max={168}
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                De quanto em quanto tempo uma nova notificação será enviada enquanto o lead continuar parado.
              </p>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
