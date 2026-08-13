import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RoleConfig = {
  id: string;
  category: string;
  value: string;
  label: string;
  description: string | null;
  sort_order: number | null;
};

const PERMISSION_MODULES = [
  {
    module: "Dashboard",
    permissions: [
      { key: "dashboard.view", label: "Ver dashboard" },
      { key: "dashboard.kpis", label: "Ver KPIs" },
      { key: "dashboard.drilldown", label: "Drill-down" },
    ],
  },
  {
    module: "Leads",
    permissions: [
      { key: "leads.view", label: "Ver leads" },
      { key: "leads.create", label: "Criar" },
      { key: "leads.edit", label: "Editar" },
      { key: "leads.delete", label: "Excluir" },
    ],
  },
  {
    module: "Tarefas",
    permissions: [
      { key: "tasks.view", label: "Ver tarefas" },
      { key: "tasks.create", label: "Criar" },
      { key: "tasks.edit", label: "Editar" },
      { key: "tasks.delete", label: "Excluir" },
    ],
  },
  {
    module: "Calendário",
    permissions: [
      { key: "calendar.view", label: "Ver eventos" },
      { key: "calendar.create", label: "Criar" },
      { key: "calendar.edit", label: "Editar" },
      { key: "calendar.delete", label: "Excluir" },
    ],
  },
  {
    module: "Solicitações de Documentos",
    permissions: [
      { key: "doc_requests.view", label: "Ver solicitações" },
      { key: "doc_requests.create", label: "Criar" },
      { key: "doc_requests.edit", label: "Editar" },
      { key: "doc_requests.delete", label: "Excluir" },
    ],
  },
  {
    module: "Novidades",
    permissions: [
      { key: "updates.view", label: "Ver novidades" },
      { key: "updates.create", label: "Criar" },
    ],
  },
  {
    module: "Ranking",
    permissions: [
      { key: "ranking.view", label: "Ver ranking" },
    ],
  },
  {
    module: "Configurações",
    permissions: [
      { key: "settings.access", label: "Acessar configurações" },
    ],
  },
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function LevelPermissionsMatrix() {
  const queryClient = useQueryClient();
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: levels = [], isLoading: levelsLoading } = useQuery({
    queryKey: ["system-roles-config-admin", "nivel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_roles_config")
        .select("id, category, value, label, description, sort_order")
        .eq("category", "nivel")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as RoleConfig[];
    },
  });

  // Auto-select first level
  const activeLevel = selectedLevel ?? levels[0]?.value ?? null;

  const { data: permissions = [] } = useQuery({
    queryKey: ["level-permissions", activeLevel],
    enabled: !!activeLevel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("level_permissions")
        .select("permission_key, enabled")
        .eq("nivel_value", activeLevel!);
      if (error) throw error;
      return data as { permission_key: string; enabled: boolean }[];
    },
  });

  const permMap = new Map(permissions.map((p) => [p.permission_key, p.enabled]));

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      if (!activeLevel) return;
      const { error } = await supabase
        .from("level_permissions")
        .upsert(
          { nivel_value: activeLevel, permission_key: key, enabled },
          { onConflict: "nivel_value,permission_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-permissions", activeLevel] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLevelMutation = useMutation({
    mutationFn: async () => {
      const label = newLabel.trim();
      if (!label) throw new Error("Nome é obrigatório");
      const value = slugify(label);
      if (!value) throw new Error("Valor inválido");
      const { error } = await supabase.from("system_roles_config").insert({
        category: "nivel",
        value,
        label,
        description: newDesc.trim(),
        sort_order: (levels.length + 1) * 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-admin"] });
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-options"] });
      setNewLabel("");
      setNewDesc("");
      toast.success("Nível adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLevelMutation = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase
        .from("system_roles_config")
        .update({ label: label.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-admin"] });
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-options"] });
      setEditingId(null);
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLevelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_roles_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-admin"] });
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-options"] });
      setSelectedLevel(null);
      toast.success("Nível removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (levelsLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Level selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {levels.map((level) => (
          <div key={level.id} className="flex items-center gap-1">
            {editingId === level.id ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-8 w-32"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateLevelMutation.mutate({ id: level.id, label: editLabel })}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={activeLevel === level.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedLevel(level.value)}
                className="relative group"
              >
                {level.label}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Edit / Delete controls for selected level */}
      {activeLevel && (
        <div className="flex gap-1">
          {(() => {
            const lvl = levels.find((l) => l.value === activeLevel);
            if (!lvl) return null;
            return (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingId(lvl.id);
                    setEditLabel(lvl.label);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Renomear
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir nível
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir "{lvl.label}"</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza? As permissões associadas a este nível serão mantidas no banco, mas o nível não aparecerá mais como opção.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteLevelMutation.mutate(lvl.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            );
          })()}
        </div>
      )}

      {/* Permissions matrix */}
      {activeLevel && (
        <div className="space-y-1 border rounded-lg overflow-hidden">
          {PERMISSION_MODULES.map((mod, idx) => (
            <div
              key={mod.module}
              className={cn(
                "px-4 py-3",
                idx > 0 && "border-t"
              )}
            >
              <h4 className="font-medium text-sm mb-2">{mod.module}</h4>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {mod.permissions.map((perm) => {
                  const checked = permMap.get(perm.key) ?? false;
                  return (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 text-sm cursor-pointer select-none"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(val) =>
                          toggleMutation.mutate({ key: perm.key, enabled: !!val })
                        }
                      />
                      {perm.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!activeLevel && levels.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum nível cadastrado. Adicione um abaixo.</p>
      )}

      {/* Add new level */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addLevelMutation.mutate();
        }}
        className="flex flex-col sm:flex-row gap-2 pt-2 border-t"
      >
        <Input
          placeholder="Nome do nível (ex: Gerente)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="sm:w-[180px]"
          required
        />
        <Input
          placeholder="Descrição (opcional)"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={addLevelMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Nível
        </Button>
      </form>
    </div>
  );
}
