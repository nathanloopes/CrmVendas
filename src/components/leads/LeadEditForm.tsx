import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, X, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useIBGECities } from "@/hooks/use-ibge-cities";
import { useParaguayCities } from "@/hooks/use-paraguay-cities";
import { CityCombobox } from "@/components/leads/CityCombobox";
import { StateCombobox } from "@/components/leads/StateCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { isLostStage } from "@/lib/stage-utils";
import { getAdministrativeResponsibleForStage } from "@/lib/admin-stage-rules";

type Lead = Tables<"leads">;

interface LeadEditFormProps {
  lead: Lead;
  onSaved?: () => void;
  onDirtyChange?: (isDirty: boolean, formData: Record<string, any>) => void;
}

const DEFAULT_COF_MESSAGE = `Olá, tudo bem? 😊\n\nFaço parte do setor administrativo da empresa.\n\nRecebemos a sua solicitação e acabei de encaminhar o material para o seu e-mail.\n\nO documento apresenta de forma detalhada todas as informações do nosso produto/serviço, incluindo:\n\n- Direitos e deveres das partes\n- Estrutura e funcionamento da operação\n- Custos envolvidos\n- Minuta do contrato para análise\n\nÉ um material essencial para que você possa entender o modelo de negócio com total transparência antes de avançar para os próximos passos.\n\nFico à disposição para qualquer dúvida 😊`;

