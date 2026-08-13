import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useIBGECities } from "@/hooks/use-ibge-cities";
import { useParaguayCities } from "@/hooks/use-paraguay-cities";
import { CityCombobox } from "@/components/leads/CityCombobox";
import { StateCombobox } from "@/components/leads/StateCombobox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { getAdministrativeResponsibleForStage } from "@/lib/admin-stage-rules";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId?: string | null;
}

const INITIAL = {
  name: "", last_name: "", phone: "", email: "", city: "", state: "", state_of_interest: "", city_of_interest: "", source: "", interest: "",
  investment: "", sdr_responsible_id: "", commercial_responsible_id: "", administrative_responsible_id: "",
  modelo_loja: "", tipo_proprietario: "", additional_contact_name: "",
  board_id: "", city_available: "unknown", nearest_available_city: "", stage: "",
};

export function AddLeadDialog({ open, onOpenChange, boardId }: AddLeadDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...INITIAL, board_id: boardId || "" });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isOutroMode, setIsOutroMode] = useState(false);

  // Sync boardId prop when it changes
  useState(() => {
    if (boardId && !form.board_id) {
      setForm((f) => ({ ...f, board_id: boardId }));
    }
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

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("status", "active");
      return data || [];
    },
  });

  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const emailInvalid = form.email.trim() !== "" && !emailRegex.test(form.email.trim());

  const mutation = useMutation({
    mutationFn: async () => {
      if (emailInvalid) {
        throw new Error("Email inválido — deixe em branco se não tiver um email válido.");
      }
      const fullName = `${form.name} ${form.last_name}`.trim();

      // Auto-resolve city_available from registry
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

      const { error } = await supabase.from("leads").insert({
        name: fullName,
        phone: form.phone || null,
        email: form.email || null,
        city: form.city || null,
        state: form.state || null,
        state_of_interest: (form as any).state_of_interest || null,
        city_of_interest: form.city_of_interest || null,
        city_available: resolvedCityAvailable,
        nearest_available_city: form.nearest_available_city || null,
        tags: tags.length > 0 ? tags : null,
        source: form.source || null,
        interest: form.interest || null,
        investment: form.investment || null,
        sdr_responsible_id: form.sdr_responsible_id || null,
        commercial_responsible_id: form.commercial_responsible_id || null,
        administrative_responsible_id:
          form.administrative_responsible_id ||
          getAdministrativeResponsibleForStage(
            form.stage || boardStages[0] || "captação",
            form.administrative_responsible_id,
          ) ||
          null,
        modelo_loja: form.modelo_loja || null,
        tipo_proprietario: form.tipo_proprietario || null,
        additional_contact_name: form.additional_contact_name || null,
        stage: form.stage || boardStages[0] || "captação",
        board_id: form.board_id || null,
      });
      if (error) {
        if (error.message?.includes("DUPLICATE_LEAD")) {
          const parts = error.message.match(/DUPLICATE_LEAD:(\w+):([^:]+):(.+)/);
          if (parts) {
            throw new Error(`Lead duplicado! Já existe um lead com este ${parts[1] === "email" ? "email" : "telefone"}: "${parts[3]}"`);
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead criado com sucesso");
      setForm({ ...INITIAL, board_id: boardId || "" });
      setTags([]);
      setTagInput("");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao criar lead"),
  });

  const isParaguay = (selectedBoard?.name || "").toLowerCase() === "paraguai";
  const country: "BR" | "PY" = isParaguay ? "PY" : "BR";

  const ibgeRes = useIBGECities(isParaguay ? "" : form.state);
  const ibgeResInterest = useIBGECities(isParaguay ? "" : form.state_of_interest);
  const pyRes = useParaguayCities(isParaguay ? form.state : "");
  const pyResInterest = useParaguayCities(isParaguay ? form.state_of_interest : "");

  const cities = isParaguay ? (pyRes.data ?? []) : (ibgeRes.data ?? []);
  const citiesLoading = isParaguay ? pyRes.isLoading : ibgeRes.isLoading;
  const citiesInterest = isParaguay ? (pyResInterest.data ?? []) : (ibgeResInterest.data ?? []);
  const citiesInterestLoading = isParaguay ? pyResInterest.isLoading : ibgeResInterest.isLoading;

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const setState = (uf: string) => {
    setForm((f) => ({ ...f, state: uf, city: "" }));
  };

  const setStateOfInterest = (uf: string) => {
    setForm((f) => ({ ...f, state_of_interest: uf, city_of_interest: "" }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
         <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name">Sobrenome *</Label>
              <Input id="last_name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>País *</Label>
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
                  <SelectItem value="none">Selecionar...</SelectItem>
                  {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {boardStages.length > 0 && (
            <div className="grid gap-2">
              <Label>Etapa do Funil</Label>
              <Select value={form.stage || boardStages[0]} onValueChange={(v) => set("stage", v)}>
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
            <div className="grid gap-2">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={emailInvalid ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {emailInvalid && (
                <p className="text-xs text-destructive">Email inválido — deixe em branco se não tiver.</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{isParaguay ? "Departamento onde mora" : "Estado onde mora"}</Label>
              <StateCombobox value={form.state} onChange={setState} country={country} />
            </div>
            <div className="grid gap-2">
              <Label>Cidade onde mora</Label>
              <CityCombobox
                value={form.city}
                onChange={(v) => set("city", v)}
                cities={cities}
                isLoading={citiesLoading}
                disabled={!form.state}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{isParaguay ? "Departamento de interesse" : "Estado de interesse"}</Label>
              <StateCombobox value={form.state_of_interest} onChange={setStateOfInterest} country={country} />
            </div>
            <div className="grid gap-2">
              <Label>Cidade de interesse</Label>
              <CityCombobox
                value={form.city_of_interest}
                onChange={(v) => set("city_of_interest", v)}
                cities={citiesInterest}
                isLoading={citiesInterestLoading}
                disabled={!form.state_of_interest}
                availableOnly={!isParaguay}
                uf={isParaguay ? undefined : form.state_of_interest}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Fonte</Label>
              <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Ex: Google, Indicação..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>SDR</Label>
              <Select value={form.sdr_responsible_id || "none"} onValueChange={(v) => set("sdr_responsible_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Comercial</Label>
              <Select value={form.commercial_responsible_id || "none"} onValueChange={(v) => set("commercial_responsible_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>ADM</Label>
              <Select value={form.administrative_responsible_id || "none"} onValueChange={(v) => set("administrative_responsible_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Modelo de Loja</Label>
              <Select value={form.modelo_loja || "none"} onValueChange={(v) => set("modelo_loja", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
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
            <div className="grid gap-2">
              <Label>Investimento disponível</Label>
              <Input value={form.investment} onChange={(e) => set("investment", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
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
          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Adicionar tag..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
                    setTagInput("");
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => {
                if (tagInput.trim() && !tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
                setTagInput("");
              }}>Adicionar</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter((t) => t !== tag))} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || !form.last_name || !form.phone || !form.board_id || emailInvalid || mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
