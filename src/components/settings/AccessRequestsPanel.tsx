import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserPlus, Copy, Mail, KeyRound, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ApprovalResult = {
  email: string;
  name: string | null;
  temporary_password: string | null;
  email_sent: boolean;
  already_existed: boolean;
};

export default function AccessRequestsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [equipeByRequest, setEquipeByRequest] = useState<Record<string, string>>({});
  const [funcaoByRequest, setFuncaoByRequest] = useState<Record<string, string>>({});
  const [nivelByRequest, setNivelByRequest] = useState<Record<string, string>>({});
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [result, setResult] = useState<ApprovalResult | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["access-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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
  });

  const approveMutation = useMutation({
    mutationFn: async (request: {
      id: string;
      email: string;
      name: string;
      equipe: string | null;
      funcao: string | null;
      nivel: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("approve-access-request", {
        body: {
          request_id: request.id,
          email: request.email,
          name: request.name,
          equipe: request.equipe,
          funcao: request.funcao,
          nivel: request.nivel,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { ...data, email: request.email, name: request.name } as ApprovalResult;
    },
    onSuccess: (data) => {
      toast({
        title: "Solicitação aprovada",
        description: data.already_existed
          ? "Usuário já existia — permissões atualizadas."
          : "Conta criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["approved-emails"] });
      queryClient.invalidateQueries({ queryKey: ["settings-users"] });
      setOpenPopoverId(null);
      setResult(data);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("access_requests")
        .update({
          status: "rejected",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação rejeitada" });
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado` });
  };

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" />
            Solicitações de Acesso
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !requests?.length ? (
            <p className="text-muted-foreground text-sm">Nenhuma solicitação de acesso.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((item) => {
                  const selectedEquipe = equipeByRequest[item.id] ?? "none";
                  const selectedFuncao = funcaoByRequest[item.id] ?? "";
                  const selectedNivel = nivelByRequest[item.id] ?? "";
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name || "—"}</TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "pending" ? "outline" :
                            item.status === "approved" ? "default" : "destructive"
                          }
                        >
                          {item.status === "pending" ? "Pendente" :
                            item.status === "approved" ? "Aprovado" : "Rejeitado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.status === "pending" && (
                          <div className="flex gap-1">
                            <Popover
                              open={openPopoverId === item.id}
                              onOpenChange={(open) => setOpenPopoverId(open ? item.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" title="Aprovar">
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80" align="end">
                                <div className="space-y-3">
                                  <div>
                                    <Label className="text-xs">Função</Label>
                                    <Select
                                      value={selectedFuncao}
                                      onValueChange={(v) => setFuncaoByRequest((prev) => ({ ...prev, [item.id]: v }))}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Selecionar função" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {funcaoOptions.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Nível</Label>
                                    <Select
                                      value={selectedNivel}
                                      onValueChange={(v) => setNivelByRequest((prev) => ({ ...prev, [item.id]: v }))}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Selecionar nível" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {nivelOptions.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Equipe (opcional)</Label>
                                    <Select
                                      value={selectedEquipe}
                                      onValueChange={(v) => setEquipeByRequest((prev) => ({ ...prev, [item.id]: v }))}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Selecionar equipe" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Sem equipe</SelectItem>
                                        {equipeOptions.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      Selecione "Jurídico" para liberar acesso apenas à página de Documentos.
                                    </p>
                                  </div>
                                  <Button
                                    className="w-full"
                                    size="sm"
                                    onClick={() => approveMutation.mutate({
                                      id: item.id,
                                      email: item.email,
                                      name: item.name,
                                      equipe: selectedEquipe === "none" ? null : selectedEquipe,
                                      funcao: selectedFuncao || null,
                                      nivel: selectedNivel || null,
                                    })}
                                    disabled={approveMutation.isPending || !selectedFuncao || !selectedNivel}
                                  >
                                    {approveMutation.isPending ? "Criando conta..." : "Confirmar aprovação"}
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => rejectMutation.mutate(item.id)}
                              disabled={rejectMutation.isPending}
                              title="Rejeitar"
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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

      {/* Diálogo de resultado da aprovação */}
      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Acesso liberado
            </DialogTitle>
            <DialogDescription>
              {result?.already_existed
                ? `O usuário ${result?.email} já tinha conta. Permissões e dados foram atualizados.`
                : `A conta de ${result?.email} foi criada e já aparece em "Usuários Cadastrados".`}
            </DialogDescription>
          </DialogHeader>

          {result?.temporary_password && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                  <KeyRound className="h-3.5 w-3.5" />
                  Senha temporária (mostrada apenas uma vez)
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border rounded px-2 py-1.5 font-mono text-sm select-all">
                    {result.temporary_password}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0"
                    onClick={() => copyToClipboard(result.temporary_password!, "Senha")}
                    title="Copiar senha"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  O usuário pode entrar com esta senha e trocá-la depois.
                </p>
              </div>

              <div
                className={`flex items-start gap-2 rounded-md p-2.5 text-xs ${
                  result.email_sent
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-500"
                }`}
              >
                {result.email_sent ? (
                  <Mail className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <div>
                  {result.email_sent ? (
                    <>
                      Enviamos um e-mail para <strong>{result.email}</strong> com link
                      para definir uma nova senha.
                    </>
                  ) : (
                    <>
                      Não conseguimos enviar o e-mail automaticamente. Repasse a senha
                      acima manualmente ao usuário.
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResult(null)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
