import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Leitura das variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY?.trim();

// Validação
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Erro: Variáveis do Supabase não definidas. ' +
    'Verifique VITE_SUPABASE_URL e VITE_SUPABASE_KEY no Netlify.'
  );
}

// Evita crash — cria cliente só se ambas estiverem válidas
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : (null as any);
