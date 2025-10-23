import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// The Supabase URL and public anon key are hardcoded here.
// This is safe because the 'anon' key is designed to be public.
// True data security is enforced by Row Level Security (RLS) policies in your Supabase project.
const supabaseUrl = 'https://hirtcygvvxsmcrscuhsj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcnRjeWd2dnhzbWNyc2N1aHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NTI2MjksImV4cCI6MjA3NDIyODYyOX0.L8PZHPkPO3Qm7bz-k61qnPr44t8p630i3-d4Mc5bOi4';

// Create and export the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
