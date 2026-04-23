/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// URL e KEY obrigatórias (com fallbacks para evitar erro fatal de validação no browser)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-identificapix.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'no-key-provided';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('[SUPABASE_WARNING] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas no ambiente local.');
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    global: {
      fetch: async (url, options: any = {}) => {
        const urlStr = url.toString();
        const isSupabaseRequest = urlStr.includes('supabase.co');

        // Só tenta injetar se tivermos a chave real e for uma requisição para o Supabase
        if (isSupabaseRequest && import.meta.env.VITE_SUPABASE_ANON_KEY) {
          const actualKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          console.log('[FORCE_SUPABASE]', urlStr);
          
          options.headers = {
            ...(options.headers || {}),
            apikey: actualKey,
          };

          if (!options.headers.Authorization) {
            options.headers.Authorization = `Bearer ${actualKey}`;
          }
        }

        return fetch(url, options);
      }
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);
