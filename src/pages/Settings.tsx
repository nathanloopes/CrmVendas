import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Mail, Shield } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import KanbanBoardEditor from "@/components/settings/KanbanBoardEditor";
import AccessRequestsPanel from "@/components/settings/AccessRequestsPanel";
import UsersPanel from "@/components/settings/UsersPanel";
import RolesAndLevelsPanel from "@/components/settings/RolesAndLevelsPanel";
import StaleLeadAlertSettingsPanel from "@/components/settings/StaleLeadAlertSettingsPanel";
import IntegrationsPanel from "@/components/settings/IntegrationsPanel";
import ChangePasswordPanel from "@/components/settings/ChangePasswordPanel";


const ALLOWED_DOMAIN = "@example.com";

export default function Settings() {
  const { isAdmin, hasElevatedAccess, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newFuncao, setNewFuncao] = useState<string>("");
  const [newNivel, setNewNivel] = useState<string>("");
  const [newEquipe, setNewEquipe] = useState<string>("none");

  const { data: approvedEmails, isLoading } = useQuery({
    queryKey: ["approved-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approved_emails")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: equipeOptions = [] } = useQuery({
    queryKey: ["system-roles-config", "equipe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_roles_config")
        .select("value, label")
        .eq("category", "equipe")
        .order("sort_order");
      if (error) throw error;
      return data as { value: string; label: string }[];
    },
    enabled: isAdmin,
  });

  const { data: funcaoOptions = [] } = useQuery({
    queryKey: ["system-roles-config", "funcao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_roles_config")
        .select("value, label")
        .eq("category", "funcao")
        .order("sort_order");
      if (error) throw error;
      return data as { value: string; label: string }[];
    },
    enabled: isAdmin,
  });

  const { data: nivelOptions = [] } = useQuery({
    queryKey: ["system-roles-config", "nivel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_roles_config")
        .select("value, label")
        .eq("category", "nivel")
        .order("sort_order");
      if (error) throw error;
      return data as { value: string; label: string }[];
    },
    enabled: isAdmin,
  });

  const addEmailMutation = useMutation({
    mutationFn: async () => {
      const email = newEmail.toLowerCase().trim();
      if (!email.endsWith(ALLOWED_DOMAIN)) {
        throw new Error(`Apenas emails ${ALLOWED_DOMAIN} são permitidos.`);
      }
      if (!newFuncao || !newNivel) {
        throw new Error("Selecione Função e Nível antes de aprovar o email.");
      }
      const derivedRole =
        newFuncao === "Administrativo" && newNivel === "Administrativo" ? "admin" : "agent";
      const { error } = await supabase.from("approved_emails").insert({
        email,
        invited_user_name: newName.trim() || null,
        role: derivedRole,
        equipe: newEquipe === "none" ? null : newEquipe,
        funcao: newFuncao,
        nivel: newNivel,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Email adicionado", description: "O email foi aprovado com sucesso." });
      setNewEmail("");
      setNewName("");
      setNewFuncao("");
      setNewNivel("");
      setNewEquipe("none");
      queryClient.invalidateQueries({ queryKey: ["approved-emails"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("approved_emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Email removido" });
      queryClient.invalidateQueries({ queryKey: ["approved-emails"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  if (authLoading) return null;
  if (!hasElevatedAccess) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie os emails aprovados para cadastro no sistema.</p>
      </div>

      <ChangePasswordPanel />

      {isAdmin && (
        <>
          <AccessRequestsPanel />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Aprovar novo email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addEmailMutation.mutate();
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="flex-1">
                  <Label htmlFor="new-name" className="sr-only">Nome</Label>
                  <Input
                    id="new-name"
                    placeholder="Nome do usuário"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="new-email" className="sr-only">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder={`email${ALLOWED_DOMAIN}`}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="w-full sm:w-40">
                  <Select value={newFuncao} onValueChange={setNewFuncao}>
                    <SelectTrigger>
                      <SelectValue placeholder="Função" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcaoOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-40">
                  <Select value={newNivel} onValueChange={setNewNivel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nível" />
                    </SelectTrigger>
                    <SelectContent>
                      {nivelOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-44">
                  <Select value={newEquipe} onValueChange={setNewEquipe}>
                    <SelectTrigger>
                      <SelectValue placeholder="Equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem equipe</SelectItem>
                      {equipeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={addEmailMutation.isPending}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5" />
                Emails aprovados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : !approvedEmails?.length ? (
                <p className="text-muted-foreground text-sm">Nenhum email aprovado ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedEmails.map((item) => {
                      const equipeLabel = equipeOptions.find((o) => o.value === (item as any).equipe)?.label;
                      const funcaoLabel = funcaoOptions.find((o) => o.value === (item as any).funcao)?.label;
                      const nivelLabel = nivelOptions.find((o) => o.value === (item as any).nivel)?.label;
                      return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.email}</TableCell>
                        <TableCell>{item.invited_user_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{item.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {funcaoLabel ? (
                            <Badge variant="outline">{funcaoLabel}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {nivelLabel ? (
                            <Badge variant="outline">{nivelLabel}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {equipeLabel ? (
                            <Badge variant="outline">{equipeLabel}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === "pending" ? "outline" : "default"}>
                            {item.status === "pending" ? "Pendente" : "Usado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(item.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {item.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteEmailMutation.mutate(item.id)}
                              disabled={deleteEmailMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <UsersPanel />
          <RolesAndLevelsPanel />
          <StaleLeadAlertSettingsPanel />
          <IntegrationsPanel />
        </>

       )}

      <KanbanBoardEditor />
    </div>
  );
}
