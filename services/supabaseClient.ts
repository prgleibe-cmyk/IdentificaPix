
/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// URL Real do Banco
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Chave Pública (Anon) - Segura para expor no frontend
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE_ERROR] Faltam variáveis de ambiente críticas (URL ou Anon Key).');
}

// Create and export the Supabase client
export const supabase = createClient<Database>(
  supabaseUrl || '', 
  supabaseAnonKey || '', 
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);
