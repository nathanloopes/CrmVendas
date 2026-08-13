import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, TrendingDown, Minus, Loader2, CheckCircle2, AlertTriangle, Target, Lightbulb, ArrowRight, Clock, GraduationCap, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { AIProcessingModal } from "@/components/ai/AIProcessingModal";
import { useAIProgress } from "@/hooks/use-ai-progress";

const SCORE_STATUS = [
  "Avaliando engajamento...",
  "Analisando contexto comercial...",
  "Cruzando histórico de interações...",
  "Calculando temperatura do lead...",
  "Gerando recomendações estratégicas...",
];

type Lead = Tables<"leads">;

interface LeadScoreProps {
  lead: Lead;
}

interface ScoreResult {
  score: number;
  classification: "Quente" | "Morno" | "Frio";
  general_analysis: string;
  transcription_reading: string;
  factors: { name: string; impact: "positive" | "negative" | "neutral"; detail: string }[];
  strengths: string[];
  concerns: string[];
  risk_level: string;
  recommendation: string;
  next_steps: string[];
  summary: string;
  created_at?: string;
}

function getScoreColor(score: number) {
  if (score >= 80) return "hsl(142, 71%, 45%)";
  if (score >= 50) return "hsl(45, 93%, 47%)";
  return "hsl(0, 84%, 60%)";
}

