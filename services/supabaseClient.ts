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

        if (isSupabaseRequest && import.meta.env.VITE_SUPABASE_ANON_KEY) {
          const actualKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          // Log para depuração
          console.log('[FORCE_SUPABASE]', urlStr);
          
          // Garante que headers seja um objeto manipulável
          const headers = options.headers instanceof Headers 
            ? Object.fromEntries(options.headers.entries())
            : (options.headers || {});

          options.headers = {
            ...headers,
            'apikey': actualKey,
          };

          // Só força Authorization se não houver um token JWT de usuário presente
          if (!options.headers['Authorization'] && !options.headers['authorization']) {
            options.headers['Authorization'] = `Bearer ${actualKey}`;
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
