// Cliente Supabase substituído por um mock (dados fictícios, sem backend real).
// Para voltar a usar o Supabase real, restaure a criação do createClient com as
// variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
export { supabase } from './mock-client';