export function LeadEditForm({ lead, onSaved, onDirtyChange }: LeadEditFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: cofPromptData } = useQuery({
    queryKey: ["ai-prompts", "cof_whatsapp_message"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("prompt_text")
        .eq("prompt_type", "cof_whatsapp_message")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    city: lead.city || "",
    state: lead.state || "",
    state_of_interest: lead.state_of_interest || "",
    city_of_interest: lead.city_of_interest || "",
    source: lead.source || "",
    interest: lead.interest || "",
    investment: lead.investment || "",
    lost_reason: lead.lost_reason || "",
    sdr_responsible_id: lead.sdr_responsible_id || "",
    commercial_responsible_id: lead.commercial_responsible_id || "",
    modelo_loja: lead.modelo_loja || "",
    tipo_proprietario: lead.tipo_proprietario || "",
    additional_contact_name: lead.additional_contact_name || "",
    city_available: lead.city_available === true ? "yes" : lead.city_available === false ? "no" : "unknown",
    nearest_available_city: lead.nearest_available_city || "",
    board_id: lead.board_id || "",
    stage: lead.stage || "",
  });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(lead.tags || []);
  const opcoesPredefinidas = ["Sócio", "Esposa", "Gerente", "Familiar", "O próprio lead vai operar"];
  const [isOutroMode, setIsOutroMode] = useState(
    !!(lead.tipo_proprietario && !opcoesPredefinidas.includes(lead.tipo_proprietario))
  );

  useEffect(() => {
    setForm({
      name: lead.name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      city: lead.city || "",
      state: lead.state || "",
      state_of_interest: (lead as any).state_of_interest || "",
      city_of_interest: lead.city_of_interest || "",
      source: lead.source || "",
      interest: lead.interest || "",
      investment: lead.investment || "",
      lost_reason: lead.lost_reason || "",
      sdr_responsible_id: lead.sdr_responsible_id || "",
      commercial_responsible_id: lead.commercial_responsible_id || "",
      modelo_loja: lead.modelo_loja || "",
      tipo_proprietario: lead.tipo_proprietario || "",
      additional_contact_name: lead.additional_contact_name || "",
      city_available: lead.city_available === true ? "yes" : lead.city_available === false ? "no" : "unknown",
      nearest_available_city: lead.nearest_available_city || "",
      board_id: lead.board_id || "",
      stage: lead.stage || "",
    });
    setTags(lead.tags || []);
  }, [lead.id]);

  // Report dirty state to parent
  useEffect(() => {
    if (!onDirtyChange) return;
    const isDirty =
      form.name !== (lead.name || "") ||
      form.phone !== (lead.phone || "") ||
      form.email !== (lead.email || "") ||
      form.city !== (lead.city || "") ||
      form.state !== (lead.state || "") ||
      form.state_of_interest !== ((lead as any).state_of_interest || "") ||
      form.city_of_interest !== (lead.city_of_interest || "") ||
      form.source !== (lead.source || "") ||
      form.interest !== (lead.interest || "") ||
      form.investment !== (lead.investment || "") ||
      form.lost_reason !== (lead.lost_reason || "") ||
      form.sdr_responsible_id !== (lead.sdr_responsible_id || "") ||
      form.commercial_responsible_id !== (lead.commercial_responsible_id || "") ||
      form.modelo_loja !== (lead.modelo_loja || "") ||
      form.tipo_proprietario !== (lead.tipo_proprietario || "") ||
      form.additional_contact_name !== (lead.additional_contact_name || "") ||
      form.nearest_available_city !== (lead.nearest_available_city || "") ||
      form.board_id !== (lead.board_id || "") ||
      form.stage !== (lead.stage || "") ||
      JSON.stringify(tags) !== JSON.stringify(lead.tags || []);

    onDirtyChange(isDirty, { ...form, tags });
  }, [form, tags, onDirtyChange]);

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name, email").eq("status", "active");
      return data || [];
    },
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards-full"],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_boards").select("id, name, stage_order, custom_labels").order("sort_order", { ascending: true });
      return data || [];
    },
  });

  const selectedBoard = boards.find((b) => b.id === form.board_id);
  const boardStages: string[] = (selectedBoard?.stage_order as string[]) || [];
  const customLabels: Record<string, string> = (selectedBoard?.custom_labels as Record<string, string>) || {};

  const isParaguay = (selectedBoard?.name || "").toLowerCase() === "paraguai";
  const country: "BR" | "PY" = isParaguay ? "PY" : "BR";

  const ibgeRes = useIBGECities(isParaguay ? "" : form.state);
  const ibgeResInterest = useIBGECities(isParaguay ? "" : form.state_of_interest);
  const pyRes = useParaguayCities(isParaguay ? form.state : "");
  const pyResInterest = useParaguayCities(isParaguay ? form.state_of_interest : "");

  const ibgeCities = isParaguay ? (pyRes.data ?? []) : (ibgeRes.data ?? []);
  const citiesLoading = isParaguay ? pyRes.isLoading : ibgeRes.isLoading;
  const ibgeCitiesInterest = isParaguay ? (pyResInterest.data ?? []) : (ibgeResInterest.data ?? []);
  const citiesInterestLoading = isParaguay ? pyResInterest.isLoading : ibgeResInterest.isLoading;

  const mutation = useMutation({
    mutationFn: async () => {
      const stageChanged = form.stage !== (lead.stage || "");
      
      if (stageChanged && isLostStage(form.stage) && !form.lost_reason) {
        throw new Error("Informe o motivo da perda antes de mover para Perdido.");
      }

      // Auto-resolve city_available from registry whenever city of interest is set
      let resolvedCityAvailable: boolean | null = null;
      if (form.city_of_interest && form.state_of_interest) {
        const { data: cityRow } = await supabase
          .from("available_cities" as any)
          .select("status")
          .ilike("city", form.city_of_interest)
          .ilike("state", form.state_of_interest)
          .maybeSingle();
        if (cityRow) {
          resolvedCityAvailable = (cityRow as any).status === "available";
        }
      }

      const { error } = await supabase
        .from("leads")
        .update({
          name: form.name || null,
          phone: form.phone || null,
          email: form.email || null,
          city: form.city || null,
          state: form.state || null,
          state_of_interest: form.state_of_interest || null,
          city_of_interest: form.city_of_interest || null,
          source: form.source || null,
          interest: form.interest || null,
          investment: form.investment || null,
          lost_reason: form.lost_reason || null,
          sdr_responsible_id: form.sdr_responsible_id || null,
          commercial_responsible_id: form.commercial_responsible_id || null,
          modelo_loja: form.modelo_loja || null,
          tipo_proprietario: form.tipo_proprietario || null,
          additional_contact_name: form.additional_contact_name || null,
          city_available: resolvedCityAvailable,
          nearest_available_city: form.nearest_available_city || null,
          tags,
          board_id: form.board_id || null,
          stage: form.stage || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      if (error) throw error;

      if (stageChanged && lead.stage) {
        await supabase.from("lead_stage_history").insert({
          lead_id: lead.id,
          old_stage: lead.stage,
          new_stage: form.stage,
          changed_by: user?.id || null,
        });

        // Auto-atribuir Alexandra como responsável administrativo ao mover para "Envio de COF"
        const adminAuto = getAdministrativeResponsibleForStage(
          form.stage,
          (lead as any).administrative_responsible_id
        );
        if (adminAuto) {
          await supabase
            .from("leads")
            .update({ administrative_responsible_id: adminAuto })
            .eq("id", lead.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead atualizado com sucesso");
      onSaved?.();
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar lead:", error);
      toast.error(error?.message || "Erro ao atualizar lead");
    },
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Nome</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>País</Label>
          <Select value={form.board_id || "none"} onValueChange={(v) => {
            const newBoardId = v === "none" ? "" : v;
            const newBoard = boards.find((b) => b.id === newBoardId);
            const firstStage = (newBoard?.stage_order as string[])?.[0] || "";
            const prevBoard = boards.find((b) => b.id === form.board_id);
            const countryChanged = (prevBoard?.name || "").toLowerCase() !== (newBoard?.name || "").toLowerCase();
            setForm((f) => ({
              ...f,
              board_id: newBoardId,
              stage: firstStage,
              ...(countryChanged ? { state: "", city: "", state_of_interest: "", city_of_interest: "" } : {}),
            }));
          }}>
            <SelectTrigger><SelectValue placeholder="Selecionar país" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {boardStages.length > 0 && (
        <div className="grid gap-1.5">
          <Label>Etapa do Funil</Label>
          <Select value={form.stage || boardStages[0]} onValueChange={(v) => {
            setForm((f) => ({ ...f, stage: v, ...(isLostStage(v) ? {} : { lost_reason: "" }) }));
          }}>
            <SelectTrigger><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
            <SelectContent>
              {boardStages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {customLabels[stage] || stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Telefone</Label>
          <div className="flex items-center gap-2">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="flex-1" />
            {form.phone && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const cleaned = form.phone.replace(/\D/g, '');
                    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                    window.open(`https://wa.me/${number}`, '_blank');
                  }}
                  className="text-green-500 hover:text-green-600 transition-colors shrink-0"
                  title="Abrir WhatsApp"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleaned = form.phone.replace(/\D/g, '');
                    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                    const cofMessage = cofPromptData?.prompt_text || DEFAULT_COF_MESSAGE;
                    window.open(`https://wa.me/${number}?text=${encodeURIComponent(cofMessage)}`, '_blank');
                  }}
                  className="text-blue-500 hover:text-blue-600 transition-colors shrink-0"
                  title="Enviar COF via WhatsApp"
                >
                  <FileText className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Fonte</Label>
          <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Ex: Google, Indicação..." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{isParaguay ? "Departamento onde mora" : "Estado onde mora"}</Label>
          <StateCombobox
            value={form.state}
            onChange={(v) => setForm((f) => ({ ...f, state: v, city: "" }))}
            country={country}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Cidade onde mora</Label>
          <CityCombobox
            value={form.city}
            onChange={(v) => set("city", v)}
            cities={ibgeCities}
            isLoading={citiesLoading}
            disabled={!form.state}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>{isParaguay ? "Departamento de interesse" : "Estado de interesse"}</Label>
          <StateCombobox
            value={form.state_of_interest}
            onChange={(v) => setForm((f) => ({ ...f, state_of_interest: v, city_of_interest: "" }))}
            country={country}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Cidade de interesse</Label>
          <CityCombobox
            value={form.city_of_interest}
            onChange={(v) => set("city_of_interest", v)}
            cities={ibgeCitiesInterest}
            isLoading={citiesInterestLoading}
            disabled={!form.state_of_interest}
            availableOnly={!isParaguay}
            uf={isParaguay ? undefined : form.state_of_interest}
          />
        </div>
      </div>

      {/* Campo Interesse removido */}

      {isLostStage(form.stage) && (
        <div className="grid gap-1.5">
          <Label>Motivo da perda</Label>
          <Textarea value={form.lost_reason} onChange={(e) => set("lost_reason", e.target.value)} rows={2} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>SDR</Label>
          <Select value={form.sdr_responsible_id} onValueChange={(v) => set("sdr_responsible_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Comercial</Label>
          <Select value={form.commercial_responsible_id} onValueChange={(v) => set("commercial_responsible_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Modelo de Loja</Label>
          <Select value={form.modelo_loja} onValueChange={(v) => set("modelo_loja", v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="junior">Júnior - Até 40 mil habitantes</SelectItem>
              <SelectItem value="light">Light - 40 a 60 mil habitantes</SelectItem>
              <SelectItem value="padrao-60-70">Padrão A - 60 a 70 mil habitantes</SelectItem>
              <SelectItem value="padrao-70-80">Padrão B - 70 a 80 mil habitantes</SelectItem>
              <SelectItem value="padrao-80-120">Padrão C - 80 a 120 mil habitantes</SelectItem>
              <SelectItem value="intermediaria-120-150">Intermediária A - 120 a 150 mil habitantes</SelectItem>
              <SelectItem value="intermediaria-150-200">Intermediária B - 150 a 200 mil habitantes</SelectItem>
              <SelectItem value="intermediaria-200-250">Intermediária C - 200 a 250 mil habitantes</SelectItem>
              <SelectItem value="intermediaria-250-300">Intermediária D - 250 a 300 mil habitantes</SelectItem>
              <SelectItem value="intermediaria-300-mais">Intermediária E - 300 mil +</SelectItem>
              <SelectItem value="regiao-metropolitana">Capital e Metropolitana</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Investimento disponível</Label>
          <Input value={form.investment} onChange={(e) => set("investment", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label>Quem vai operar a loja?</Label>
          {(() => {
            const opcoes = ["Sócio", "Esposa", "Gerente", "Familiar", "O próprio lead vai operar"];
            const isCustom = form.tipo_proprietario && !opcoes.includes(form.tipo_proprietario);
            const selectValue = (isOutroMode || isCustom) ? "__outro__" : (form.tipo_proprietario || "none");
            return (
              <>
                <Select value={selectValue} onValueChange={(v) => {
                  if (v === "__outro__") { setIsOutroMode(true); set("tipo_proprietario", ""); }
                  else { setIsOutroMode(false); set("tipo_proprietario", v === "none" ? "" : v); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar</SelectItem>
                    {opcoes.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    <SelectItem value="__outro__">Outro</SelectItem>
                  </SelectContent>
                </Select>
                {(isOutroMode || isCustom) && (
                  <Input className="mt-1.5" value={form.tipo_proprietario} onChange={(e) => set("tipo_proprietario", e.target.value)} placeholder="Digite a opção..." />
                )}
              </>
            );
          })()}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Adicionar tag..."
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>Adicionar</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
        <Save className="h-4 w-4 mr-1" />
        {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
}
