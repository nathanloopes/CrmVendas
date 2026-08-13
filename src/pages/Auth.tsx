import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, ArrowRight, User } from "lucide-react";

const ALLOWED_DOMAIN = "@example.com";

function validateDomain(email: string): boolean {
  return email.toLowerCase().trim().endsWith(ALLOWED_DOMAIN);
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDomain(email)) {
      toast({
        title: "Domínio não permitido",
        description: `Apenas emails ${ALLOWED_DOMAIN} são aceitos.`,
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        title: "Erro ao entrar",
        description: error.message === "Invalid login credentials"
          ? "Email ou senha inválidos."
          : error.message,
        variant: "destructive",
      });
    } else {
      navigate("/");
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDomain(email)) {
      toast({
        title: "Domínio não permitido",
        description: `Apenas emails ${ALLOWED_DOMAIN} são aceitos.`,
        variant: "destructive",
      });
      return;
    }
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe seu nome para criar a conta.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      const { data: approval, error: rpcError } = await supabase.rpc("check_email_approval", {
        check_email: email.toLowerCase().trim(),
      });

      if (rpcError) {
        toast({ title: "Erro", description: rpcError.message, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const approvalData = approval as { approved: boolean; message: string; role?: string; reason?: string };

      if (!approvalData.approved) {
        const { error: requestError } = await supabase
          .from("access_requests")
          .insert({ email: email.toLowerCase().trim(), name: name.trim() });

        if (requestError && !requestError.message.includes("duplicate")) {
          toast({ title: "Erro", description: requestError.message, variant: "destructive" });
        } else {
          setRequestSent(true);
        }
        setIsLoading(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) {
        toast({ title: "Erro ao cadastrar", description: signUpError.message, variant: "destructive" });
      } else {
        toast({
          title: "Conta criada com sucesso!",
          description: "Verifique sua caixa de entrada para confirmar o email.",
        });
        setIsSignUp(false);
        setName("");
        setPassword("");
      }
    } catch {
      toast({ title: "Erro", description: "Ocorreu um erro inesperado.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDomain(email)) {
      toast({
        title: "Domínio não permitido",
        description: `Apenas emails ${ALLOWED_DOMAIN} são aceitos.`,
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Email enviado",
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
      setIsForgotPassword(false);
    }
    setIsLoading(false);
  };

  const getTitle = () => {
    if (isForgotPassword) return "Redefinir senha";
    if (isSignUp) return "Criar conta";
    return "Entrar";
  };

  const getDescription = () => {
    if (isForgotPassword) return "Informe seu email para receber o link de recuperação.";
    if (isSignUp) return "Preencha os dados para criar sua conta.";
    return "Use suas credenciais para acessar o sistema.";
  };

  const getSubmitHandler = () => {
    if (isForgotPassword) return handleForgotPassword;
    if (isSignUp) return handleSignUp;
    return handleLogin;
  };

  const getSubmitLabel = () => {
    if (isLoading) return "Aguarde...";
    if (isForgotPassword) return "Enviar link";
    if (isSignUp) return "Criar conta";
    return "Entrar";
  };

  if (requestSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Solicitação enviada!</h1>
          <p className="text-muted-foreground">
            Sua solicitação de acesso foi enviada com sucesso. Um administrador irá analisar e aprovar seu cadastro em breve.
          </p>
          <Button variant="outline" className="rounded-xl" onClick={() => { setRequestSent(false); setIsSignUp(false); }}>
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Vendas CRM</h1>
          <p className="text-muted-foreground text-sm">
            {isForgotPassword ? "Recupere sua senha" : isSignUp ? "Crie sua conta" : "Acesse sua conta"}
          </p>
        </div>

        <Card className="rounded-2xl shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{getTitle()}</CardTitle>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="w-full rounded-xl shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Acessar sistema (demo)
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">ou entre com suas credenciais</span>
              </div>
            </div>

            <form onSubmit={getSubmitHandler()} className="space-y-4">
              {isSignUp && !isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 rounded-xl bg-muted/50 border-border"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={`seu@example.com`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 rounded-xl bg-muted/50 border-border"
                    required
                  />
                </div>
              </div>

              {!isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 rounded-xl bg-muted/50 border-border"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full rounded-xl shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
                {getSubmitLabel()}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>

            <div className="mt-4 text-center space-y-2">
              {!isSignUp && !isForgotPassword && (
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                >
                  Esqueceu a senha?
                </button>
              )}
              {isForgotPassword && (
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                >
                  Voltar ao login
                </button>
              )}
              {!isForgotPassword && (
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors block w-full"
                >
                  {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Cadastre-se"}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
