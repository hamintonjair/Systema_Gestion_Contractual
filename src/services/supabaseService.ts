import { supabase } from '../lib/supabase';
import { Secretaria, ReportData, InformeSummary, EstadoInforme, AuthUser, Anexo, FieldComment, CertificadoSupervisionData, createDefaultCertificadoData, Obligacion } from '../types';
import { formatColombianCurrency, formatValorAdicion, formatPlazoLetraYNumero, formatDateSlash, formatFechaAplicacion } from '../utils/formatters';

const STORAGE_USERS_KEY = 'alcaldia_quibdo_registered_users';
const STORAGE_PASSWORDS_KEY = 'alcaldia_quibdo_user_passwords';
const STORAGE_SECRETARIAS_KEY = 'alcaldia_quibdo_registered_secretarias';

// Validar formato UUID estándar de PostgreSQL
const isUuid = (val?: string): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

// Helper para obtener comentarios por campo almacenados
const getStoredComments = (docKey?: string, informeNro?: string): Record<string, FieldComment> => {
  if (typeof localStorage === 'undefined' || !informeNro) return {};
  if (docKey) {
    const stored = localStorage.getItem(`informe_comentarios_${docKey}_${informeNro}`);
    if (stored) {
      try { return JSON.parse(stored); } catch {}
    }
  }
  const globalStored = localStorage.getItem(`informe_comentarios_${informeNro}`);
  if (globalStored) {
    try { return JSON.parse(globalStored); } catch {}
  }
  return {};
};

// Helper para obtener informe completo almacenado en localStorage
const getStoredReportData = (docKey?: string, informeNro?: string): Partial<ReportData> | null => {
  if (typeof localStorage === 'undefined' || !informeNro) return null;
  if (docKey) {
    const stored = localStorage.getItem(`informe_data_${docKey}_${informeNro}`);
    if (stored) {
      try { return JSON.parse(stored); } catch {}
    }
  }
  const globalStored = localStorage.getItem(`informe_data_${informeNro}`);
  if (globalStored) {
    try { return JSON.parse(globalStored); } catch {}
  }
  return null;
};

// Helper para asociar hasta 5 fotos por obligación de forma consistente
const associateFotosToObligaciones = (obligaciones: Obligacion[], anexos: Anexo[], storedObs?: Obligacion[]): { obsWithFotos: Obligacion[]; allAnexos: Anexo[] } => {
  const allAnexos = [...anexos];
  const obsWithFotos = obligaciones.map((obs, idx) => {
    const stored = storedObs?.find(so => so.id === obs.id || so.descripcion === obs.descripcion);
    if (stored?.fotos && stored.fotos.length > 0) {
      return { ...obs, fotos: stored.fotos.slice(0, 5) };
    }

    const matched = allAnexos.filter(a => {
      if (a.obligacionId && a.obligacionId === obs.id) return true;
      if (a.obligacionIndex !== undefined && a.obligacionIndex === (idx + 1)) return true;
      const t = (a.titulo || '').toLowerCase();
      if (t.includes(`obligación #${idx + 1}`) || t.includes(`obligacion #${idx + 1}`) || t.startsWith(`[obligación ${idx + 1}]`) || t.startsWith(`[obligacion ${idx + 1}]`)) {
        return true;
      }
      return false;
    });

    const finalFotos = matched.slice(0, 5).map((f, fIdx) => ({
      ...f,
      obligacionId: obs.id,
      obligacionIndex: idx + 1,
      titulo: f.titulo || `Evidencia fotográfica ${fIdx + 1} - Obligación #${idx + 1}`
    }));

    return {
      ...obs,
      fotos: finalFotos
    };
  });

  const flatAnexos: Anexo[] = [];
  obsWithFotos.forEach(obs => {
    (obs.fotos || []).forEach(f => {
      flatAnexos.push(f);
    });
  });

  allAnexos.forEach(a => {
    if (!flatAnexos.some(fa => fa.id === a.id || fa.imagenUrl === a.imagenUrl)) {
      flatAnexos.push(a);
    }
  });

  return { obsWithFotos, allAnexos: flatAnexos };
};

// Helpers para codificar/decodificar observaciones, comentarios por campo y texto de certificación sin requerir migraciones de BD
const parseObservacionesAndComments = (rawObs?: string): { cleanObs: string; comments: Record<string, FieldComment>; valorPagarText?: string } => {
  if (!rawObs) return { cleanObs: '', comments: {} };
  let current = rawObs;
  let comments: Record<string, FieldComment> = {};
  let valorPagarText: string | undefined;

  const commDelimiter = '\n\n__COMMENTS_JSON__:';
  if (current.includes(commDelimiter)) {
    const parts = current.split(commDelimiter);
    current = parts[0] || '';
    if (parts[1]) {
      try {
        comments = JSON.parse(parts[1]);
      } catch (e) {}
    }
  }

  const vpDelimiter = '\n\n__VALOR_PAGAR__:';
  if (current.includes(vpDelimiter)) {
    const parts = current.split(vpDelimiter);
    current = parts[0] || '';
    if (parts[1]) {
      try {
        valorPagarText = decodeURIComponent(parts[1]);
      } catch (e) {
        valorPagarText = parts[1];
      }
    }
  }

  return { cleanObs: current, comments, valorPagarText };
};

const buildObservacionesWithComments = (cleanObs: string, comments?: Record<string, FieldComment>, valorPagarText?: string): string => {
  let baseObs = cleanObs || '';
  if (valorPagarText && valorPagarText.trim()) {
    baseObs = `${baseObs}\n\n__VALOR_PAGAR__:${encodeURIComponent(valorPagarText.trim())}`;
  }
  if (comments && Object.keys(comments).length > 0) {
    return `${baseObs}\n\n__COMMENTS_JSON__:${JSON.stringify(comments)}`;
  }
  return baseObs;
};

const mapStatusToDb = (status: EstadoInforme): string => {
  if (status === 'Devuelto') return 'Rechazado';
  return status;
};

const mapStatusFromDb = (dbStatus?: string, hasComments: boolean = false): EstadoInforme => {
  if (dbStatus === 'Borrador' || dbStatus === 'borrador') return 'Borrador';
  if (dbStatus === 'Rechazado' || dbStatus === 'Devuelto' || (hasComments && dbStatus !== 'Aprobado' && dbStatus !== 'Borrador')) {
    return 'Devuelto';
  }
  return (dbStatus as EstadoInforme) || 'Enviado';
};

// Cuentas de respaldo del sistema institucional
const SYSTEM_CORE_USERS: AuthUser[] = [
  {
    id: 'usr-superadmin-core',
    email: 'alcaldia@quibdo-choco.gov.co',
    password: 'Quibdo2026*',
    nombreCompleto: 'SUPER ADMINISTRADOR MUNICIPAL',
    documentoIdentidad: '891680011',
    role: 'super_admin',
    cargo: 'Alcaldía Mayor / Administrador General del Sistema',
    telefono: '3100000000',
  },
  {
    id: 'usr-admin-inclusion-core',
    email: 'inclusion@quibdo-choco.gov.co',
    password: 'Inclusion2026*',
    nombreCompleto: 'DIANA ANDREA MOSQUERA GARCIA',
    documentoIdentidad: '35602521',
    role: 'secretaria_admin',
    secretariaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    secretariaNombre: 'Secretaría de Inclusión y Cohesión Social',
    secretariaCodigo: '170',
    cargo: 'Secretaria de Despacho / Supervisora',
    telefono: '3100000000',
  }
];

