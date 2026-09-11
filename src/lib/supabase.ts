import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://usdsynzkedjydlynkala.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzZHN5bnprZWRqeWRseW5rYWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzIyMzEsImV4cCI6MjEwMjg0ODIzMX0.95vTQvf-gNJZwnaPJ1EjtnQfr1R6o1q4MaavvyX74FM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const SUPABASE_CONFIG = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};
