import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sampleComments = {
    "ob_1_actividades": {
      "campoId": "ob_1_actividades",
      "nombreCampo": "Obligación 1",
      "comentario": "Revisar soporte adjunto y ajustar el texto de actividades",
      "autor": "Supervisora",
      "fecha": "2026-08-22"
    }
  };

  const textObs = "Por favor corregir las actividades de la obligación 1.";
  const combined = textObs + "\n\n__COMMENTS_JSON__:" + JSON.stringify(sampleComments);

  console.log("Updating report 9de52be0-9c7c-40e8-9334-06edf3f9a3ec with status 'Rechazado'...");
  const { data, error } = await supabase
    .from('informes_mensuales')
    .update({
      observaciones: combined,
      estado: 'Rechazado'
    })
    .eq('id', '9de52be0-9c7c-40e8-9334-06edf3f9a3ec')
    .select();

  console.log("Update error:", error);
  console.log("Update success data:", data);

  console.log("Fetching row back...");
  const fetchRes = await supabase
    .from('informes_mensuales')
    .select('id, observaciones, estado')
    .eq('id', '9de52be0-9c7c-40e8-9334-06edf3f9a3ec')
    .single();

  console.log("Fetched row:", fetchRes.data);
}
run();