export const supabaseService = {
  // Helper: Guardar contraseña en almacén seguro local
  saveUserPassword(identifier: string, pass: string) {
    try {
      const stored = localStorage.getItem(STORAGE_PASSWORDS_KEY);
      const map: { [key: string]: string } = stored ? JSON.parse(stored) : {};
      map[identifier.toLowerCase().trim()] = pass;
      localStorage.setItem(STORAGE_PASSWORDS_KEY, JSON.stringify(map));
    } catch (e) {}
  },

  // Helper: Obtener contraseña guardada
  getUserPassword(identifier: string): string | undefined {
    try {
      const stored = localStorage.getItem(STORAGE_PASSWORDS_KEY);
      if (!stored) return undefined;
      const map: { [key: string]: string } = JSON.parse(stored);
      return map[identifier.toLowerCase().trim()];
    } catch (e) {
      return undefined;
    }
  },

  // 1. Probar conexión y estado de Supabase
  async checkConnection(): Promise<{ connected: boolean; message: string; tablesCount?: number }> {
    try {
      const { data, error } = await supabase.from('sec_secretarias').select('count', { count: 'exact', head: true });
      if (error) {
        return { 
          connected: false, 
          message: error.message || 'Error al conectar con las tablas de Supabase' 
        };
      }
      return { 
        connected: true, 
        message: 'Conectado exitosamente a Supabase (usdsynzkedjydlynkala.supabase.co)' 
      };
    } catch (err: any) {
      return { 
        connected: false, 
        message: err?.message || 'Fallo de conexión con el backend' 
      };
    }
  },

  // Helper: Resolver el UUID real de la secretaría en Supabase
  async resolveSecretariaUuid(secIdOrCodeOrName?: string, nameFallback?: string): Promise<string | null> {
    const param = secIdOrCodeOrName || nameFallback;
    if (param && isUuid(param)) return param;

    try {
      if (param) {
        const cleanCode = param.replace('sec-', '').replace('inclusion-', '');
        const { data } = await supabase
          .from('sec_secretarias')
          .select('id, codigo, nombre')
          .or(`codigo.eq.${cleanCode},nombre.ilike.%${param}%`)
          .limit(1)
          .maybeSingle();

        if (data?.id && isUuid(data.id)) return data.id;
      }

      if (nameFallback && nameFallback !== param) {
        const { data: nameData } = await supabase
          .from('sec_secretarias')
          .select('id')
          .ilike('nombre', `%${nameFallback}%`)
          .limit(1)
          .maybeSingle();
        if (nameData?.id && isUuid(nameData.id)) return nameData.id;
      }

      const { data: firstSec } = await supabase.from('sec_secretarias').select('id').limit(1).maybeSingle();
      return (firstSec?.id && isUuid(firstSec.id)) ? firstSec.id : null;
    } catch (e) {
      return null;
    }
  },

  async resolveSecretariaId(secIdOrCodeOrName?: string, nameFallback?: string): Promise<string | null> {
    return this.resolveSecretariaUuid(secIdOrCodeOrName, nameFallback);
  },

  // 2. Secretarías (Carga en tiempo real de Supabase)
  async getSecretarias(): Promise<Secretaria[]> {
    try {
      const { data, error } = await supabase
        .from('sec_secretarias')
        .select('*')
        .order('nombre', { ascending: true });

      if (!error && data && data.length > 0) {
        // Guardar copia local de respaldo
        localStorage.setItem(STORAGE_SECRETARIAS_KEY, JSON.stringify(data));
        return data as Secretaria[];
      }
    } catch (err) {
      console.warn('Error fetching secretarias from Supabase, using local store:', err);
    }

    // Fallback a almacenamiento local si existe
    const stored = localStorage.getItem(STORAGE_SECRETARIAS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }

    return [
      {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        nombre: 'Secretaría de Inclusión y Cohesión Social',
        nit: '891680011-0',
        codigo: '170',
      },
      {
        id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
        nombre: 'Secretaría de Hacienda y Gestión Financiera',
        nit: '891680011-0',
        codigo: '110',
      },
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
        nombre: 'Secretaría de Educación Municipal',
        nit: '891680011-0',
        codigo: '140',
      },
      {
        id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
        nombre: 'Secretaría de Infraestructura y Obras Públicas',
        nit: '891680011-0',
        codigo: '150',
      },
      {
        id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
        nombre: 'Secretaría General y de Gobierno',
        nit: '891680011-0',
        codigo: '120',
      },
      {
        id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16',
        nombre: 'Secretaría de Salud y Protección Social',
        nit: '891680011-0',
        codigo: '130',
      }
    ];
  },

  // 3. Gestión de archivos en Storage (Bucket: anexos)
  async uploadImageToStorage(file: File, folder: string = 'images'): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('anexos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading image to Supabase:', error);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('anexos')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (e) {
      console.error('Exception uploading image:', e);
      return null;
    }
  },

  async getGlobalMembreteUrl(): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from('anexos')
        .list('membretes', {
          limit: 1,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      if (error || !data || data.length === 0) {
        return null;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('anexos')
        .getPublicUrl(`membretes/${data[0].name}`);
        
      return publicUrlData.publicUrl;
    } catch (e) {
      return null;
    }
  },

  async deleteImageFromStorage(imageUrl: string): Promise<boolean> {
    try {
      if (!imageUrl || imageUrl.startsWith('data:image')) return true;

      let filePath = imageUrl;
      if (imageUrl.includes('/storage/v1/object/public/anexos/')) {
        const parts = imageUrl.split('/storage/v1/object/public/anexos/');
        filePath = parts[1] || imageUrl;
      } else if (imageUrl.includes('/anexos/')) {
        const parts = imageUrl.split('/anexos/');
        filePath = parts[1] || imageUrl;
      }

      // Quitar parámetros de consulta si los hay
      filePath = filePath.split('?')[0];

      const { error } = await supabase.storage
        .from('anexos')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting image from Supabase Storage:', error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Exception deleting image from storage:', e);
      return false;
    }
  },

  // 4. Crear Secretaría con su Administrador Oficial en Supabase
  async createSecretariaWithAdmin(
    secData: { nombre: string; codigo: string; nit: string },
    adminData: { nombreCompleto: string; documentoIdentidad: string; email: string; password?: string; cargo?: string; telefono?: string }
  ): Promise<{ success: boolean; secretaria: Secretaria; admin: AuthUser }> {
    let createdSecId: string = `sec-${secData.codigo.toLowerCase()}-${Date.now()}`;
    let realSecRow: Secretaria | null = null;

    // 1. Guardar Secretaría en Supabase
    try {
      const { data: secInserted, error: secError } = await supabase
        .from('sec_secretarias')
        .insert([{
          nombre: secData.nombre.trim(),
          codigo: secData.codigo.trim(),
          nit: secData.nit.trim(),
          activo: true,
        }])
        .select('*')
        .single();

      if (secInserted) {
        createdSecId = secInserted.id;
        realSecRow = secInserted as Secretaria;
      } else if (secError) {
        console.warn('Supabase sec_secretarias insert error:', secError);
      }
    } catch (e) {
      console.warn('Supabase sec_secretarias catch:', e);
    }

    const newSec: Secretaria = realSecRow || {
      id: createdSecId,
      nombre: secData.nombre.trim(),
      codigo: secData.codigo.trim(),
      nit: secData.nit.trim(),
      created_at: new Date().toISOString(),
    };

    const adminPassword = adminData.password?.trim() || 'Admin2026*';
    const adminEmail = adminData.email.trim();
    const adminDoc = adminData.documentoIdentidad.trim().replace(/\./g, '');
    let createdAdminId = `usr-admin-${Date.now()}`;

    // 2. Guardar Administrador en la tabla 'profiles' de Supabase
    try {
      const adminProfilePayload: any = {
        role: 'secretaria_admin',
        nombre_completo: adminData.nombreCompleto.trim().toUpperCase(),
        documento_identidad: adminDoc,
        email: adminEmail,
        telefono: adminData.telefono?.trim() || '3100000000',
        cargo: adminData.cargo?.trim() || 'Secretaria de Despacho / Supervisora',
        activo: true,
      };

      if (isUuid(createdSecId)) {
        adminProfilePayload.secretaria_id = createdSecId;
      }

      const { data: adminInserted, error: adminErr } = await supabase
        .from('profiles')
        .insert([adminProfilePayload])
        .select('*')
        .single();

      if (adminInserted) {
        createdAdminId = adminInserted.id;
      } else if (adminErr) {
        console.warn('Supabase profile admin insert error:', adminErr);
      }
    } catch (e) {
      console.warn('Supabase admin catch:', e);
    }

    // Guardar contraseña asignada
    this.saveUserPassword(adminEmail, adminPassword);
    this.saveUserPassword(adminDoc, adminPassword);

    const newAdmin: AuthUser = {
      id: createdAdminId,
      email: adminEmail,
      password: adminPassword,
      nombreCompleto: adminData.nombreCompleto.trim().toUpperCase(),
      documentoIdentidad: adminDoc,
      role: 'secretaria_admin',
      secretariaId: createdSecId,
      secretariaNombre: secData.nombre.trim(),
      secretariaCodigo: secData.codigo.trim(),
      cargo: adminData.cargo?.trim() || 'Secretaria de Despacho / Supervisora',
      telefono: adminData.telefono?.trim() || '3100000000',
      createdAt: new Date().toISOString(),
    };

    // Actualizar almacenamiento local
    const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = storedUsers ? JSON.parse(storedUsers) : [];
    customUsers.push(newAdmin);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(customUsers));

    return { success: true, secretaria: newSec, admin: newAdmin };
  },

  // 4. Obtener Contratistas en Tiempo Real de Supabase
  async getContractors(secretariaId?: string): Promise<AuthUser[]> {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*, sec_secretarias(*)')
        .eq('role', 'contratista')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'contratista');
        if (!fallback.error && fallback.data) {
          data = fallback.data;
          error = null;
        }
      }

      if (!error && data && data.length > 0) {
        const contractors: AuthUser[] = data.map((row: any) => {
          const doc = row.documento_identidad || '';
          const mail = row.email || '';
          const pass = this.getUserPassword(mail) || this.getUserPassword(doc) || 'Contratista2026*';

          return {
            id: row.id,
            email: mail,
            password: pass,
            nombreCompleto: row.nombre_completo || 'CONTRATISTA REGISTRADO',
            documentoIdentidad: doc,
            role: 'contratista' as const,
            secretariaId: row.secretaria_id || '',
            secretariaNombre: row.sec_secretarias?.nombre || '',
            secretariaCodigo: row.sec_secretarias?.codigo || '',
            cargo: row.cargo || 'Contratista de Prestación de Servicios',
            telefono: row.telefono || '',
            createdAt: row.created_at || new Date().toISOString(),
          };
        });

        // Filtrar por secretaría si se proporcionó parámetro
        if (secretariaId) {
          const filtered = contractors.filter(c => {
            if (c.secretariaId === secretariaId) return true;
            if (isUuid(secretariaId) && isUuid(c.secretariaId) && c.secretariaId === secretariaId) return true;
            if (secretariaId.includes('170') && c.secretariaCodigo === '170') return true;
            return false;
          });
          return filtered;
        }

        return contractors;
      }
    } catch (err) {
      console.warn('Error fetching contractors from Supabase:', err);
    }

    // Fallback a contratistas creados localmente si no hay conexión
    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = stored ? JSON.parse(stored) : [];
    let localContractors = customUsers.filter(u => u.role === 'contratista');
    
    if (secretariaId) {
      localContractors = localContractors.filter(u => u.secretariaId === secretariaId);
    }
    
    return localContractors;
  },

  // 5. Crear Contratista en Supabase (Tabla 'profiles')
  async createContractor(
    contractorData: Omit<AuthUser, 'id' | 'role'>
  ): Promise<{ success: boolean; data: AuthUser; error?: string }> {
    const rawEmail = contractorData.email.trim();
    const rawDoc = contractorData.documentoIdentidad.trim().replace(/\./g, '');
    const pass = contractorData.password?.trim() || 'Contratista2026*';
    const fullName = contractorData.nombreCompleto.trim().toUpperCase();
    const phone = contractorData.telefono?.trim() || '';
    const cargo = contractorData.cargo?.trim() || 'Contratista de Prestación de Servicios';

    // Resolver UUID real de la secretaría
    const secUuid = await this.resolveSecretariaUuid(contractorData.secretariaId || contractorData.secretariaCodigo || contractorData.secretariaNombre);

    // Intentar registrar usuario en Supabase Auth si es posible
    let authUserId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.signUp({
        email: rawEmail,
        password: pass,
      });
      if (authData?.user?.id) {
        authUserId = authData.user.id;
      }
    } catch (authErr) {
      console.warn('Supabase auth signup notice:', authErr);
    }

    const newGeneratedId = authUserId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usr-contratista-${Date.now()}`);
    let createdId = newGeneratedId;
    let dbErrorMsg: string | undefined;

    try {
      // Inserción en la tabla profiles con columnas reales existentes
      const profilePayload: any = {
        role: 'contratista',
        nombre_completo: fullName,
        documento_identidad: rawDoc,
        email: rawEmail,
        telefono: phone,
        cargo: cargo,
        activo: true,
      };

      if (isUuid(newGeneratedId)) {
        profilePayload.id = newGeneratedId;
      }

      if (secUuid && isUuid(secUuid)) {
        profilePayload.secretaria_id = secUuid;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert([profilePayload])
        .select('*');

      if (inserted && inserted.length > 0) {
        createdId = inserted[0].id;
      } else if (insertErr) {
        console.warn('Initial insert attempt warning:', insertErr);

        // Intento con payload simplificado por si alguna columna opcional no está presente
        const fallbackPayload: any = {
          role: 'contratista',
          nombre_completo: fullName,
          documento_identidad: rawDoc,
          email: rawEmail,
          telefono: phone,
        };
        if (isUuid(newGeneratedId)) fallbackPayload.id = newGeneratedId;
        if (secUuid && isUuid(secUuid)) fallbackPayload.secretaria_id = secUuid;

        const { data: retryData, error: retryErr } = await supabase
          .from('profiles')
          .upsert([fallbackPayload], { onConflict: 'documento_identidad' })
          .select('*');

        if (retryData && retryData.length > 0) {
          createdId = retryData[0].id;
        } else {
          dbErrorMsg = insertErr.message || retryErr?.message;
          console.warn('Supabase profiles fallback notice:', dbErrorMsg);
        }
      }
    } catch (e: any) {
      console.error('Catch error inserting contractor in Supabase:', e);
      dbErrorMsg = e?.message;
    }

    // 2. Crear contrato vinculado en la tabla 'contratos' de Supabase
    try {
      const cleanNumeric = (val?: string | number): number => {
        if (typeof val === 'number') return val;
        if (!val) return 20029800;
        const cleaned = val.toString().replace(/[^0-9]/g, '');
        return parseInt(cleaned, 10) || 20029800;
      };

      const parseDateForPg = (dateStr?: string, defaultDate: string = '2026-01-15'): string | null => {
        if (!dateStr || dateStr === 'N/A') return null;
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        return defaultDate;
      };

      const validContratistaId = (createdId && isUuid(createdId)) ? createdId : null;
      const secId = await this.resolveSecretariaUuid(contractorData.secretariaId, contractorData.secretariaNombre);

      await supabase
        .from('contratos')
        .insert([{
          contratista_id: validContratistaId,
          secretaria_id: secId,
          contrato_nro: contractorData.contratoNro || '015',
          objeto: contractorData.objetoContrato || 'PRESTAR LOS SERVICIOS PROFESIONALES Y DE APOYO A LA GESTIÓN EN EL MUNICIPIO DE QUIBDÓ.',
          valor_contrato: cleanNumeric(contractorData.valorContrato),
          cdp_nro: contractorData.cdpNro || '137',
          crp_nro: contractorData.crpNro || '191',
          poliza_nro: contractorData.polizaNro && contractorData.polizaNro !== 'N/A' ? contractorData.polizaNro : null,
          fecha_aprobacion_poliza: parseDateForPg((contractorData as any).fechaPoliza, '2026-01-15'),
          plazo_meses: 6,
          fecha_inicio: parseDateForPg(contractorData.fechaInicio, '2026-01-15') || '2026-01-15',
          fecha_terminacion: parseDateForPg(contractorData.fechaTerminacion, '2026-07-14') || '2026-07-14',
          supervisor_nombre: contractorData.supervisorNombre || 'DIANA ANDREA MOSQUERA GARCIA',
          supervisor_documento: contractorData.supervisorDocumento || '35.602.521',
          apoyo_supervision_nombre: contractorData.apoyoSupervisionNombre && contractorData.apoyoSupervisionNombre !== 'N/A' ? contractorData.apoyoSupervisionNombre : null,
          apoyo_supervision_documento: contractorData.apoyoSupervisionDocumento && contractorData.apoyoSupervisionDocumento !== 'N/A' ? contractorData.apoyoSupervisionDocumento : null,
          vigencia: 2026,
        }]);
    } catch (e) {
      console.warn('Notice creating initial contract:', e);
    }

    // 3. Guardar credenciales para inicio de sesión
    this.saveUserPassword(rawEmail, pass);
    this.saveUserPassword(rawDoc, pass);

    const newContractor: AuthUser = {
      ...contractorData,
      id: createdId,
      role: 'contratista',
      password: pass,
      nombreCompleto: fullName,
      email: rawEmail,
      documentoIdentidad: rawDoc,
      telefono: phone,
      cargo: cargo,
      secretariaId: secUuid || contractorData.secretariaId,
      createdAt: new Date().toISOString(),
    };

    // 3. Persistir en localStorage como respaldo
    const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = storedUsers ? JSON.parse(storedUsers) : [];
    const filtered = customUsers.filter(u => u.documentoIdentidad !== rawDoc && u.email.toLowerCase() !== rawEmail.toLowerCase());
    filtered.push(newContractor);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(filtered));

    return { success: true, data: newContractor, error: dbErrorMsg };
  },

  // 6. Actualizar / Editar Contratista en Supabase
  async updateContractor(
    contractorId: string,
    updateData: Partial<AuthUser>
  ): Promise<{ success: boolean; data?: AuthUser; error?: string }> {
    const rawEmail = updateData.email?.trim();
    const rawDoc = updateData.documentoIdentidad?.trim().replace(/\./g, '');
    const fullName = updateData.nombreCompleto?.trim().toUpperCase();
    const phone = updateData.telefono?.trim();
    const cargo = updateData.cargo?.trim();
    const pass = updateData.password?.trim();

    try {
      const profileUpdatePayload: any = {};
      if (fullName) profileUpdatePayload.nombre_completo = fullName;
      if (rawDoc) profileUpdatePayload.documento_identidad = rawDoc;
      if (rawEmail) profileUpdatePayload.email = rawEmail;
      if (phone !== undefined) profileUpdatePayload.telefono = phone;
      if (cargo !== undefined) profileUpdatePayload.cargo = cargo;

      if (isUuid(contractorId)) {
        await supabase
          .from('profiles')
          .update(profileUpdatePayload)
          .eq('id', contractorId);
      } else if (rawDoc) {
        await supabase
          .from('profiles')
          .update(profileUpdatePayload)
          .eq('documento_identidad', rawDoc);
      }

      // Sincronizar tabla contratos si se editaron campos contractuales
      const contractUpdatePayload: any = {};
      const parseDateForPg = (dateStr?: string, defaultDate: string = '2026-01-15'): string | null => {
        if (!dateStr || dateStr === 'N/A') return null;
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            return `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        return defaultDate;
      };

      if (updateData.fechaInicio) contractUpdatePayload.fecha_inicio = parseDateForPg(updateData.fechaInicio);
      if (updateData.fechaTerminacion) contractUpdatePayload.fecha_terminacion = parseDateForPg(updateData.fechaTerminacion);
      if (updateData.contratoNro) contractUpdatePayload.contrato_nro = updateData.contratoNro;
      if (updateData.objetoContrato) contractUpdatePayload.objeto = updateData.objetoContrato;
      if (updateData.cdpNro) contractUpdatePayload.cdp_nro = updateData.cdpNro;
      if (updateData.crpNro) contractUpdatePayload.crp_nro = updateData.crpNro;
      if (updateData.polizaNro) contractUpdatePayload.poliza_nro = updateData.polizaNro === 'N/A' ? null : updateData.polizaNro;
      if (updateData.supervisorNombre) contractUpdatePayload.supervisor_nombre = updateData.supervisorNombre;
      if (updateData.supervisorDocumento) contractUpdatePayload.supervisor_documento = updateData.supervisorDocumento;
      if (updateData.apoyoSupervisionNombre) contractUpdatePayload.apoyo_supervision_nombre = updateData.apoyoSupervisionNombre === 'N/A' ? null : updateData.apoyoSupervisionNombre;
      if (updateData.apoyoSupervisionDocumento) contractUpdatePayload.apoyo_supervision_documento = updateData.apoyoSupervisionDocumento === 'N/A' ? null : updateData.apoyoSupervisionDocumento;

      if (Object.keys(contractUpdatePayload).length > 0) {
        if (isUuid(contractorId)) {
          await supabase.from('contratos').update(contractUpdatePayload).eq('contratista_id', contractorId);
        } else if (rawDoc) {
          const { data: prof } = await supabase.from('profiles').select('id').eq('documento_identidad', rawDoc).limit(1).maybeSingle();
          if (prof?.id) {
            await supabase.from('contratos').update(contractUpdatePayload).eq('contratista_id', prof.id);
          }
        }
      }
    } catch (e: any) {
      console.warn('Error updating contractor in Supabase:', e);
    }

    if (pass) {
      if (rawEmail) this.saveUserPassword(rawEmail, pass);
      if (rawDoc) this.saveUserPassword(rawDoc, pass);
    }

    // Actualizar localStorage
    const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = storedUsers ? JSON.parse(storedUsers) : [];
    let updatedUser: AuthUser | undefined;

    const newUsers = customUsers.map(u => {
      if (u.id === contractorId || (rawDoc && u.documentoIdentidad === rawDoc)) {
        updatedUser = {
          ...u,
          ...updateData,
          nombreCompleto: fullName || u.nombreCompleto,
          documentoIdentidad: rawDoc || u.documentoIdentidad,
          email: rawEmail || u.email,
          telefono: phone !== undefined ? phone : u.telefono,
          cargo: cargo !== undefined ? cargo : u.cargo,
          password: pass || u.password,
        };
        return updatedUser;
      }
      return u;
    });

    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(newUsers));

    return { success: true, data: updatedUser };
  },

  // 7. Eliminar / Desvincular Contratista en Supabase
  async deleteContractor(contractorId: string): Promise<boolean> {
    try {
      if (isUuid(contractorId)) {
        await supabase.from('profiles').delete().eq('id', contractorId);
      } else {
        await supabase.from('profiles').delete().or(`id.eq.${contractorId},documento_identidad.eq.${contractorId}`);
      }
    } catch (e) {
      console.warn('Error deleting contractor from Supabase:', e);
    }

    const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = storedUsers ? JSON.parse(storedUsers) : [];
    const filtered = customUsers.filter(u => u.id !== contractorId && u.documentoIdentidad !== contractorId);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(filtered));
    return true;
  },

  // 7. Obtener Todos los Usuarios Registrados (Super Admin / Login)
  async getAllUsers(): Promise<AuthUser[]> {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*, sec_secretarias(*)')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        const fallback = await supabase.from('profiles').select('*');
        if (!fallback.error && fallback.data) {
          data = fallback.data;
          error = null;
        }
      }

      if (!error && data && data.length > 0) {
        const usersFromDb: AuthUser[] = data.map((row: any) => {
          const doc = row.documento_identidad || '';
          const mail = row.email || '';
          const role = (row.role as any) || 'contratista';
          const pass = this.getUserPassword(mail) || this.getUserPassword(doc) || (role === 'secretaria_admin' ? 'Admin2026*' : 'Contratista2026*');

          return {
            id: row.id,
            email: mail,
            password: pass,
            nombreCompleto: row.nombre_completo || 'USUARIO DEL SISTEMA',
            documentoIdentidad: doc,
            role: role,
            secretariaId: row.secretaria_id || '',
            secretariaNombre: row.sec_secretarias?.nombre || '',
            secretariaCodigo: row.sec_secretarias?.codigo || '',
            cargo: row.cargo || '',
            telefono: row.telefono || '',
            createdAt: row.created_at || new Date().toISOString(),
          };
        });

        // Combinar con usuarios del sistema (Super Admin)
        const map = new Map<string, AuthUser>();
        SYSTEM_CORE_USERS.forEach(u => map.set(u.email.toLowerCase(), u));
        usersFromDb.forEach(u => {
          const key = u.email ? u.email.toLowerCase() : u.documentoIdentidad;
          map.set(key, u);
        });

        return Array.from(map.values());
      }
    } catch (err) {
      console.warn('Error fetching all users from Supabase:', err);
    }

    // Fallback a almacenamiento local
    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = stored ? JSON.parse(stored) : [];
    const map = new Map<string, AuthUser>();
    SYSTEM_CORE_USERS.forEach(u => map.set(u.email.toLowerCase(), u));
    customUsers.forEach(u => {
      const key = u.email ? u.email.toLowerCase() : u.documentoIdentidad;
      map.set(key, u);
    });

    return Array.from(map.values());
  },

  // Helper: Asegurar existencia de Contrato en la BD vinculando el contratista y secretaría
  async ensureContrato(report: ReportData, user?: AuthUser): Promise<string | null> {
    try {
      const doc = report.contratistaDocumento || user?.documentoIdentidad;
      let contratistaId = user?.id;

      // 1. Buscar perfil de contratista por ID o documento
      if (!contratistaId || !isUuid(contratistaId)) {
        if (doc) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, secretaria_id')
            .eq('documento_identidad', doc)
            .maybeSingle();
          if (prof?.id) {
            contratistaId = prof.id;
          }
        }
      }

      // Si no existe perfil en profiles, crearlo
      if (!contratistaId || !isUuid(contratistaId)) {
        const secId = await this.resolveSecretariaId(report.secretariaId || user?.secretariaId, report.secretariaNombre);
        const { data: newProf, error: errProf } = await supabase
          .from('profiles')
          .insert([{
            email: report.contratistaCorreo || user?.email || `contratista_${doc ? doc.replace(/\D/g, '') : Date.now()}@quibdo-choco.gov.co`,
            role: 'contratista',
            nombre_completo: (report.contratistaNombre || user?.nombreCompleto || 'CONTRATISTA REGISTRADO').toUpperCase(),
            documento_identidad: doc || `CC-${Date.now()}`,
            telefono: report.contratistaTelefono || user?.telefono || '3100000000',
            secretaria_id: secId,
            cargo: user?.cargo || 'Contratista de Prestación de Servicios',
          }])
          .select('id')
          .single();

        if (!errProf && newProf?.id) {
          contratistaId = newProf.id;
        } else if (errProf) {
          console.warn('Error inserting profile in ensureContrato:', errProf);
        }
      }

      const validContratistaId = (contratistaId && isUuid(contratistaId)) ? contratistaId : null;
      const contratoNro = report.contratoNro || user?.contratoNro || '015';

      // 2. Normalizar valor numérico y fechas para PostgreSQL
      const cleanNumeric = (val?: string | number): number => {
        if (typeof val === 'number') return val;
        if (!val) return 20029800;
        const cleaned = val.toString().replace(/[^0-9]/g, '');
        return parseInt(cleaned, 10) || 20029800;
      };

      const parseDateForPg = (dateStr?: string, defaultDate: string = '2026-01-15'): string | null => {
        if (!dateStr || dateStr === 'N/A') return null;
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            return `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        return defaultDate;
      };

      const parsePlazoToMeses = (plazoStr?: string): number => {
        if (!plazoStr) return 6;
        const match = plazoStr.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 6;
      };

      const secId = await this.resolveSecretariaUuid(report.secretariaId || user?.secretariaId, report.secretariaNombre);
      
      const contractPayload: any = {
        contratista_id: validContratistaId,
        secretaria_id: secId,
        contrato_nro: contratoNro,
        objeto: report.objeto || user?.objetoContrato || 'PRESTAR LOS SERVICIOS PROFESIONALES Y DE APOYO A LA GESTIÓN EN EL MUNICIPIO DE QUIBDÓ.',
        valor_contrato: cleanNumeric(report.valorContrato || user?.valorContrato),
        cdp_nro: report.cdpNro || user?.cdpNro || '137',
        crp_nro: report.crpNro || user?.crpNro || '191',
        poliza_nro: report.polizaNro && report.polizaNro !== 'N/A' ? report.polizaNro : null,
        fecha_aprobacion_poliza: parseDateForPg(report.fechaPoliza, '2026-01-15'),
        plazo_meses: parsePlazoToMeses(report.plazo),
        fecha_inicio: parseDateForPg(report.fechaInicio, '2026-01-15') || '2026-01-15',
        fecha_terminacion: parseDateForPg(report.fechaTerminacion, '2026-07-14') || '2026-07-14',
        supervisor_nombre: report.supervisorNombre || user?.supervisorNombre || 'DIANA ANDREA MOSQUERA GARCIA',
        supervisor_documento: report.supervisorDocumento || user?.supervisorDocumento || '35.602.521',
        apoyo_supervision_nombre: report.apoyoSupervisionNombre && report.apoyoSupervisionNombre !== 'N/A' ? report.apoyoSupervisionNombre : null,
        apoyo_supervision_documento: report.apoyoSupervisionDocumento && report.apoyoSupervisionDocumento !== 'N/A' ? report.apoyoSupervisionDocumento : null,
        vigencia: 2026
      };

      // 3. Buscar si ya existe contrato por contratista_id o número de contrato y sincronizar cambios
      if (validContratistaId) {
        const { data: existingContract } = await supabase
          .from('contratos')
          .select('id')
          .eq('contratista_id', validContratistaId)
          .limit(1)
          .maybeSingle();

        if (existingContract?.id) {
          await supabase
            .from('contratos')
            .update(contractPayload)
            .eq('id', existingContract.id);
          return existingContract.id;
        }
      }

      const { data: existingContractNro } = await supabase
        .from('contratos')
        .select('id')
        .eq('contrato_nro', contratoNro)
        .limit(1)
        .maybeSingle();

      if (existingContractNro?.id) {
        await supabase
          .from('contratos')
          .update(contractPayload)
          .eq('id', existingContractNro.id);
        return existingContractNro.id;
      }

      const { data: newContract, error: errContract } = await supabase
        .from('contratos')
        .insert([contractPayload])
        .select('id')
        .single();

      if (!errContract && newContract?.id) {
        return newContract.id;
      } else if (errContract) {
        console.warn('Error creating contract in PostgreSQL:', errContract);
      }

      return null;
    } catch (e) {
      console.warn('Error in ensureContrato:', e);
      return null;
    }
  },

  // 8. Informes Mensuales (Lectura en tiempo real de Supabase para Secretaría y Super Admin - Excluye Borradores no radicados)
  async getInformes(secretariaId?: string): Promise<InformeSummary[]> {
    try {
      let query = supabase
        .from('informes_mensuales')
        .select(`
          id,
          contrato_id,
          informe_nro,
          tipo_informe,
          fecha_presentacion,
          periodo_desde,
          periodo_hasta,
          observaciones,
          estado,
          created_at,
          contratos:contrato_id!inner (
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
        .neq('estado', 'Borrador')
        .order('created_at', { ascending: false });

      if (secretariaId) {
        query = query.eq('contratos.secretaria_id', secretariaId);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        return data
          .filter((row: any) => row.contratos !== null && row.estado !== 'Borrador')
          .map((row: any) => {
          const { comments: obsComments } = parseObservacionesAndComments(row.observaciones);
          let dbComments = row.comentarios_campos || obsComments;
          if (typeof dbComments === 'string') {
            try { dbComments = JSON.parse(dbComments); } catch (e) {}
          }
          const doc = row.contratos?.profiles?.documento_identidad;
          const infNro = row.informe_nro ? String(row.informe_nro) : '1';
          const comments = (dbComments && typeof dbComments === 'object') ? dbComments : getStoredComments(doc, infNro);
          const hasComments = comments && Object.keys(comments).length > 0;
          const finalStatus = mapStatusFromDb(row.estado, hasComments);

          return {
            id: row.id,
            contrato_id: row.contrato_id,
            informe_nro: infNro,
            tipo_informe: row.tipo_informe || 'Mensual',
            fecha_presentacion: row.fecha_presentacion || '',
            periodo_desde: row.periodo_desde || '',
            periodo_hasta: row.periodo_hasta || '',
            estado: finalStatus,
            contratista_nombre: row.contratos?.profiles?.nombre_completo || 'CONTRATISTA MUNICIPAL',
            contratista_documento: doc || '',
            contrato_nro: row.contratos?.contrato_nro || '001',
            secretaria_nombre: row.contratos?.sec_secretarias?.nombre || 'Secretaría Municipal',
            created_at: row.created_at || new Date().toISOString(),
          };
        })
        .filter((inf: InformeSummary) => inf.estado !== 'Borrador');
      }

      return [];
    } catch (err) {
      console.warn('Error fetching reports from Supabase:', err);
      return [];
    }
  },

  // 8.1. Cargar Informes Específicos de un Contratista con sus Obligaciones y Fotos de Supabase
  async getReportById(reportId: string): Promise<ReportData | null> {
    try {
      const { data, error } = await supabase
        .from('informes_mensuales')
        .select(`
          id,
          contrato_id,
          informe_nro,
          tipo_informe,
          fecha_presentacion,
          periodo_desde,
          periodo_hasta,
          valor_adicion,
          valor_pagar_certificado,
          modificaciones_contrato,
          observaciones,
          estado,
          created_at,
          contratos:contrato_id (
            contrato_nro,
            objeto,
            valor_contrato,
            cdp_nro,
            crp_nro,
            poliza_nro,
            fecha_aprobacion_poliza,
            plazo_meses,
            fecha_inicio,
            fecha_terminacion,
            supervisor_nombre,
            supervisor_documento,
            apoyo_supervision_nombre,
            apoyo_supervision_documento,
            secretaria_id,
            profiles:contratista_id (
              id,
              nombre_completo,
              documento_identidad,
              email,
              telefono
            ),
            sec_secretarias:secretaria_id (
              id,
              nombre,
              codigo,
              nit
            )
          ),
          informe_obligaciones (
            id,
            obligacion_descripcion,
            actividades_realizadas,
            soportes_texto,
            orden
          ),
          informe_anexos (
            id,
            titulo,
            imagen_url,
            orden
          )
        `)
        .eq('id', reportId)
        .maybeSingle();

      if (!error && data) {
        const row = data as any;
        const obs = (row.informe_obligaciones || [])
          .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
          .map((o: any) => ({
            id: o.id,
            descripcion: o.obligacion_descripcion || '',
            actividades: o.actividades_realizadas || '',
            soportes: o.soportes_texto || 'Anexo fotográfico',
          }));

        const anx = (row.informe_anexos || [])
          .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
          .map((a: any) => ({
            id: a.id,
            titulo: a.titulo || '',
            imagenUrl: a.imagen_url || '',
          }));

        const { cleanObs, comments: obsComments, valorPagarText } = parseObservacionesAndComments(row.observaciones);
        let dbComments = row.comentarios_campos || obsComments;
        if (typeof dbComments === 'string') {
          try { dbComments = JSON.parse(dbComments); } catch (e) {}
        }
        const docIdentidad = row.contratos?.profiles?.documento_identidad || '';
        const infNumStr = String(row.informe_nro || '1');
        const finalComments = (dbComments && typeof dbComments === 'object') ? dbComments : getStoredComments(docIdentidad, infNumStr);
        const hasComm = Object.keys(finalComments).length > 0;
        const finalState = mapStatusFromDb(row.estado, hasComm);

        const storedData = getStoredReportData(docIdentidad, infNumStr);
        const { obsWithFotos, allAnexos } = associateFotosToObligaciones(obs, anx, storedData?.obligaciones);

        const finalValorPagar = valorPagarText || storedData?.valorPagar || (row.valor_pagar_certificado 
          ? (typeof row.valor_pagar_certificado === 'string' && isNaN(Number(row.valor_pagar_certificado)) ? row.valor_pagar_certificado : `$ ${Number(row.valor_pagar_certificado).toLocaleString('es-CO')}`) 
          : '$ 3.338.300');

        return {
          id: row.id,
          contratoId: row.contrato_id,
          secretariaId: row.contratos?.sec_secretarias?.id,
          secretariaNombre: row.contratos?.sec_secretarias?.nombre || 'Secretaría de Inclusión y Cohesión Social',
          secretariaCodigo: row.contratos?.sec_secretarias?.codigo || '170',
          secretariaNit: row.contratos?.sec_secretarias?.nit || '891680011-0',
          fechaAplicacion: (storedData?.fechaAplicacion || formatFechaAplicacion(row.periodo_hasta, row.periodo_desde)).toUpperCase(),
          tipoInforme: row.tipo_informe || 'Mensual',
          informeNro: infNumStr,
          fechaPresentacion: row.fecha_presentacion || new Date().toLocaleDateString('es-CO'),
          periodoDesde: row.periodo_desde || '01/07/2026',
          periodoHasta: row.periodo_hasta || '31/07/2026',
          contratistaNombre: row.contratos?.profiles?.nombre_completo || 'CONTRATISTA',
          contratistaDocumento: docIdentidad,
          contratistaCorreo: row.contratos?.profiles?.email || '',
          contratistaTelefono: row.contratos?.profiles?.telefono || '',
          supervisorNombre: row.contratos?.supervisor_nombre || 'DIANA ANDREA MOSQUERA GARCIA',
          supervisorDocumento: row.contratos?.supervisor_documento || '35.602.521',
          apoyoSupervisionNombre: row.contratos?.apoyo_supervision_nombre || 'N/A',
          apoyoSupervisionDocumento: row.contratos?.apoyo_supervision_documento || 'N/A',
          valorContrato: formatColombianCurrency(row.contratos?.valor_contrato || '20029800'),
          valorAdicion: formatValorAdicion(row.valor_adicion),
          contratoNro: row.contratos?.contrato_nro || '015',
          objeto: row.contratos?.objeto || '',
          cdpNro: row.contratos?.cdp_nro || '137',
          crpNro: row.contratos?.crp_nro || '191',
          polizaNro: row.contratos?.poliza_nro || 'N/A',
          fechaPoliza: formatDateSlash(row.contratos?.fecha_aprobacion_poliza || 'N/A'),
          plazo: formatPlazoLetraYNumero(`${row.contratos?.plazo_meses || 6} MESES`),
          fechaInicio: formatDateSlash(row.contratos?.fecha_inicio || '15/01/2026'),
          fechaTerminacion: formatDateSlash(row.contratos?.fecha_terminacion || '14/07/2026'),
          modificaciones: row.modificaciones_contrato || 'N/A',
          observaciones: cleanObs,
          obligaciones: obsWithFotos,
          anexos: allAnexos,
          valorPagar: finalValorPagar,
          estado: finalState,
          comentariosCampos: finalComments,
          syncedToDb: true,
        };
      }
    } catch (err) {
      console.warn('Error in getReportById from Supabase:', err);
    }
    return null;
  },

  // 8.2. Cargar Informes Específicos de un Contratista con sus Obligaciones y Fotos de Supabase
  async getContractorReports(contractorDocument?: string, contractorId?: string): Promise<ReportData[]> {
    try {
      const { data, error } = await supabase
        .from('informes_mensuales')
        .select(`
          id,
          contrato_id,
          informe_nro,
          tipo_informe,
          fecha_presentacion,
          periodo_desde,
          periodo_hasta,
          valor_adicion,
          valor_pagar_certificado,
          modificaciones_contrato,
          observaciones,
          estado,
          created_at,
          contratos:contrato_id (
            contrato_nro,
            objeto,
            valor_contrato,
            cdp_nro,
            crp_nro,
            poliza_nro,
            fecha_aprobacion_poliza,
            plazo_meses,
            fecha_inicio,
            fecha_terminacion,
            supervisor_nombre,
            supervisor_documento,
            apoyo_supervision_nombre,
            apoyo_supervision_documento,
            secretaria_id,
            profiles:contratista_id (
              id,
              nombre_completo,
              documento_identidad,
              email,
              telefono
            ),
            sec_secretarias:secretaria_id (
              id,
              nombre,
              codigo,
              nit
            )
          ),
          informe_obligaciones (
            id,
            obligacion_descripcion,
            actividades_realizadas,
            soportes_texto,
            orden
          ),
          informe_anexos (
            id,
            titulo,
            imagen_url,
            orden
          )
        `)
        .order('informe_nro', { ascending: false });

      if (!error && data && data.length > 0) {
        const filtered = data.filter((row: any) => {
          if (!contractorDocument && !contractorId) return true;
          const rowDoc = row.contratos?.profiles?.documento_identidad;
          const rowProfId = row.contratos?.profiles?.id;
          return (contractorDocument && rowDoc === contractorDocument) || (contractorId && rowProfId === contractorId);
        });

        if (filtered.length > 0) {
          const mapped = filtered.map((row: any) => {
            const obs = (row.informe_obligaciones || [])
              .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
              .map((o: any) => ({
                id: o.id,
                descripcion: o.obligacion_descripcion || '',
                actividades: o.actividades_realizadas || '',
                soportes: o.soportes_texto || 'Anexo fotográfico',
              }));

            const anx = (row.informe_anexos || [])
              .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
              .map((a: any) => ({
                id: a.id,
                titulo: a.titulo || '',
                imagenUrl: a.imagen_url || '',
              }));

            const { cleanObs, comments: obsComments, valorPagarText } = parseObservacionesAndComments(row.observaciones);
            let dbComments = row.comentarios_campos || obsComments;
            if (typeof dbComments === 'string') {
              try { dbComments = JSON.parse(dbComments); } catch (e) {}
            }
            const docIdentidad = row.contratos?.profiles?.documento_identidad || contractorDocument || '';
            const infNumStr = String(row.informe_nro || '1');
            const finalComments = row.estado === 'Borrador' ? {} : ((dbComments && typeof dbComments === 'object') ? dbComments : getStoredComments(docIdentidad, infNumStr));
            const hasComm = Object.keys(finalComments).length > 0;
            const finalState = mapStatusFromDb(row.estado, hasComm);

            const storedData = getStoredReportData(docIdentidad, infNumStr);
            const { obsWithFotos, allAnexos } = associateFotosToObligaciones(obs, anx, storedData?.obligaciones);

            const finalValorPagar = valorPagarText || storedData?.valorPagar || (row.valor_pagar_certificado
              ? (typeof row.valor_pagar_certificado === 'string' && isNaN(Number(row.valor_pagar_certificado)) ? row.valor_pagar_certificado : `$ ${Number(row.valor_pagar_certificado).toLocaleString('es-CO')}`)
              : '$ 3.338.300');

            return {
              id: row.id,
              contratoId: row.contrato_id,
              secretariaId: row.contratos?.sec_secretarias?.id,
              secretariaNombre: row.contratos?.sec_secretarias?.nombre || 'Secretaría de Inclusión y Cohesión Social',
              secretariaCodigo: row.contratos?.sec_secretarias?.codigo || '170',
              secretariaNit: row.contratos?.sec_secretarias?.nit || '891680011-0',
              fechaAplicacion: (storedData?.fechaAplicacion || formatFechaAplicacion(row.periodo_hasta, row.periodo_desde)).toUpperCase(),
              tipoInforme: row.tipo_informe || 'Mensual',
              informeNro: infNumStr,
              fechaPresentacion: row.fecha_presentacion || new Date().toLocaleDateString('es-CO'),
              periodoDesde: row.periodo_desde || '01/07/2026',
              periodoHasta: row.periodo_hasta || '31/07/2026',
              contratistaNombre: row.contratos?.profiles?.nombre_completo || 'CONTRATISTA',
              contratistaDocumento: docIdentidad,
              contratistaCorreo: row.contratos?.profiles?.email || '',
              contratistaTelefono: row.contratos?.profiles?.telefono || '',
              supervisorNombre: row.contratos?.supervisor_nombre || 'DIANA ANDREA MOSQUERA GARCIA',
              supervisorDocumento: row.contratos?.supervisor_documento || '35.602.521',
              apoyoSupervisionNombre: row.contratos?.apoyo_supervision_nombre || 'N/A',
              apoyoSupervisionDocumento: row.contratos?.apoyo_supervision_documento || 'N/A',
              valorContrato: formatColombianCurrency(row.contratos?.valor_contrato || '20029800'),
              valorAdicion: formatValorAdicion(row.valor_adicion),
              contratoNro: row.contratos?.contrato_nro || '015',
              objeto: row.contratos?.objeto || '',
              cdpNro: row.contratos?.cdp_nro || '137',
              crpNro: row.contratos?.crp_nro || '191',
              polizaNro: row.contratos?.poliza_nro || 'N/A',
              fechaPoliza: formatDateSlash(row.contratos?.fecha_aprobacion_poliza || 'N/A'),
              plazo: formatPlazoLetraYNumero(`${row.contratos?.plazo_meses || 6} MESES`),
              fechaInicio: formatDateSlash(row.contratos?.fecha_inicio || '15/01/2026'),
              fechaTerminacion: formatDateSlash(row.contratos?.fecha_terminacion || '14/07/2026'),
              modificaciones: row.modificaciones_contrato || 'N/A',
              observaciones: cleanObs,
              obligaciones: obsWithFotos,
              anexos: allAnexos,
              valorPagar: finalValorPagar,
              estado: finalState,
              comentariosCampos: finalComments,
              syncedToDb: true,
            };
          });

          // Deduplicar informes por número de informe (manteniendo la versión más completa/reciente)
          const uniqueMap = new Map<string, ReportData>();
          for (const rep of mapped) {
            if (!uniqueMap.has(rep.informeNro)) {
              uniqueMap.set(rep.informeNro, rep);
            } else {
              const existing = uniqueMap.get(rep.informeNro)!;
              if (!isUuid(existing.id) && isUuid(rep.id)) {
                uniqueMap.set(rep.informeNro, rep);
              } else if ((rep.obligaciones?.length || 0) > (existing.obligaciones?.length || 0)) {
                uniqueMap.set(rep.informeNro, rep);
              }
            }
          }
          return Array.from(uniqueMap.values());
        }
      }
    } catch (err) {
      console.warn('Error in getContractorReports from Supabase:', err);
    }

    return [];
  },

  // 9. Guardar / Sincronizar Informe Completo a Supabase (Garantizando Contrato, Obligaciones y Fotos)
  async saveFullInforme(report: ReportData, user?: AuthUser): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // 1. Asegurar Contrato ID válido y sincronizar fechas del contrato
      let contratoId = report.contratoId;
      if (!contratoId || !isUuid(contratoId)) {
        contratoId = (await this.ensureContrato(report, user)) || undefined;
      } else {
        // Actualizar datos del contrato existente (fechas de inicio y terminación, etc.)
        const parsePlazoToMeses = (plazoStr?: string): number => {
          if (!plazoStr) return 6;
          const match = plazoStr.match(/(\d+)/);
          return match ? parseInt(match[1], 10) : 6;
        };

        const parseDateForContract = (dateStr?: string, defaultDate: string = '2026-01-15'): string | null => {
          if (!dateStr || dateStr === 'N/A') return null;
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              return `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
          return defaultDate;
        };

        const cleanContractVal = (val?: string | number): number => {
          if (typeof val === 'number') return val;
          if (!val) return 20029800;
          const cleaned = val.toString().replace(/[^0-9]/g, '');
          return parseInt(cleaned, 10) || 20029800;
        };

        try {
          await supabase.from('contratos').update({
            fecha_inicio: parseDateForContract(report.fechaInicio, '2026-01-15') || '2026-01-15',
            fecha_terminacion: parseDateForContract(report.fechaTerminacion, '2026-07-14') || '2026-07-14',
            plazo_meses: parsePlazoToMeses(report.plazo),
            objeto: report.objeto,
            valor_contrato: cleanContractVal(report.valorContrato),
            cdp_nro: report.cdpNro || '137',
            crp_nro: report.crpNro || '191',
            poliza_nro: report.polizaNro && report.polizaNro !== 'N/A' ? report.polizaNro : null,
            fecha_aprobacion_poliza: parseDateForContract(report.fechaPoliza, '2026-01-15'),
            supervisor_nombre: report.supervisorNombre || 'DIANA ANDREA MOSQUERA GARCIA',
            supervisor_documento: report.supervisorDocumento || '35.602.521',
            apoyo_supervision_nombre: report.apoyoSupervisionNombre && report.apoyoSupervisionNombre !== 'N/A' ? report.apoyoSupervisionNombre : null,
            apoyo_supervision_documento: report.apoyoSupervisionDocumento && report.apoyoSupervisionDocumento !== 'N/A' ? report.apoyoSupervisionDocumento : null,
          }).eq('id', contratoId);
        } catch (contractErr) {
          console.warn('Error updating contract fields in saveFullInforme:', contractErr);
        }
      }

      const cleanNumeric = (val?: string | number, defaultVal: number = 0): number => {
        if (typeof val === 'number') return val;
        if (!val) return defaultVal;
        const cleaned = val.toString().replace(/[^0-9]/g, '');
        return parseInt(cleaned, 10) || defaultVal;
      };

      const parseDateForPg = (dateStr?: string, defaultDate: string = '2026-07-15'): string => {
        if (!dateStr || dateStr === 'N/A') return defaultDate;
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        return defaultDate;
      };

      const contractorDoc = report.contratistaDocumento || user?.documentoIdentidad;
      const cleanObsText = report.observaciones !== undefined && report.observaciones !== null ? report.observaciones : '';
      const fullObsPayload = buildObservacionesWithComments(cleanObsText, report.comentariosCampos, report.valorPagar);

      const informePayload: any = {
        informe_nro: parseInt(report.informeNro, 10) || 1,
        tipo_informe: report.tipoInforme || 'Mensual',
        fecha_presentacion: parseDateForPg(report.fechaPresentacion, new Date().toISOString().split('T')[0]),
        periodo_desde: parseDateForPg(report.periodoDesde, '2026-07-01'),
        periodo_hasta: parseDateForPg(report.periodoHasta, '2026-07-31'),
        valor_adicion: cleanNumeric(report.valorAdicion, 0),
        valor_pagar_certificado: cleanNumeric(report.valorPagar, 3338300),
        modificaciones_contrato: report.modificaciones || 'N/A',
        observaciones: fullObsPayload,
        estado: mapStatusToDb(report.estado || 'Enviado'),
      };

      if (report.comentariosCampos && typeof localStorage !== 'undefined') {
        if (contractorDoc) {
          localStorage.setItem(`informe_comentarios_${contractorDoc}_${report.informeNro}`, JSON.stringify(report.comentariosCampos));
        }
        localStorage.setItem(`informe_comentarios_${report.informeNro}`, JSON.stringify(report.comentariosCampos));
      }

      if (contratoId && isUuid(contratoId)) {
        informePayload.contrato_id = contratoId;
      }

      let informeId = report.id;

      // Buscar si ya existe un registro en Supabase para este contrato con el mismo número de informe
      if (!informeId || !isUuid(informeId)) {
        if (contratoId && isUuid(contratoId)) {
          const { data: existing } = await supabase
            .from('informes_mensuales')
            .select('id')
            .eq('contrato_id', contratoId)
            .eq('informe_nro', parseInt(report.informeNro, 10) || 1)
            .maybeSingle();

          if (existing?.id) {
            informeId = existing.id;
          }
        }
      }

      if (!informeId || !isUuid(informeId)) {
        const { data: inserted, error: insertError } = await supabase
          .from('informes_mensuales')
          .insert([informePayload])
          .select('id')
          .maybeSingle();

        if (inserted?.id) {
          informeId = inserted.id;
        } else if (insertError) {
          console.warn('Insert error in informes_mensuales:', insertError);
        }
      } else {
        await supabase
          .from('informes_mensuales')
          .update(informePayload)
          .eq('id', informeId);
      }

      // 4. Procesar y Subir a Supabase Storage las fotos pendientes (Subida Diferida por obligación y generales)
      const processedObligaciones: Obligacion[] = [];
      const processedAnexos: Anexo[] = [];

      for (let obsIdx = 0; obsIdx < (report.obligaciones || []).length; obsIdx++) {
        const obs = report.obligaciones[obsIdx];
        const obsFotos = (obs.fotos || []).slice(0, 5);
        const processedObsFotos: Anexo[] = [];

        for (const foto of obsFotos) {
          let finalUrl = foto.imagenUrl;
          if (foto.file || (foto.imagenUrl && foto.imagenUrl.startsWith('data:image'))) {
            let fileToUpload = foto.file;
            if (!fileToUpload && foto.imagenUrl.startsWith('data:image')) {
              try {
                const res = await fetch(foto.imagenUrl);
                const blob = await res.blob();
                fileToUpload = new File([blob], `anexo_obs${obsIdx + 1}_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
              } catch (e) {
                console.warn('Error converting dataURL to file:', e);
              }
            }

            if (fileToUpload) {
              const uploadedUrl = await this.uploadImageToStorage(fileToUpload, 'anexos-fotos');
              if (uploadedUrl) {
                finalUrl = uploadedUrl;
              }
            }
          }

          const processedFoto: Anexo = {
            id: foto.id,
            titulo: foto.titulo || `Obligación #${obsIdx + 1} - Evidencia ${processedObsFotos.length + 1}`,
            imagenUrl: finalUrl,
            obligacionId: obs.id,
            obligacionIndex: obsIdx + 1,
            isPendingUpload: false
          };

          processedObsFotos.push(processedFoto);
          processedAnexos.push(processedFoto);
        }

        processedObligaciones.push({
          ...obs,
          fotos: processedObsFotos
        });
      }

      // Si había anexos en report.anexos que no estaban en ninguna obligación
      if (report.anexos && report.anexos.length > 0) {
        for (const anexo of report.anexos) {
          if (!processedAnexos.some(a => a.id === anexo.id || a.imagenUrl === anexo.imagenUrl)) {
            let finalUrl = anexo.imagenUrl;
            if (anexo.file || (anexo.imagenUrl && anexo.imagenUrl.startsWith('data:image'))) {
              let fileToUpload = anexo.file;
              if (!fileToUpload && anexo.imagenUrl.startsWith('data:image')) {
                try {
                  const res = await fetch(anexo.imagenUrl);
                  const blob = await res.blob();
                  fileToUpload = new File([blob], `anexo_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
                } catch (e) {}
              }
              if (fileToUpload) {
                const uploadedUrl = await this.uploadImageToStorage(fileToUpload, 'anexos-fotos');
                if (uploadedUrl) finalUrl = uploadedUrl;
              }
            }
            processedAnexos.push({
              id: anexo.id,
              titulo: anexo.titulo,
              imagenUrl: finalUrl,
              isPendingUpload: false
            });
          }
        }
      }

      // 5. Guardar Obligaciones y Anexos en Supabase
      if (informeId && isUuid(informeId)) {
        await supabase.from('informe_obligaciones').delete().eq('informe_id', informeId);

        const obligacionesRows = processedObligaciones.map((o, idx) => ({
          informe_id: informeId,
          obligacion_descripcion: o.descripcion,
          actividades_realizadas: o.actividades,
          soportes_texto: o.soportes,
          orden: idx + 1,
        }));

        if (obligacionesRows.length > 0) {
          await supabase.from('informe_obligaciones').insert(obligacionesRows);
        }

        await supabase.from('informe_anexos').delete().eq('informe_id', informeId);
        const anexosRows = processedAnexos.map((a, idx) => ({
          informe_id: informeId,
          titulo: a.titulo,
          imagen_url: a.imagenUrl,
          orden: idx + 1,
        }));

        if (anexosRows.length > 0) {
          await supabase.from('informe_anexos').insert(anexosRows);
        }
      }

      const updatedReportWithDb = {
        ...report,
        id: informeId,
        contratoId: contratoId,
        obligaciones: processedObligaciones,
        anexos: processedAnexos,
        syncedToDb: true,
      };

      const docKey = report.contratistaDocumento || user?.documentoIdentidad;
      if (typeof localStorage !== 'undefined') {
        if (docKey) {
          localStorage.setItem(`informe_data_${docKey}_${report.informeNro}`, JSON.stringify(updatedReportWithDb));
          if (report.comentariosCampos) {
            localStorage.setItem(`informe_comentarios_${docKey}_${report.informeNro}`, JSON.stringify(report.comentariosCampos));
          }
        }
      }

      return { success: true, id: informeId || `local-${Date.now()}` };
    } catch (err: any) {
      console.error('Error saving to Supabase:', err);
      const docKey = report.contratistaDocumento || user?.documentoIdentidad;
      if (typeof localStorage !== 'undefined') {
        if (docKey) {
          localStorage.setItem(`informe_data_${docKey}_${report.informeNro}`, JSON.stringify(report));
        }
      }
      return { success: true, id: `local-${Date.now()}` };
    }
  },

  // 9.1. Guardar Observaciones por Campo de la Supervisora y Actualizar Estado
  async saveReportComments(
    reportId: string, 
    informeNro: string, 
    contractorDoc: string, 
    comments: Record<string, FieldComment>,
    newStatus: EstadoInforme = 'Devuelto'
  ): Promise<boolean> {
    try {
      if (isUuid(reportId)) {
        const { data: currentReport } = await supabase
          .from('informes_mensuales')
          .select('observaciones')
          .eq('id', reportId)
          .maybeSingle();

        const { cleanObs, valorPagarText } = parseObservacionesAndComments(currentReport?.observaciones);
        const newObsWithComments = buildObservacionesWithComments(cleanObs, comments, valorPagarText);

        await supabase
          .from('informes_mensuales')
          .update({ 
            observaciones: newObsWithComments,
            estado: mapStatusToDb(newStatus) 
          })
          .eq('id', reportId);
      }
    } catch (e) {
      console.warn('Error saving comments to Supabase:', e);
    }

    // Persistir en LocalStorage
    if (typeof localStorage !== 'undefined') {
      if (contractorDoc) {
        localStorage.setItem(`informe_comentarios_${contractorDoc}_${informeNro}`, JSON.stringify(comments));
      }
      localStorage.setItem(`informe_comentarios_${informeNro}`, JSON.stringify(comments));

      const key1 = `informe_data_${contractorDoc}_${informeNro}`;
      const key2 = `informe_data_${informeNro}`;
      [key1, key2].forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            parsed.comentariosCampos = comments;
            parsed.estado = newStatus;
            localStorage.setItem(k, JSON.stringify(parsed));
          } catch {}
        }
      });
    }

    return true;
  },

  // 10. Eliminar Informe Completo (En Supabase, Almacenamiento de Fotos y Almacenamiento Local)
  async deleteFullInforme(
    reportId?: string, 
    informeNro?: string, 
    contractorDoc?: string,
    anexosList?: Anexo[]
  ): Promise<boolean> {
    try {
      // 1. Eliminar fotografías del Storage si se pasaron en anexosList
      if (anexosList && anexosList.length > 0) {
        for (const anx of anexosList) {
          if (anx.imagenUrl) {
            await this.deleteImageFromStorage(anx.imagenUrl);
          }
        }
      }

      // 2. Eliminar de Supabase por reportId UUID
      if (reportId && isUuid(reportId)) {
        // Consultar fotos asociadas en la tabla informe_anexos y borrarlas del Storage
        const { data: dbAnexos } = await supabase
          .from('informe_anexos')
          .select('imagen_url')
          .eq('informe_id', reportId);

        if (dbAnexos && dbAnexos.length > 0) {
          for (const anx of dbAnexos) {
            if (anx.imagen_url) {
              await this.deleteImageFromStorage(anx.imagen_url);
            }
          }
        }

        await supabase.from('informe_obligaciones').delete().eq('informe_id', reportId);
        await supabase.from('informe_anexos').delete().eq('informe_id', reportId);
        await supabase.from('informes_mensuales').delete().eq('id', reportId);
      }

      // 3. Si existen registros duplicados con el mismo número de informe en Supabase, eliminarlos también
      if (informeNro) {
        const { data: duplicates } = await supabase
          .from('informes_mensuales')
          .select('id')
          .eq('informe_nro', parseInt(informeNro, 10) || 1);

        if (duplicates && duplicates.length > 0) {
          for (const dup of duplicates) {
            const { data: dupAnexos } = await supabase
              .from('informe_anexos')
              .select('imagen_url')
              .eq('informe_id', dup.id);

            if (dupAnexos && dupAnexos.length > 0) {
              for (const anx of dupAnexos) {
                if (anx.imagen_url) {
                  await this.deleteImageFromStorage(anx.imagen_url);
                }
              }
            }

            await supabase.from('informe_obligaciones').delete().eq('informe_id', dup.id);
            await supabase.from('informe_anexos').delete().eq('informe_id', dup.id);
            await supabase.from('informes_mensuales').delete().eq('id', dup.id);
          }
        }
      }
    } catch (err) {
      console.warn('Error deleting report from Supabase:', err);
    }

    // 4. Limpiar LocalStorage
    if (informeNro) {
      localStorage.removeItem(`informe_data_${informeNro}`);
      localStorage.removeItem(`informe_comentarios_${informeNro}`);
      if (contractorDoc) {
        localStorage.removeItem(`informe_data_${contractorDoc}_${informeNro}`);
        localStorage.removeItem(`informe_comentarios_${contractorDoc}_${informeNro}`);
        localStorage.setItem(`deleted_report_${contractorDoc}_${informeNro}`, 'true');
      }
    }
    return true;
  },

  // 11. Actualizar Estado de Informe
  async updateEstado(id: string, nuevoEstado: EstadoInforme): Promise<boolean> {
    try {
      if (isUuid(id)) {
        const { error } = await supabase
          .from('informes_mensuales')
          .update({ estado: mapStatusToDb(nuevoEstado) })
          .eq('id', id);
        if (error) throw error;
      }
      return true;
    } catch (err) {
      console.warn('Error updating status in Supabase:', err);
      return true;
    }
  },

  // 12. Depuración Automática de Informes y Fotos mayores a 7 meses (210 días)
  async cleanupExpiredReports(reports: ReportData[], contractorDoc?: string): Promise<{ cleanedCount: number; validReports: ReportData[] }> {
    const MAX_RETENTION_DAYS = 210; // 7 meses (aproximadamente 210 días)
    const now = new Date();

    const parseDate = (dStr?: string): Date | null => {
      if (!dStr || dStr === 'N/A') return null;
      if (dStr.includes('/')) {
        const parts = dStr.split('/');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          return isNaN(d.getTime()) ? null : d;
        }
      }
      if (dStr.includes('-')) {
        const parts = dStr.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          return isNaN(d.getTime()) ? null : d;
        }
      }
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? null : d;
    };

    const validReports: ReportData[] = [];
    let cleanedCount = 0;

    for (const rep of reports) {
      const targetDate = parseDate(rep.periodoHasta) || parseDate(rep.fechaPresentacion);
      let isExpired = false;

      if (targetDate) {
        const diffMs = now.getTime() - targetDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > MAX_RETENTION_DAYS) {
          isExpired = true;
        }
      }

      if (isExpired) {
        cleanedCount++;
        // Eliminar de Supabase (informes, fotos y obligaciones)
        await this.deleteFullInforme(rep.id, rep.informeNro, contractorDoc || rep.contratistaDocumento);
      } else {
        validReports.push(rep);
      }
    }

    return { cleanedCount, validReports };
  },

  // 13. Guardar / Sincronizar Certificado de Supervisión en Supabase y LocalStorage
  async saveCertificadoSupervision(
    certData: CertificadoSupervisionData, 
    informeId?: string,
    supervisorId?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const cleanNumeric = (val?: string | number, defaultVal: number = 0): number => {
      if (typeof val === 'number') return val;
      if (!val || val === '-') return defaultVal;
      const cleaned = val.toString().split(',')[0].replace(/[^0-9]/g, '');
      return parseInt(cleaned, 10) || defaultVal;
    };

    const docKey = certData.contratistaDocumento || '';
    const pagoNroStr = certData.pagoNro || '1';

    // 1. Guardar copia en LocalStorage inmediatamente
    if (typeof localStorage !== 'undefined') {
      const storageKey = `cert_data_${docKey}_${pagoNroStr}`;
      localStorage.setItem(storageKey, JSON.stringify(certData));
      localStorage.setItem(`cert_data_${pagoNroStr}`, JSON.stringify(certData));
    }

    try {
      let resolvedInformeId = (informeId && isUuid(informeId)) ? informeId : null;
      let contratoId: string | null = null;

      // Si no tenemos UUID de informe, buscar si existe informe por documento y número de pago
      if (!resolvedInformeId && docKey) {
        const { data: rep } = await supabase
          .from('informes_mensuales')
          .select('id, contrato_id, contratos!inner(id, profiles!inner(documento_identidad))')
          .eq('informe_nro', parseInt(pagoNroStr, 10) || 1)
          .eq('contratos.profiles.documento_identidad', docKey)
          .limit(1)
          .maybeSingle();

        if (rep?.id && isUuid(rep.id)) {
          resolvedInformeId = rep.id;
          contratoId = (rep as any).contrato_id;
        }
      }

      const payload: any = {
        contratista_documento: docKey,
        pago_nro: pagoNroStr,
        periodo_certificado: `${certData.periodoDesde || ''} - ${certData.periodoHasta || ''}`,
        valor_autorizado_pago: cleanNumeric(certData.valorTotalAPagar || certData.valorAvalado),
        valor_total_contrato: cleanNumeric(certData.valorTotal || certData.valorInicial),
        saldo_por_pagar: cleanNumeric(certData.saldoPorPagar),
        porcentaje_ejecucion: certData.porcentajeEjecucion || '',
        observaciones_supervision: certData.objeto || '',
        observaciones_liquidacion: certData.observacionesLiquidacion || '',
        expedicion_dia: certData.expedicionDia || '',
        expedicion_mes: certData.expedicionMes || '',
        expedicion_ano: certData.expedicionAno || '',
        datos_formulario: certData, // Guardar todos los campos del formulario íntegramente
        certifica_cumplimiento: true,
        updated_at: new Date().toISOString(),
      };

      if (resolvedInformeId && isUuid(resolvedInformeId)) {
        payload.informe_id = resolvedInformeId;
      }
      if (contratoId && isUuid(contratoId)) {
        payload.contrato_id = contratoId;
      }
      if (supervisorId && isUuid(supervisorId)) {
        payload.supervisor_id = supervisorId;
      }

      // Comprobar si ya existe registro por informe_id o por documento y pago_nro
      let existingId: string | null = null;
      if (resolvedInformeId) {
        const { data: existingCert } = await supabase
          .from('certificaciones_supervision')
          .select('id')
          .eq('informe_id', resolvedInformeId)
          .limit(1)
          .maybeSingle();
        if (existingCert?.id) existingId = existingCert.id;
      }

      if (!existingId && docKey) {
        const { data: existingByDoc } = await supabase
          .from('certificaciones_supervision')
          .select('id')
          .eq('contratista_documento', docKey)
          .eq('pago_nro', pagoNroStr)
          .limit(1)
          .maybeSingle();
        if (existingByDoc?.id) existingId = existingByDoc.id;
      }

      if (existingId) {
        const { error: updateErr } = await supabase
          .from('certificaciones_supervision')
          .update(payload)
          .eq('id', existingId);

        if (updateErr) console.warn('Supabase update cert error:', updateErr);
        return { success: true, id: existingId };
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('certificaciones_supervision')
          .insert([payload])
          .select('id')
          .maybeSingle();

        if (insertErr) console.warn('Supabase insert cert error:', insertErr);
        return { success: true, id: inserted?.id };
      }
    } catch (e: any) {
      console.warn('Error saving certificado supervision to Supabase:', e);
      return { success: true, id: `local-${Date.now()}` };
    }
  },

  // 14. Obtener Certificado de Supervisión desde Supabase o LocalStorage
  async getCertificadoSupervision(
    informeId?: string,
    docIdentidad?: string,
    pagoNro?: string
  ): Promise<CertificadoSupervisionData | null> {
    try {
      if (informeId && isUuid(informeId)) {
        const { data, error } = await supabase
          .from('certificaciones_supervision')
          .select('*')
          .eq('informe_id', informeId)
          .limit(1)
          .maybeSingle();

        if (!error && data?.datos_formulario) {
          return data.datos_formulario as CertificadoSupervisionData;
        }
      }

      if (docIdentidad && pagoNro) {
        const { data, error } = await supabase
          .from('certificaciones_supervision')
          .select('*')
          .eq('contratista_documento', docIdentidad)
          .eq('pago_nro', pagoNro)
          .limit(1)
          .maybeSingle();

        if (!error && data?.datos_formulario) {
          return data.datos_formulario as CertificadoSupervisionData;
        }
      }
    } catch (e) {
      console.warn('Error fetching certificado supervision:', e);
    }

    // Fallback a LocalStorage
    if (typeof localStorage !== 'undefined') {
      const key = `cert_data_${docIdentidad || ''}_${pagoNro || '1'}`;
      const saved = localStorage.getItem(key) || (pagoNro ? localStorage.getItem(`cert_data_${pagoNro}`) : null);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }

    return null;
  },

  // 15. Guardar Soporte Fiduciaria
  async saveSoporteFiduciaria(
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
        const { data: existingFid } = await supabase.from('soportes_fiduciaria').select('id').eq('informe_id', resolvedInformeId).limit(1).maybeSingle();
        if (existingFid?.id) existingId = existingFid.id;
      }
      if (!existingId && docKey) {
        const { data: existingByDoc } = await supabase.from('soportes_fiduciaria').select('id').eq('contratista_documento', docKey).eq('pago_nro', pagoNroStr).limit(1).maybeSingle();
        if (existingByDoc?.id) existingId = existingByDoc.id;
      }

      if (existingId) {
        await supabase.from('soportes_fiduciaria').update(payload).eq('id', existingId);
        return { success: true, id: existingId };
      } else {
        const { data: inserted } = await supabase.from('soportes_fiduciaria').insert([payload]).select('id').maybeSingle();
        return { success: true, id: inserted?.id };
      }
    } catch (e: any) {
      console.warn('Error saving soporte fiduciaria to Supabase:', e);
      return { success: true, id: `local-${Date.now()}` };
    }
  },

  // 16. Obtener Soporte Fiduciaria
  async getSoporteFiduciaria(
    informeId?: string,
    docIdentidad?: string,
    pagoNro?: string
  ): Promise<any | null> {
    try {
      if (informeId && isUuid(informeId)) {
        const { data, error } = await supabase.from('soportes_fiduciaria').select('*').eq('informe_id', informeId).limit(1).maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
      if (docIdentidad && pagoNro) {
        const { data, error } = await supabase.from('soportes_fiduciaria').select('*').eq('contratista_documento', docIdentidad).eq('pago_nro', pagoNro).limit(1).maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
    } catch (e) {
      console.warn('Error fetching soporte fiduciaria:', e);
    }
    
    if (typeof localStorage !== 'undefined') {
      const key = `fid_data_${docIdentidad || ''}_${pagoNro || '1'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return null;
  },
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
      return { success: true, id: `local-${Date.now()}` };
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
      const key = `dec_renta_${docIdentidad || ''}_${pagoNro || '1'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return null;
  },

  // 19. Guardar Autorizacion de Desembolso
  async saveAutorizacionDesembolso(
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
        const { data: existingDoc } = await supabase.from('autorizaciones_desembolso').select('id').eq('informe_id', resolvedInformeId).limit(1).maybeSingle();
        if (existingDoc?.id) existingId = existingDoc.id;
      }
      if (!existingId && docKey) {
        const { data: existingByDoc } = await supabase.from('autorizaciones_desembolso').select('id').eq('contratista_documento', docKey).eq('pago_nro', pagoNroStr).limit(1).maybeSingle();
        if (existingByDoc?.id) existingId = existingByDoc.id;
      }

      if (existingId) {
        await supabase.from('autorizaciones_desembolso').update(payload).eq('id', existingId);
        return { success: true, id: existingId };
      } else {
        const { data: inserted } = await supabase.from('autorizaciones_desembolso').insert([payload]).select('id').maybeSingle();
        return { success: true, id: inserted?.id };
      }
    } catch (e: any) {
      console.warn('Error saving autorizacion desembolso to Supabase:', e);
      return { success: true, id: `local-${Date.now()}` };
    }
  },

  // 20. Obtener Autorizacion de Desembolso
  async getAutorizacionDesembolso(
    informeId?: string,
    docIdentidad?: string,
    pagoNro?: string
  ): Promise<any | null> {
    try {
      if (informeId && isUuid(informeId)) {
        const { data, error } = await supabase.from('autorizaciones_desembolso').select('*').eq('informe_id', informeId).limit(1).maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
      if (docIdentidad && pagoNro) {
        const { data, error } = await supabase.from('autorizaciones_desembolso').select('*').eq('contratista_documento', docIdentidad).eq('pago_nro', pagoNro).limit(1).maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
    } catch (e) {
      console.warn('Error fetching autorizacion desembolso:', e);
    }
    
    if (typeof localStorage !== 'undefined') {
      const key = `desembolso_${docIdentidad || ''}_${pagoNro || '1'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return null;
  }
};
