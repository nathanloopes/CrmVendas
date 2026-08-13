# Vendas CRM

CRM de vendas enxuto com autenticação, dashboard, gestão de leads, tarefas e
calendário. Projeto full-stack (React + Supabase) com tema claro/escuro,
notificações em tempo real e layout responsivo.

> Projeto de portfólio. Marca, domínios e credenciais foram substituídos por
> placeholders genéricos — configure os seus em `.env` (veja `.env.example`).

## Funcionalidades

- **Autenticação** (Supabase Auth) com rota protegida e reset de senha.
- **Dashboard** com visão geral e indicadores.
- **Leads**: cadastro, acompanhamento e prospecção.
- **Tarefas**: criação, atribuição e alertas.
- **Calendário**: agenda integrada.
- **Configurações**: preferências, perfil e integrações.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui + Radix
- TanStack Query, React Router, React Hook Form + Zod
- Supabase (Auth, Postgres, Storage, Edge Functions)
- Vitest

## Como rodar

```bash
cp .env.example .env   # preencha as variáveis do seu projeto Supabase
npm install
npm run dev
```

Build de produção:

```bash
npm run build
```

## Estrutura

```
src/
  components/   # dashboard, leads, tasks, calendar, settings, ui
  pages/        # Auth, Index, Leads, Tasks, CalendarPage, Settings...
  contexts/     # AuthContext, ThemeContext
  hooks/ lib/   # hooks e utilitários
  integrations/ # cliente Supabase e tipos gerados
supabase/
  functions/    # edge functions usadas pelo app
  config.toml
```

## Notas

- Credenciais do Supabase são lidas de variáveis de ambiente; a *anon key* é
  pública por design.
- O arquivo `src/integrations/supabase/types.ts` é gerado pelo Supabase —
  regenere a partir do seu próprio projeto quando conectar o banco.
- O gate de domínio de login (`ALLOWED_DOMAIN`) usa `@example.com` como
  placeholder; ajuste ou remova para uma demo aberta.
