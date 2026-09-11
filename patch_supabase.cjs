const fs = require('fs');
const content = fs.readFileSync('src/services/supabaseService.ts', 'utf8');

const newMethods = `
  // 17. Guardar Declaracion Renta
  async saveDeclaracionRenta(
    informeId: string,
    data: any,
    docKey?: string,
    pagoNroStr?: string
  ): Promise<{ success: boolean; id?: string }> {
    try {
      let resolvedInformeId = informeId;
      if (!isUuid(informeId)) {
        resolvedInformeId = ''; // local mode
      }

      const payload: any = {
        datos_formulario: data,
        fecha_actualizacion: new Date().toISOString()
      };

      if (docKey) payload.contratista_documento = docKey;
      if (pagoNroStr) payload.pago_nro = pagoNroStr;
      if (resolvedInformeId) payload.informe_id = resolvedInformeId;

      let existingId: string | null = null;
      if (resolvedInformeId) {
        const { data: existingFid } = await supabase.from('declaraciones_renta').select('id').eq('informe_id', resolvedInformeId).limit(1).maybeSingle();
        if (existingFid?.id) existingId = existingFid.id;
      }
      if (!existingId && docKey) {
        const { data: existingByDoc } = await supabase.from('declaraciones_renta').select('id').eq('contratista_documento', docKey).eq('pago_nro', pagoNroStr).limit(1).maybeSingle();
        if (existingByDoc?.id) existingId = existingByDoc.id;
      }

      if (existingId) {
        await supabase.from('declaraciones_renta').update(payload).eq('id', existingId);
        return { success: true, id: existingId };
      } else {
        const { data: inserted } = await supabase.from('declaraciones_renta').insert([payload]).select('id').maybeSingle();
        return { success: true, id: inserted?.id };
      }
    } catch (e: any) {
      console.warn('Error saving declaracion renta to Supabase:', e);
      return { success: true, id: \`local-\${Date.now()}\` };
    }
  },

  // 18. Obtener Declaracion Renta
  async getDeclaracionRenta(
    informeId?: string,
    docIdentidad?: string,
    pagoNro?: string
  ): Promise<any | null> {
    try {
      if (informeId && isUuid(informeId)) {
        const { data, error } = await supabase.from('declaraciones_renta').select('*').eq('informe_id', informeId).limit(1).maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
      if (docIdentidad && pagoNro) {
        const { data, error } = await supabase.from('declaraciones_renta').select('*').eq('contratista_documento', docIdentidad).eq('pago_nro', pagoNro).limit(1).maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
    } catch (e) {
      console.warn('Error fetching declaracion renta:', e);
    }
    
    if (typeof localStorage !== 'undefined') {
      const key = \`dec_renta_\${docIdentidad || ''}_\${pagoNro || '1'}\`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return null;
  }
};
`;

const updatedContent = content.replace(/};\s*$/, newMethods);
fs.writeFileSync('src/services/supabaseService.ts', updatedContent);
