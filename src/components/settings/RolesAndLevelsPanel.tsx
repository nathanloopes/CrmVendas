import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ShieldCheck, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import LevelPermissionsMatrix from "./LevelPermissionsMatrix";

type RoleConfig = {
  id: string;
  category: string;
  value: string;
  label: string;
  description: string | null;
  sort_order: number | null;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function EditableRow({ item, onDeleted }: { item: RoleConfig; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(item.label);
  const [editDesc, setEditDesc] = useState(item.description || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!item.id) throw new Error("Registro inválido, recarregue a página");
      const { error } = await supabase
        .from("system_roles_config")
        .update({ label: editLabel.trim(), description: editDesc.trim() })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-admin"] });
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-options"] });
      setIsEditing(false);
      toast.success("Atualizado com sucesso");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!item.id) throw new Error("Registro inválido, recarregue a página");
      const { error } = await supabase
        .from("system_roles_config")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onDeleted();
      toast.success("Removido com sucesso");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao remover"),
  });

  const startEdit = () => {
    setEditLabel(item.label);
    setEditDesc(item.description || "");
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <TableRow>
        <TableCell>
          <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8" />
        </TableCell>
        <TableCell>
          <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-8" />
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateMutation.mutate()}>
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{item.label}</TableCell>
      
      <TableCell className="text-sm text-muted-foreground">{item.description || "—"}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir "{item.label}"</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza? Usuários que possuem este valor atribuído não serão alterados, mas o valor não aparecerá mais como opção.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CategorySection({ category, title }: { category: string; title: string }) {
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["system-roles-config-admin", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_roles_config")
        .select("id, category, value, label, description, sort_order")
        .eq("category", category)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as RoleConfig[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const label = newLabel.trim();
      if (!label) throw new Error("Label é obrigatório");
      const value = slugify(label);
      if (!value) throw new Error("Valor inválido");
      const { error } = await supabase
        .from("system_roles_config")
        .insert({
          category,
          value,
          label,
          description: newDesc.trim(),
          sort_order: (items.length + 1) * 10,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-admin"] });
      queryClient.invalidateQueries({ queryKey: ["system-roles-config-options"] });
      setNewLabel("");
      setNewDesc("");
      toast.success(`${title.slice(0, -1)} adicionada`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Nome</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground text-sm">Carregando...</TableCell>
            </TableRow>
          ) : !items.length ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground text-sm">Nenhum item cadastrado.</TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <EditableRow
                key={item.id}
                item={item}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ["system-roles-config-admin"] });
                  queryClient.invalidateQueries({ queryKey: ["system-roles-config-options"] });
                }}
              />
            ))
          )}
        </TableBody>
      </Table>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addMutation.mutate();
        }}
        className="flex flex-col sm:flex-row gap-2 pt-2 border-t"
      >
        <Input
          placeholder="Nome (ex: Gerente)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="sm:w-[160px]"
          required
        />
        <Input
          placeholder="Descrição do que essa opção faz"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={addMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </form>
    </div>
  );
}

export default function RolesAndLevelsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" />
          Funções e Níveis de Acesso
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="funcao">
          <TabsList>
            <TabsTrigger value="funcao">Funções</TabsTrigger>
            <TabsTrigger value="nivel">Níveis de Acesso</TabsTrigger>
          </TabsList>
          <TabsContent value="funcao">
            <CategorySection category="funcao" title="Funções" />
          </TabsContent>
          <TabsContent value="nivel">
            <LevelPermissionsMatrix />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
