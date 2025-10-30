import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Usando variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY;

// Cria e exporta o cliente Supabase
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
