import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// The Supabase URL and public anon key are hardcoded here.
// This is safe because the 'anon' key is designed to be public.
// True data security is enforced by Row Level Security (RLS) policies in your Supabase project.
const supabaseUrl = 'https://hirtcygvvxsmcrscuhsj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA'
// Create and export the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
