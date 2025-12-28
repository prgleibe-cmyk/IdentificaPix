
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// URL Real do Banco
const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';

// Chave Pública (Anon) - Segura para expor no frontend
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';

// Create and export the Supabase client
// Usamos conexão direta HTTPS. O Supabase gerencia o CORS nativamente.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Mantém o usuário logado
    autoRefreshToken: true, // Renova token
    detectSessionInUrl: true, // Necessário para OAuth (Google)
  },
});
