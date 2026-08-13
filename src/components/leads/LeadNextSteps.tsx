import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface LeadNextStepsProps {
  leadId: string;
}

type Suggestion = {
  title: string;
  description: string;
  priority?: string;
};

type PendingTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  status: string;
};

export function LeadNextSteps({ leadId }: LeadNextStepsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Auto-fetch pending tasks for this lead
  useEffect(() => {
    const fetchPendingTasks = async () => {
      setLoadingTasks(true);
      const { data } = await supabase
        .from("tasks")
        .select("id, title, description, priority, due_date, status")
        .eq("lead_id", leadId)
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(20);
      setPendingTasks(data || []);
      setLoadingTasks(false);
    };
    fetchPendingTasks();
  }, [leadId]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setSuggestions(null);

    try {
      const { data, error } = await supabase.functions.invoke("suggest-next-steps", {
        body: { lead_id: leadId },
      });

      if (error) { toast.error("Erro ao gerar sugestões"); return; }
      if (data?.error) { toast.error(data.error); return; }

      const items = data?.suggestions || data?.steps || data?.next_steps || (Array.isArray(data) ? data : []);
      setSuggestions(items);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar sugestões");
    } finally {
      setLoading(false);
    }
  };

  const priorityColor = (p?: string) => {
    switch (p?.toLowerCase()) {
      case "alta": case "high": return "destructive";
      case "média": case "medium": return "default";
      default: return "secondary";
    }
  };

  const formatDue = (d: string | null) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch { return null; }
  };

  return (
    <div className="space-y-4">
      {/* Pending tasks from transcription */}
      {loadingTasks ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando tarefas pendentes...
        </div>
      ) : pendingTasks.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Tarefas Pendentes ({pendingTasks.length})
          </h4>
          {pendingTasks.map(task => (
            <Card key={task.id} className="p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{task.title}</span>
                    <Badge variant={priorityColor(task.priority)} className="text-xs">{task.priority}</Badge>
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground">até {formatDue(task.due_date)}</span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{task.description.split("\n")[0]}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {/* AI Suggestions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Use IA para sugerir os próximos passos com base no histórico do lead.
        </p>
        <Button onClick={fetchSuggestions} disabled={loading} size="sm">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : suggestions ? (
            <RefreshCw className="h-4 w-4 mr-1" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          {suggestions ? "Atualizar" : "Gerar Sugestões"}
        </Button>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <Card key={i} className="p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.title}</span>
                    {s.priority && (
                      <Badge variant={priorityColor(s.priority)} className="text-xs">{s.priority}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Não foi possível gerar sugestões para este lead.
        </p>
      )}
    </div>
  );
}
