import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://usdsynzkedjydlynkala.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzZHN5bnprZWRqeWRseW5rYWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzIyMzEsImV4cCI6MjEwMjg0ODIzMX0.95vTQvf-gNJZwnaPJ1EjtnQfr1R6o1q4MaavvyX74FM'
);

async function test() {
  const { data, error } = await supabase.from('soportes_fiduciaria').select('*').limit(1);
  console.log('Result:', { data, error });
}
test();
