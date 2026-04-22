/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// URL e KEY obrigatórias
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🚨 BLOQUEIO TOTAL se estiver errado
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[SUPABASE_FATAL] Variáveis de ambiente não definidas. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  );
}

// Create and export the Supabase client
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);