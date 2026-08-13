import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RefreshCw,
  Sparkles,
  Calendar,
  Lightbulb,
  Target,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AIProcessingModal } from "@/components/ai/AIProcessingModal";
import { useAIProgress } from "@/hooks/use-ai-progress";

const LEAD_SUMMARY_STATUS = [
  "Analisando notas e materiais...",
  "Processando histórico de movimentações...",
  "Avaliando reuniões e transcrições...",
  "Identificando próximos passos...",
  "Gerando resumo executivo...",
];

interface LeadSummaryProps {
  leadId: string;
}

interface SummarySection {
  index: number;
  title: string;
  content: string;
}

const sectionConfig: Record<number, { icon: React.ElementType; borderClass: string; bgClass: string }> = {
  1: { icon: Calendar, borderClass: "border-blue-500/30", bgClass: "bg-blue-500/5" },
  2: { icon: Lightbulb, borderClass: "border-yellow-500/30", bgClass: "bg-yellow-500/5" },
  3: { icon: Target, borderClass: "border-primary/30", bgClass: "bg-primary/5" },
  4: { icon: TrendingUp, borderClass: "border-green-500/30", bgClass: "bg-green-500/5" },
  5: { icon: AlertTriangle, borderClass: "border-orange-500/30", bgClass: "bg-orange-500/5" },
  6: { icon: ArrowRight, borderClass: "border-primary/30", bgClass: "bg-primary/5" },
};

function parseSummarySections(text: string): SummarySection[] {
  const sections: SummarySection[] = [];
  // Split by numbered section headers like "1. ", "2. ", etc.
  const regex = /(?:^|\n)(\d)\.\s+(.+?)(?=\n\d\.\s|\n*$)/gs;
  
  // Alternative approach: split by lines starting with a digit followed by dot
  const lines = text.split("\n");
  let currentSection: SummarySection | null = null;

  for (const line of lines) {
    const match = line.match(/^(\d)\.\s*(.+)/);
    if (match) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        index: parseInt(match[1]),
        title: match[2].replace(/\*\*/g, "").trim(),
        content: "",
      };
    } else if (currentSection) {
      currentSection.content += line + "\n";
    }
  }
  if (currentSection) sections.push(currentSection);
  return sections;
}

function SectionCard({ section }: { section: SummarySection }) {
  const config = sectionConfig[section.index] || sectionConfig[6];
  const Icon = config.icon;

  // Extract alert lines (⚠️) and positive lines (✅)
  const contentLines = section.content.split("\n");
  const alerts: string[] = [];
  const positives: string[] = [];
  const normalLines: string[] = [];

  for (const line of contentLines) {
    const trimmed = line.trim();
    if (!trimmed) { normalLines.push(line); continue; }
    if (trimmed.includes("⚠️")) {
      alerts.push(trimmed.replace(/^[-•*]\s*/, ""));
    } else if (trimmed.includes("✅")) {
      positives.push(trimmed.replace(/^[-•*]\s*/, ""));
    } else {
      normalLines.push(line);
    }
  }

  const normalContent = normalLines.join("\n").trim();

  return (
    <div className={`rounded-lg border ${config.borderClass} ${config.bgClass} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Icon className="h-4 w-4 shrink-0 text-foreground" />
        <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {normalContent && (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:text-sm [&>ul]:text-sm [&>ol]:text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalContent}</ReactMarkdown>
          </div>
        )}

        {/* Positive items */}
        {positives.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {positives.map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-green-500/5 border border-green-500/15">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                <p className="text-sm text-foreground">{item.replace(/✅\s?/, "")}</p>
              </div>
            ))}
          </div>
        )}

        {/* Alert items */}
        {alerts.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {alerts.map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-red-500/5 border border-red-500/15">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                <p className="text-sm text-foreground">{item.replace(/⚠️\s?/, "")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadSummary({ leadId }: LeadSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { progress, remainingMs, isOvertime } = useAIProgress(loading, 9000);

  const generateSummary = useCallback(async () => {
    setLoading(true);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke("lead-summary", {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary);
    } catch (err: any) {
      console.error("Erro ao gerar resumo:", err);
      toast.error("Erro ao gerar resumo do lead");
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  }, [leadId]);

  const sections = summary ? parseSummarySections(summary) : [];
  const hasSections = sections.length > 0;

  return (
    <div className="space-y-4 p-1">
      <AIProcessingModal
        open={loading}
        progress={progress}
        remainingMs={remainingMs}
        isOvertime={isOvertime}
        title="Resumo do Lead"
        statusMessages={LEAD_SUMMARY_STATUS}
        footerText="IA cruzando notas, materiais e movimentações"
      />

      {!summary && !loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <Sparkles className="h-10 w-10 text-primary/60" />
          <div>
            <p className="text-sm font-medium text-foreground">Resumo do Lead com IA</p>
            <p className="text-xs text-muted-foreground mt-1">
              Analisa notas, materiais, transcrições e movimentações do funil para gerar um resumo completo.
            </p>
          </div>
          <Button onClick={generateSummary} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Gerar Resumo
          </Button>
        </div>
      )}

      {summary && !loading && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={generateSummary} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar Resumo
            </Button>
          </div>

          {hasSections ? (
            <div className="space-y-3">
              {sections.map((section) => (
                <SectionCard key={section.index} section={section} />
              ))}
            </div>
          ) : (
            // Fallback: render as markdown if parsing fails
            <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-muted/30 p-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
