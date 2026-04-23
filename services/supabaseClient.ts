/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// URL e KEY obrigatórias (com fallbacks para evitar erro fatal de validação no browser)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-identificapix.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'no-key-provided';

// 🔍 LOG CIRÚRGICO PARA DEBUG (mantido)
console.log('[SUPABASE_URL_RUNTIME]', supabaseUrl);
console.log('[SUPABASE_KEY_RUNTIME]', supabaseAnonKey);

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('[SUPABASE_WARNING] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas no ambiente local.');
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    global: {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      }
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);