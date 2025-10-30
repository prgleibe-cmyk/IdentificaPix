import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Lê variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY;

// Verificação preventiva para evitar erro de chave indefinida
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ Erro: Variáveis de ambiente do Supabase não definidas. Verifique se VITE_SUPABASE_URL e VITE_SUPABASE_KEY estão configuradas no Netlify.'
  );
}

// Cria e exporta o cliente Supabase (usa valores vazios se faltarem, apenas para evitar crash)
export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
