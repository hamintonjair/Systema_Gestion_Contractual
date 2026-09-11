import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const query = supabase
    .from('informes_mensuales')
    .select(`
      id,
      contratos:contrato_id!inner (
        secretaria_id
      )
    `)
    .eq('contratos.secretaria_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

  const { data, error } = await query;
  console.log('Error:', error);
  console.log('Data:', data);
}
run();