function getClassificationStyle(classification: string) {
  switch (classification) {
    case "Quente": return "bg-green-500/15 text-green-700 border-green-500/30";
    case "Morno": return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    case "Frio": return "bg-red-500/15 text-red-700 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function getRiskStyle(risk: string) {
  const lower = risk.toLowerCase();
  if (lower.startsWith("baixo")) return "bg-green-500/15 text-green-700 border-green-500/30";
  if (lower.startsWith("médio")) return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
  return "bg-red-500/15 text-red-700 border-red-500/30";
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 70;
  const circumference = Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="110" viewBox="0 0 180 110">
        <path d="M 10 100 A 70 70 0 0 1 170 100" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeLinecap="round" />
        <path d="M 10 100 A 70 70 0 0 1 170 100" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${progress} ${circumference}`} className="transition-all duration-1000 ease-out" />
        <text x="90" y="85" textAnchor="middle" className="text-3xl font-bold" fill={color} fontSize="36">{score}</text>
        <text x="90" y="102" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12">de 100</text>
      </svg>
    </div>
  );
}

export function LeadScore({ lead }: LeadScoreProps) {
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [learningText, setLearningText] = useState("");
  const [savingLearning, setSavingLearning] = useState(false);
  const queryClient = useQueryClient();
  const { progress, remainingMs, isOvertime } = useAIProgress(loading, 9000);

  // Load persisted score from database
  useEffect(() => {
    const loadSavedScore = async () => {
      try {
        const { data, error } = await supabase
          .from("lead_score_results")
          .select("*")
          .eq("lead_id", lead.id)
          .maybeSingle();

        if (!error && data) {
          setResult({
            score: data.score,
            classification: data.classification as ScoreResult["classification"],
            general_analysis: data.general_analysis || "",
            transcription_reading: data.transcription_reading || "",
            factors: (data.factors as any) || [],
            strengths: (data.strengths as any) || [],
            concerns: (data.concerns as any) || [],
            risk_level: data.risk_level || "",
            recommendation: data.recommendation || "",
            next_steps: (data.next_steps as any) || [],
            summary: data.summary || "",
            created_at: data.created_at,
          });
        }
      } catch (err) {
        console.error("Error loading saved score:", err);
      } finally {
        setInitialLoading(false);
      }
    };

    loadSavedScore();
  }, [lead.id]);

  const recalculateScore = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("score-lead", {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      setResult({ ...(data as ScoreResult), created_at: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Score recalculado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao calcular score do lead");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando score...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-sm text-muted-foreground">Nenhum score calculado ainda.</p>
        <Button variant="outline" size="sm" onClick={recalculateScore} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Calcular Score
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AIProcessingModal
        open={loading}
        progress={progress}
        remainingMs={remainingMs}
        isOvertime={isOvertime}
        title="Score do Lead"
        statusMessages={SCORE_STATUS}
        footerText="IA calculando probabilidade de fechamento"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Probabilidade de Fechamento</h3>
        <Button variant="outline" size="sm" onClick={recalculateScore} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Recalcular
        </Button>
      </div>

      {/* Last updated */}
      {result.created_at && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Última atualização: {format(new Date(result.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      )}

      {/* Gauge + Classification */}
      <div className="flex flex-col items-center gap-2">
        <ScoreGauge score={result.score} />
        <Badge className={`text-sm px-3 py-1 ${getClassificationStyle(result.classification)}`}>
          {result.classification === "Frio" ? "❄️" : result.classification === "Morno" ? "🌡️" : "🔥"} {result.classification}
        </Badge>
      </div>

      {/* Summary */}
      <div className="bg-muted/50 rounded-lg p-3">
        <p className="text-sm text-foreground">{result.summary}</p>
      </div>

      {/* General Analysis */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Target className="h-4 w-4 text-primary" /> Análise Geral
        </h4>
        <div className="bg-card border rounded-lg p-3">
          <p className="text-sm text-foreground whitespace-pre-line">{result.general_analysis}</p>
        </div>
      </div>

      {/* Transcription Reading */}
      {result.transcription_reading && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-yellow-500" /> Leitura da Transcrição
          </h4>
          <div className="bg-card border rounded-lg p-3">
            <p className="text-sm text-foreground whitespace-pre-line">{result.transcription_reading}</p>
          </div>
        </div>
      )}

      {/* Strengths */}
      {result.strengths?.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium text-green-700">✅ Pontos Fortes</h4>
          <div className="space-y-1">
            {result.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-green-500/5 border border-green-500/15">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                <p className="text-sm">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Concerns */}
      {result.concerns?.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium text-red-700">⚠️ Pontos de Atenção</h4>
          <div className="space-y-1">
            {result.concerns.map((c, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-red-500/5 border border-red-500/15">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                <p className="text-sm">{c}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Level */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-medium">Risco de Não Fechamento</h4>
        <div className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium ${getRiskStyle(result.risk_level)}`}>
          {result.risk_level}
        </div>
      </div>

      {/* Recommendation */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <ArrowRight className="h-4 w-4 text-primary" /> Recomendação Estratégica
        </h4>
        <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
          <p className="text-sm font-medium text-foreground">{result.recommendation}</p>
        </div>
      </div>

      {/* Next Steps */}
      {result.next_steps?.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Próximos Passos</h4>
          <div className="space-y-1">
            {result.next_steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md border bg-card">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Factors */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Fatores de Análise</h4>
        {result.factors.map((factor, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-md border bg-card">
            {factor.impact === "positive" ? (
              <TrendingUp className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
            ) : factor.impact === "negative" ? (
              <TrendingDown className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
            ) : (
              <Minus className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">{factor.name}</p>
              <p className="text-xs text-muted-foreground">{factor.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Learning input */}
      <div className="space-y-2 border-t pt-4">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4 text-primary" /> Ensinar a IA
        </h4>
        <p className="text-xs text-muted-foreground">
          Adicione um aprendizado que será considerado em todos os cálculos futuros de score.
        </p>
        <Textarea
          value={learningText}
          onChange={(e) => setLearningText(e.target.value)}
          placeholder="Ex: Leads que mencionam sócio operacional mulher devem ter peso extra positivo..."
          className="min-h-[80px] text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!learningText.trim() || savingLearning}
          onClick={async () => {
            setSavingLearning(true);
            try {
              const { error } = await supabase
                .from("ai_score_learnings" as any)
                .insert({ content: learningText.trim() } as any);
              if (error) throw error;
              toast.success("Aprendizado adicionado com sucesso!");
              setLearningText("");
            } catch (err) {
              console.error(err);
              toast.error("Erro ao salvar aprendizado");
            } finally {
              setSavingLearning(false);
            }
          }}
        >
          {savingLearning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
          Adicionar Aprendizado
        </Button>
      </div>
    </div>
  );
}
