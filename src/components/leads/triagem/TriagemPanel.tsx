import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, ExternalLink } from "lucide-react";
import { SendToKanbanDialog } from "./SendToKanbanDialog";

const respostaLabels: Record<string, string> = {
  responsavel: "Responsável pela operação",
  dedicacao: "Dedicação ao negócio",
  casa_propria: "Casa própria",
  carro: "Possui carro",
  marcas: "Marcas de referência",
  idade: "Idade",
  filhos: "Tem filhos",
  idade_filhos: "Idade dos filhos",
  movimento_vida: "Movimento de vida",
  ja_liderou: "Já liderou equipes",
  teve_subordinado: "Já teve subordinados",
  teve_negocio: "Já teve negócio próprio",
  ja_empreendeu: "Já empreendeu",
  instagram: "Instagram",
  grava_videos: "Grava vídeos",
  perfil_social: "Perfil social",
  ambiente: "Prefere ambientes",
  postura: "Postura",
};
const valueLabels: Record<string, string> = {
  sim: "Sim", nao: "Não", eu_mesmo: "Eu mesmo", integral: "Dedicação integral",
  parcial: "Dedicação parcial", expansiva: "Expansiva", retraida: "Retraída",
  agitados: "Agitados", calmos: "Calmos", pe: "Em pé", sentado: "Sentado",
};
function formatValue(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  const s = String(v);
  return valueLabels[s] ?? s;
}

const classifColors: Record<string, string> = {
  forte: "bg-green-100 text-green-800 border-green-300",
  promissor: "bg-amber-100 text-amber-800 border-amber-300",
  risco: "bg-red-100 text-red-800 border-red-300",
};
const classifIcon: Record<string, string> = { forte: "🟢", promissor: "🟡", risco: "🔴" };

export default function TriagemPanel() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<any>(null);
  const [sendTarget, setSendTarget] = useState<any>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["triagem-franqueado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("triagem_franqueado")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 999);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = items.length;
  const fortes = items.filter((i: any) => i.classificacao === "forte").length;
  const promissores = items.filter((i: any) => i.classificacao === "promissor").length;
  const riscos = items.filter((i: any) => i.classificacao === "risco").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Triagem de Candidatos</h2>
        <p className="text-muted-foreground text-sm">Resultados da página "Conhecer Perfil"</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total" value={total} />
        <Kpi label="🟢 Fortes" value={fortes} color="text-green-700" />
        <Kpi label="🟡 Promissores" value={promissores} color="text-amber-700" />
        <Kpi label="🔴 Risco" value={riscos} color="text-red-700" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Classificação</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum candidato ainda.</td></tr>
              )}
              {items.map((it: any) => (
                <tr key={it.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{it.nome}</td>
                  <td className="px-4 py-3">{it.cidade ?? "—"}{it.estado ? `/${it.estado}` : ""}</td>
                  <td className="px-4 py-3">{it.telefone}</td>
                  <td className="px-4 py-3 font-bold">{it.score}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={classifColors[it.classificacao]}>
                      {classifIcon[it.classificacao]} {it.classificacao}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(it.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelected(it)}>Ver detalhes</Button>
                      {it.lead_id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                          onClick={() => navigate(`/leads?openLead=${it.lead_id}`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> No Kanban
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setSendTarget(it)}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Enviar p/ Kanban
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selected.nome}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex flex-wrap gap-3 items-center">
                    <Badge variant="outline" className={classifColors[selected.classificacao]}>
                      {classifIcon[selected.classificacao]} {selected.classificacao}
                    </Badge>
                    <span className="text-2xl font-bold">{selected.score}/100</span>
                  </div>
                  {selected.lead_id ? (
                    <Button variant="outline" className="bg-green-50 text-green-700 border-green-300"
                      onClick={() => navigate(`/leads?openLead=${selected.lead_id}`)}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Abrir lead no Kanban
                    </Button>
                  ) : (
                    <Button onClick={() => { setSendTarget(selected); setSelected(null); }}>
                      <Send className="h-4 w-4 mr-2" /> Enviar para Kanban
                    </Button>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  📞 {selected.telefone} • {selected.cidade ?? "—"}{selected.estado ? `/${selected.estado}` : ""}
                </div>

                {selected.diagnostico && (
                  <Section title="🧠 Diagnóstico"><p className="text-sm leading-relaxed">{selected.diagnostico}</p></Section>
                )}
                {Array.isArray(selected.pontos_fortes) && selected.pontos_fortes.length > 0 && (
                  <Section title="✅ Pontos fortes">
                    <ul className="text-sm space-y-1 list-disc pl-5">
                      {selected.pontos_fortes.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </Section>
                )}
                {Array.isArray(selected.pontos_risco) && selected.pontos_risco.length > 0 && (
                  <Section title="⚠️ Pontos de risco">
                    <ul className="text-sm space-y-1 list-disc pl-5">
                      {selected.pontos_risco.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </Section>
                )}
                {selected.recomendacao && (
                  <Section title="🎯 Recomendação"><p className="text-sm leading-relaxed">{selected.recomendacao}</p></Section>
                )}

                <Section title="📝 Respostas completas">
                  <div className="rounded-lg border bg-slate-50/60 divide-y">
                    {Object.entries(selected.respostas_json ?? {}).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[180px_1fr] gap-3 px-4 py-2.5 text-sm">
                        <div className="text-muted-foreground font-medium">{respostaLabels[k] ?? k}</div>
                        <div className="text-foreground">{formatValue(v)}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <SendToKanbanDialog
        open={!!sendTarget}
        onOpenChange={(o) => !o && setSendTarget(null)}
        candidate={sendTarget}
      />
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? ""}`}>{value}</p>
    </Card>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
