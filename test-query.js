import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const query = supabase
    .from('informes_mensuales')
    .select(`
      id,
      contrato_id,
      informe_nro,
      tipo_informe,
      fecha_presentacion,
      periodo_desde,
      periodo_hasta,
      
      estado,
      created_at,
      contratos:contrato_id (
        contrato_nro,
        secretaria_id,
        profiles:contratista_id (
          nombre_completo,
          documento_identidad
        ),
        sec_secretarias:secretaria_id (
          nombre
        )
      )
    `)
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  console.log('Error:', error);
  console.log('Data count:', data ? data.length : 0);
  if (data && data.length > 0) {
    console.log('Sample:', JSON.stringify(data[0], null, 2));
  }
}
run();
