
/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// URL Real do Banco
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uflheoknbopcgmzyjbft.supabase.co';

// Chave Pública (Anon) - Segura para expor no frontend
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';

console.log('[SUPABASE_ENV_CHECK]', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  rawUrl: import.meta.env.VITE_SUPABASE_URL ? 'PRESENT' : 'MISSING',
  rawKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING'
});

// Create and export the Supabase client
// Usamos conexão direta HTTPS. O Supabase gerencia o CORS nativamente.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Mantém o usuário logado
    autoRefreshToken: true, // Renova token
    detectSessionInUrl: true, // Necessário para OAuth (Google)
  },
  global: {
    fetch: (url, options) => {
      const headers = options?.headers as Record<string, string>;
      console.log('[SUPABASE_REQUEST_DEBUG]', {
        url: url.toString(),
        hasApiKey: !!(headers?.apikey || headers?.['apiKey']),
        hasAuth: !!headers?.Authorization
      });
      return fetch(url, options);
    }
  }
});
