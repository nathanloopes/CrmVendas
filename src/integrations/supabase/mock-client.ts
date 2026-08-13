// Mock do cliente Supabase — roda o app sem backend real, com dados fictícios.
// Inclui um pequeno motor de consultas em memória que respeita filtros
// (eq/neq/in/gte/lte/like/contains), ordenação, range/limit, single/maybeSingle
// e mutações (insert/update/delete/upsert) que persistem durante a sessão.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

type Row = Record<string, unknown>;

const DEMO_ID = '00000000-0000-0000-0000-000000000001';
const USER_ANA = '00000000-0000-0000-0000-000000000002';
const USER_BRUNO = '00000000-0000-0000-0000-000000000003';
const USER_CARLA = '00000000-0000-0000-0000-000000000004';

const BOARD_VENDAS = 'board-vendas-0001';
const BOARD_FRANCHISING = 'board-franch-0001';

// ----------------------------- helpers de data -----------------------------
const NOW = new Date();
function atHour(base: Date, h: number, m = 0): string {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function daysAgo(n: number, h = 10): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return atHour(d, h);
}
function daysAhead(n: number, h = 10): string {
  return daysAgo(-n, h);
}
function hoursAgo(n: number): string {
  const d = new Date(NOW);
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

function uid(): string {
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ------------------------------- credenciais --------------------------------
const fakeUser = {
  id: DEMO_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@local.dev',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { name: 'Ana Demo' },
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

const fakeSession = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: fakeUser,
};

// ------------------------------- stage config -------------------------------
const DEFAULT_STAGES = [
  'dados-incompletos', 'captação', 'leads', 'qualificação', 'reagendamento',
  'material-reuniao', 'standby', 'reuniao-modulo-1', 'reuniao-modulo-2',
  'reuniao-modulo-3', 'contrato', 'fechamento', 'ganho', 'perdido',
];

const STAGE_COLORS: Record<string, string> = {
  'captação': '#6366f1',
  'leads': '#0ea5e9',
  'qualificação': '#8b5cf6',
  'reagendamento': '#f59e0b',
  'material-reuniao': '#14b8a6',
  'standby': '#94a3b8',
  'reuniao-modulo-1': '#3b82f6',
  'contrato': '#eab308',
  'fechamento': '#22c55e',
  'ganho': '#16a34a',
  'perdido': '#ef4444',
};

// -------------------------------- datasets ----------------------------------
const users: Row[] = [
  { id: DEMO_ID, name: 'Ana Demo', email: 'demo@local.dev', role: 'admin', status: 'active', funcao: 'Gestora Comercial', nivel: 'supervisor', equipe: 'Comercial', created_at: daysAgo(120) },
  { id: USER_ANA, name: 'Ana Souza', email: 'ana.souza@local.dev', role: 'sdr', status: 'active', funcao: 'SDR', nivel: 'operador', equipe: 'Comercial', created_at: daysAgo(90) },
  { id: USER_BRUNO, name: 'Bruno Lima', email: 'bruno.lima@local.dev', role: 'closer', status: 'active', funcao: 'Consultor', nivel: 'operador', equipe: 'Comercial', created_at: daysAgo(80) },
  { id: USER_CARLA, name: 'Carla Nunes', email: 'carla.nunes@local.dev', role: 'admin', status: 'active', funcao: 'Head de Vendas', nivel: 'supervisor', equipe: 'Diretoria', created_at: daysAgo(200) },
];

const user_roles: Row[] = [
  { user_id: DEMO_ID, role: 'admin' },
  { user_id: USER_CARLA, role: 'admin' },
  { user_id: USER_ANA, role: 'sdr' },
  { user_id: USER_BRUNO, role: 'closer' },
];

const kanban_boards: Row[] = [
  {
    id: BOARD_VENDAS,
    name: 'Vendas',
    is_global: true,
    sort_order: 0,
    created_by: DEMO_ID,
    filters: null,
    stage_order: ['captação', 'qualificação', 'material-reuniao', 'reuniao-modulo-1', 'contrato', 'ganho', 'perdido'],
    custom_labels: { __stage_colors__: STAGE_COLORS },
    created_at: daysAgo(120),
    updated_at: daysAgo(2),
  },
  {
    id: BOARD_FRANCHISING,
    name: 'Franchising',
    is_global: true,
    sort_order: 1,
    created_by: DEMO_ID,
    filters: null,
    stage_order: ['leads', 'qualificação', 'reagendamento', 'standby', 'fechamento', 'ganho', 'perdido'],
    custom_labels: { __stage_colors__: STAGE_COLORS },
    created_at: daysAgo(100),
    updated_at: daysAgo(5),
  },
];

const global_kanban_settings: Row[] = [
  {
    id: '00000000-0000-0000-0000-000000000000',
    stage_order: DEFAULT_STAGES,
    custom_labels: { __stage_colors__: STAGE_COLORS },
    lost_reasons: ['sem-interesse', 'concorrente', 'sem-verba', 'sem-perfil', 'nao-respondeu'],
    created_at: daysAgo(200),
    updated_at: daysAgo(10),
  },
];

type LeadSeed = {
  name: string; city: string; state: string; stage: string; board: string;
  source: string; score: number; created: string; lost?: string; tags?: string[];
};

const leadSeeds: LeadSeed[] = [
  // Vendas — alguns criados hoje para popular o painel "Hoje"
  { name: 'João Silva', city: 'São Paulo', state: 'SP', stage: 'captação', board: BOARD_VENDAS, source: 'website', score: 42, created: daysAgo(0, 9), tags: ['inbound'] },
  { name: 'Marina Costa', city: 'Campinas', state: 'SP', stage: 'captação', board: BOARD_VENDAS, source: 'facebook', score: 35, created: daysAgo(0, 11), tags: ['ads'] },
  { name: 'Rafael Almeida', city: 'Santos', state: 'SP', stage: 'qualificação', board: BOARD_VENDAS, source: 'indicacao', score: 68, created: daysAgo(1), tags: ['quente'] },
  { name: 'Beatriz Ramos', city: 'Rio de Janeiro', state: 'RJ', stage: 'qualificação', board: BOARD_VENDAS, source: 'website', score: 74, created: daysAgo(3), tags: ['quente', 'prioridade'] },
  { name: 'Carlos Mendes', city: 'Belo Horizonte', state: 'MG', stage: 'material-reuniao', board: BOARD_VENDAS, source: 'evento', score: 61, created: daysAgo(4) },
  { name: 'Fernanda Dias', city: 'Curitiba', state: 'PR', stage: 'reuniao-modulo-1', board: BOARD_VENDAS, source: 'indicacao', score: 82, created: daysAgo(6), tags: ['reuniao'] },
  { name: 'Gustavo Rocha', city: 'Porto Alegre', state: 'RS', stage: 'reuniao-modulo-1', board: BOARD_VENDAS, source: 'cold-call', score: 77, created: daysAgo(7) },
  { name: 'Helena Prado', city: 'Salvador', state: 'BA', stage: 'contrato', board: BOARD_VENDAS, source: 'website', score: 89, created: daysAgo(9), tags: ['fechando'] },
  { name: 'Igor Fontes', city: 'Recife', state: 'PE', stage: 'ganho', board: BOARD_VENDAS, source: 'indicacao', score: 95, created: daysAgo(0, 8), tags: ['cliente'] },
  { name: 'Juliana Reis', city: 'Fortaleza', state: 'CE', stage: 'ganho', board: BOARD_VENDAS, source: 'evento', score: 92, created: daysAgo(12) },
  { name: 'Lucas Barros', city: 'Goiânia', state: 'GO', stage: 'perdido', board: BOARD_VENDAS, source: 'facebook', score: 20, created: daysAgo(0, 7), lost: 'sem-verba' },
  { name: 'Patrícia Gomes', city: 'Brasília', state: 'DF', stage: 'perdido', board: BOARD_VENDAS, source: 'cold-call', score: 15, created: daysAgo(14), lost: 'concorrente' },
  // Franchising
  { name: 'André Martins', city: 'Sorocaba', state: 'SP', stage: 'leads', board: BOARD_FRANCHISING, source: 'website', score: 40, created: daysAgo(2) },
  { name: 'Débora Freitas', city: 'Uberlândia', state: 'MG', stage: 'qualificação', board: BOARD_FRANCHISING, source: 'indicacao', score: 66, created: daysAgo(5), tags: ['franquia'] },
  { name: 'Eduardo Pires', city: 'Londrina', state: 'PR', stage: 'reagendamento', board: BOARD_FRANCHISING, source: 'evento', score: 58, created: daysAgo(8) },
  { name: 'Sônia Farias', city: 'Joinville', state: 'SC', stage: 'standby', board: BOARD_FRANCHISING, source: 'website', score: 47, created: daysAgo(11) },
  { name: 'Marcelo Tavares', city: 'Vitória', state: 'ES', stage: 'fechamento', board: BOARD_FRANCHISING, source: 'indicacao', score: 84, created: daysAgo(0, 10), tags: ['fechando'] },
  { name: 'Renata Lopes', city: 'Natal', state: 'RN', stage: 'ganho', board: BOARD_FRANCHISING, source: 'evento', score: 90, created: daysAgo(13) },
];

const leads: Row[] = leadSeeds.map((s, i) => ({
  id: `lead-${String(i + 1).padStart(3, '0')}`,
  name: s.name,
  phone: `+55 ${11 + (i % 20)} 9${String(80000000 + i * 137).slice(0, 8)}`,
  email: `${s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.')}@email.com`,
  city: s.city,
  state: s.state,
  source: s.source,
  stage: s.stage,
  board_id: s.board,
  assigned_to: DEMO_ID,
  sdr_responsible_id: USER_ANA,
  commercial_responsible_id: USER_BRUNO,
  administrative_responsible_id: USER_CARLA,
  lead_score: s.score,
  lost_reason: s.lost ?? null,
  tags: s.tags ?? [],
  city_available: true,
  city_of_interest: s.city,
  state_of_interest: s.state,
  nearest_available_city: s.city,
  last_contact: s.created,
  next_contact: daysAhead((i % 5) + 1),
  interest: s.score > 70 ? 'high' : s.score > 45 ? 'medium' : 'low',
  investment: s.score > 70 ? 'high' : 'medium',
  value: 5000 + i * 1500,
  additional_contact_name: null,
  created_at: s.created,
  updated_at: s.created,
}));

const tasks: Row[] = [
  { id: 'task-001', title: 'Ligar para João Silva', description: 'Primeiro contato de qualificação', status: 'pending', priority: 'high', type: 'lead', lead_id: 'lead-001', due_date: daysAgo(1, 15), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
  { id: 'task-002', title: 'Enviar proposta para Helena', description: 'Contrato em fase final', status: 'pending', priority: 'high', type: 'lead', lead_id: 'lead-008', due_date: daysAgo(0, 17), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: null, created_at: daysAgo(3), updated_at: daysAgo(3) },
  { id: 'task-003', title: 'Reunião de alinhamento semanal', description: 'Time comercial', status: 'pending', priority: 'medium', type: 'internal', lead_id: null, due_date: daysAgo(0, 14), assigned_to: DEMO_ID, created_by: USER_CARLA, completed_at: null, created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: 'task-004', title: 'Follow-up Beatriz Ramos', description: 'Retomar contato', status: 'pending', priority: 'medium', type: 'lead', lead_id: 'lead-004', due_date: daysAhead(1, 11), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: null, created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: 'task-005', title: 'Preparar material Módulo 1', description: 'Fernanda Dias', status: 'pending', priority: 'low', type: 'lead', lead_id: 'lead-006', due_date: daysAhead(2, 9), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
  { id: 'task-006', title: 'Atualizar CRM', description: 'Revisar estágios da semana', status: 'pending', priority: 'low', type: 'internal', lead_id: null, due_date: daysAhead(3, 16), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: null, created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: 'task-007', title: 'Ligar para Gustavo Rocha', description: 'Confirmar reunião', status: 'pending', priority: 'high', type: 'lead', lead_id: 'lead-007', due_date: daysAhead(1, 10), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
  { id: 'task-008', title: 'Enviar contrato Igor Fontes', description: 'Cliente fechado', status: 'completed', priority: 'high', type: 'lead', lead_id: 'lead-009', due_date: daysAgo(2, 12), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: daysAgo(2, 13), created_at: daysAgo(4), updated_at: daysAgo(2) },
  { id: 'task-009', title: 'Qualificar André Martins', description: 'Franchising', status: 'completed', priority: 'medium', type: 'lead', lead_id: 'lead-013', due_date: daysAgo(3, 11), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: daysAgo(3, 12), created_at: daysAgo(5), updated_at: daysAgo(3) },
  { id: 'task-010', title: 'Revisar pipeline Franchising', description: 'Board franchising', status: 'completed', priority: 'low', type: 'internal', lead_id: null, due_date: daysAgo(4, 15), assigned_to: DEMO_ID, created_by: USER_CARLA, completed_at: daysAgo(4, 16), created_at: daysAgo(6), updated_at: daysAgo(4) },
  { id: 'task-011', title: 'Contato Débora Freitas', description: 'Interesse em franquia', status: 'pending', priority: 'medium', type: 'lead', lead_id: 'lead-014', due_date: daysAhead(4, 14), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
  { id: 'task-012', title: 'Fechar Marcelo Tavares', description: 'Fase de fechamento', status: 'pending', priority: 'high', type: 'lead', lead_id: 'lead-017', due_date: daysAgo(0, 18), assigned_to: DEMO_ID, created_by: DEMO_ID, completed_at: null, created_at: daysAgo(1), updated_at: daysAgo(1) },
];

const calendar_events: Row[] = [
  { id: 'evt-001', title: 'Reunião Módulo 1 — Fernanda', description: 'Apresentação inicial', start_datetime: daysAhead(1, 10), end_datetime: daysAhead(1, 11), event_type: 'meeting', status: 'scheduled', lead_id: 'lead-006', responsible_user_id: DEMO_ID, color: '#3b82f6', location: 'Google Meet', attendees: [DEMO_ID, USER_BRUNO], created_by: DEMO_ID, created_at: daysAgo(2) },
  { id: 'evt-002', title: 'Call qualificação — Gustavo', description: 'Confirmar interesse', start_datetime: daysAhead(1, 15), end_datetime: daysAhead(1, 16), event_type: 'call', status: 'scheduled', lead_id: 'lead-007', responsible_user_id: DEMO_ID, color: '#8b5cf6', location: 'Telefone', attendees: [DEMO_ID], created_by: DEMO_ID, created_at: daysAgo(1) },
  { id: 'evt-003', title: 'Fechamento — Helena Prado', description: 'Assinatura de contrato', start_datetime: daysAhead(2, 9), end_datetime: daysAhead(2, 10), event_type: 'meeting', status: 'scheduled', lead_id: 'lead-008', responsible_user_id: DEMO_ID, color: '#22c55e', location: 'Escritório', attendees: [DEMO_ID, USER_CARLA], created_by: DEMO_ID, created_at: daysAgo(1) },
  { id: 'evt-004', title: 'Reunião interna comercial', description: 'Alinhamento semanal', start_datetime: daysAhead(0, 14), end_datetime: daysAhead(0, 15), event_type: 'meeting', status: 'scheduled', lead_id: null, responsible_user_id: DEMO_ID, color: '#6366f1', location: 'Sala 2', attendees: [DEMO_ID, USER_ANA, USER_BRUNO], created_by: USER_CARLA, created_at: daysAgo(3) },
  { id: 'evt-005', title: 'Follow-up Beatriz', description: 'Retomar negociação', start_datetime: daysAhead(3, 11), end_datetime: daysAhead(3, 12), event_type: 'follow_up', status: 'scheduled', lead_id: 'lead-004', responsible_user_id: DEMO_ID, color: '#f59e0b', location: 'Google Meet', attendees: [DEMO_ID], created_by: DEMO_ID, created_at: daysAgo(2) },
  { id: 'evt-006', title: 'Reunião concluída — Igor', description: 'Cliente fechado', start_datetime: daysAgo(2, 10), end_datetime: daysAgo(2, 11), event_type: 'meeting', status: 'completed', lead_id: 'lead-009', responsible_user_id: DEMO_ID, color: '#16a34a', location: 'Escritório', attendees: [DEMO_ID], created_by: DEMO_ID, created_at: daysAgo(5) },
];

const lead_notes: Row[] = [
  { id: 'note-001', lead_id: 'lead-001', content: 'Lead entrou pelo site, interesse inicial.', type: 'note', created_by: DEMO_ID, created_at: hoursAgo(3), mentioned_user_ids: [] },
  { id: 'note-002', lead_id: 'lead-003', content: 'Ligação realizada, cliente pediu proposta.', type: 'call', created_by: DEMO_ID, created_at: hoursAgo(20), mentioned_user_ids: [] },
  { id: 'note-003', lead_id: 'lead-008', content: 'Contrato enviado para assinatura.', type: 'note', created_by: USER_BRUNO, created_at: daysAgo(1, 16), mentioned_user_ids: [] },
  { id: 'note-004', lead_id: 'lead-009', content: 'Cliente fechado! 🎉', type: 'note', created_by: DEMO_ID, created_at: daysAgo(0, 8), mentioned_user_ids: [] },
  { id: 'note-005', lead_id: 'lead-006', content: 'Reunião Módulo 1 agendada.', type: 'meeting', created_by: DEMO_ID, created_at: daysAgo(1, 12), mentioned_user_ids: [] },
];

const lead_stage_history: Row[] = [
  { id: 'hist-001', lead_id: 'lead-003', old_stage: 'captação', new_stage: 'qualificação', changed_by: DEMO_ID, changed_at: daysAgo(1, 9) },
  { id: 'hist-002', lead_id: 'lead-008', old_stage: 'reuniao-modulo-1', new_stage: 'contrato', changed_by: DEMO_ID, changed_at: daysAgo(1, 14) },
  { id: 'hist-003', lead_id: 'lead-009', old_stage: 'contrato', new_stage: 'ganho', changed_by: DEMO_ID, changed_at: daysAgo(0, 8) },
  { id: 'hist-004', lead_id: 'lead-011', old_stage: 'qualificação', new_stage: 'perdido', changed_by: DEMO_ID, changed_at: daysAgo(0, 7) },
  { id: 'hist-005', lead_id: 'lead-006', old_stage: 'material-reuniao', new_stage: 'reuniao-modulo-1', changed_by: DEMO_ID, changed_at: daysAgo(2, 10) },
  { id: 'hist-006', lead_id: 'lead-017', old_stage: 'reagendamento', new_stage: 'fechamento', changed_by: DEMO_ID, changed_at: daysAgo(0, 10) },
];

const db: Record<string, Row[]> = {
  users,
  user_roles,
  kanban_boards,
  global_kanban_settings,
  leads,
  tasks,
  calendar_events,
  lead_notes,
  lead_stage_history,
  notifications: [],
  lead_materials: [],
  lead_documents: [],
};

// --------------------------- motor de consultas -----------------------------
type FilterOp = [op: string, col: string, val: unknown];

function matchesFilter(row: Row, [op, col, val]: FilterOp): boolean {
  const a = row[col];
  switch (op) {
    case 'eq':
      return a === val || String(a) === String(val);
    case 'neq':
      return !(a === val || String(a) === String(val));
    case 'gt':
      return a != null && (a as never) > (val as never);
    case 'gte':
      return a != null && (a as never) >= (val as never);
    case 'lt':
      return a != null && (a as never) < (val as never);
    case 'lte':
      return a != null && (a as never) <= (val as never);
    case 'in':
      return Array.isArray(val) && val.some((v) => v === a || String(v) === String(a));
    case 'is':
      return a === val;
    case 'like':
    case 'ilike': {
      const pattern = String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
      const re = new RegExp(`^${pattern}$`, op === 'ilike' ? 'i' : '');
      return re.test(String(a ?? ''));
    }
    case 'contains':
      return Array.isArray(a) && Array.isArray(val) && (val as unknown[]).every((v) => (a as unknown[]).includes(v));
    default:
      return true;
  }
}

function applyFilters(rows: Row[], filters: FilterOp[]): Row[] {
  if (!filters.length) return rows.slice();
  return rows.filter((r) => filters.every((f) => matchesFilter(r, f)));
}

function applyOrder(rows: Row[], orders: [col: string, asc: boolean][]): Row[] {
  if (!orders.length) return rows;
  const sorted = rows.slice();
  sorted.sort((x, y) => {
    for (const [col, asc] of orders) {
      const a = x[col];
      const b = y[col];
      if (a == null && b == null) continue;
      if (a == null) return asc ? -1 : 1;
      if (b == null) return asc ? 1 : -1;
      if ((a as never) < (b as never)) return asc ? -1 : 1;
      if ((a as never) > (b as never)) return asc ? 1 : -1;
    }
    return 0;
  });
  return sorted;
}

type QueryState = {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  payload: unknown;
  filters: FilterOp[];
  orders: [string, boolean][];
  rangeFrom?: number;
  rangeTo?: number;
  limitN?: number;
  single: 'single' | 'maybeSingle' | null;
  count: boolean;
  head: boolean;
};

function execute(state: QueryState) {
  const table = state.table;
  db[table] = db[table] || [];
  let data: unknown;
  let filteredCount = 0;

  if (state.op === 'insert' || state.op === 'upsert') {
    const list = Array.isArray(state.payload) ? state.payload : [state.payload];
    const inserted = (list as Row[]).map((r) => ({
      id: r.id ?? uid(),
      created_at: r.created_at ?? NOW.toISOString(),
      updated_at: NOW.toISOString(),
      ...r,
    }));
    for (const row of inserted) {
      const idx = state.op === 'upsert' ? db[table].findIndex((x) => x.id === row.id) : -1;
      if (idx >= 0) db[table][idx] = { ...db[table][idx], ...row };
      else db[table].push(row);
    }
    data = inserted;
    filteredCount = inserted.length;
  } else if (state.op === 'update') {
    const matched = applyFilters(db[table], state.filters);
    for (const row of matched) Object.assign(row, state.payload as Row, { updated_at: NOW.toISOString() });
    data = matched;
    filteredCount = matched.length;
  } else if (state.op === 'delete') {
    const keep: Row[] = [];
    const removed: Row[] = [];
    for (const row of db[table]) (state.filters.every((f) => matchesFilter(row, f)) ? removed : keep).push(row);
    db[table] = keep;
    data = removed;
    filteredCount = removed.length;
  } else {
    let rows = applyFilters(db[table], state.filters);
    rows = applyOrder(rows, state.orders);
    filteredCount = rows.length;
    if (state.rangeFrom != null && state.rangeTo != null) rows = rows.slice(state.rangeFrom, state.rangeTo + 1);
    if (state.limitN != null) rows = rows.slice(0, state.limitN);
    data = rows;
  }

  const list = data as Row[];
  const count = state.count ? filteredCount : Array.isArray(data) ? list.length : null;

  if (state.single) {
    const first = list[0] ?? null;
    return { data: first, error: null, count, status: 200, statusText: 'OK' };
  }
  if (state.head) return { data: null, error: null, count, status: 200, statusText: 'OK' };
  return { data: list, error: null, count, status: 200, statusText: 'OK' };
}

function createQueryBuilder(table: string): unknown {
  const state: QueryState = {
    table, op: 'select', payload: null, filters: [], orders: [],
    single: null, count: false, head: false,
  };

  const push = (op: string, col: string, val: unknown) => {
    state.filters.push([op, col, val]);
    return proxy;
  };

  const api: Record<string, unknown> = {
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count) state.count = true;
      if (opts?.head) state.head = true;
      return proxy;
    },
    insert: (payload: unknown) => { state.op = 'insert'; state.payload = payload; return proxy; },
    update: (payload: unknown) => { state.op = 'update'; state.payload = payload; return proxy; },
    upsert: (payload: unknown) => { state.op = 'upsert'; state.payload = payload; return proxy; },
    delete: () => { state.op = 'delete'; return proxy; },
    eq: (c: string, v: unknown) => push('eq', c, v),
    neq: (c: string, v: unknown) => push('neq', c, v),
    gt: (c: string, v: unknown) => push('gt', c, v),
    gte: (c: string, v: unknown) => push('gte', c, v),
    lt: (c: string, v: unknown) => push('lt', c, v),
    lte: (c: string, v: unknown) => push('lte', c, v),
    in: (c: string, v: unknown) => push('in', c, v),
    is: (c: string, v: unknown) => push('is', c, v),
    like: (c: string, v: unknown) => push('like', c, v),
    ilike: (c: string, v: unknown) => push('ilike', c, v),
    contains: (c: string, v: unknown) => push('contains', c, v),
    match: (obj: Record<string, unknown>) => { for (const k of Object.keys(obj)) push('eq', k, obj[k]); return proxy; },
    filter: (c: string, op: string, v: unknown) => push(op, c, v),
    or: () => proxy,
    not: () => proxy,
    order: (c: string, o?: { ascending?: boolean }) => { state.orders.push([c, o?.ascending !== false]); return proxy; },
    range: (f: number, t: number) => { state.rangeFrom = f; state.rangeTo = t; return proxy; },
    limit: (n: number) => { state.limitN = n; return proxy; },
    single: () => { state.single = 'single'; return proxy; },
    maybeSingle: () => { state.single = 'maybeSingle'; return proxy; },
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(execute(state)).then(onF, onR),
  };

  const proxy: Record<string | symbol, unknown> = new Proxy(api, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      return () => proxy;
    },
  });

  return proxy;
}

// ------------------------------- realtime -----------------------------------
function createChannel(): unknown {
  const channel: Record<string, unknown> = {
    on: () => channel,
    subscribe: (cb?: (status: string) => void) => { cb?.('SUBSCRIBED'); return channel; },
    unsubscribe: () => Promise.resolve('ok'),
    send: () => Promise.resolve('ok'),
  };
  return channel;
}

// --------------------------------- auth -------------------------------------
const mockAuth = {
  getSession: async () => ({ data: { session: fakeSession }, error: null }),
  getUser: async () => ({ data: { user: fakeUser }, error: null }),
  onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
    setTimeout(() => cb('SIGNED_IN', fakeSession), 0);
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
  signInWithPassword: async () => ({ data: { session: fakeSession, user: fakeUser }, error: null }),
  signUp: async () => ({ data: { session: fakeSession, user: fakeUser }, error: null }),
  signOut: async () => ({ error: null }),
  updateUser: async () => ({ data: { user: fakeUser }, error: null }),
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
  setSession: async () => ({ data: { session: fakeSession, user: fakeUser }, error: null }),
};

const mockStorage = {
  from: () => ({
    upload: async () => ({ data: { path: 'fake/path' }, error: null }),
    remove: async () => ({ data: [], error: null }),
    createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
    download: async () => ({ data: null, error: null }),
    list: async () => ({ data: [], error: null }),
  }),
};

const mockFunctions = { invoke: async () => ({ data: null, error: null }) };

const mockClient = {
  auth: mockAuth,
  storage: mockStorage,
  functions: mockFunctions,
  from: (table: string) => createQueryBuilder(table),
  rpc: async () => ({ data: null, error: null, count: null, status: 200, statusText: 'OK' }),
  channel: () => createChannel(),
  removeChannel: () => Promise.resolve('ok'),
  removeAllChannels: () => Promise.resolve([]),
  getChannels: () => [],
};

export const supabase = mockClient as unknown as SupabaseClient<Database>;
