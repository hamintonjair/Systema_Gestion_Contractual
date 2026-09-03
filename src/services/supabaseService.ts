import { supabase } from '../lib/supabase';
import { Secretaria, ReportData, InformeSummary, EstadoInforme, AuthUser, UserRole, Anexo, FieldComment, CertificadoSupervisionData, createDefaultCertificadoData, createDefaultFiduciariaData, createDefaultAutorizacionDesembolsoData, Obligacion, Notificacion, extractContratoNroOnly } from '../types';
import { formatColombianCurrency, formatValorAdicion, formatPlazoLetraYNumero, parsePlazoComponents, formatDateSlash, formatFechaAplicacion } from '../utils/formatters';
import { isMainReportComment } from '../utils/commentUtils';
import { limpiarNumeroMoneda, formatearNumeroTablaCol } from '../utils/paymentPlanUtils';
import { convertirNumeroALetras } from '../utils/numberToWords';

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
  if (typeof localStorage === 'undefined') return {};
  try {
    if (docKey && informeNro) {
      const raw = localStorage.getItem(`informe_comentarios_${docKey}_${informeNro}`) || 
                  localStorage.getItem(`informe_comments_${docKey}_${informeNro}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Object.keys(parsed).length > 0) return parsed;
      }
      const rawData = localStorage.getItem(`informe_data_${docKey}_${informeNro}`) || 
                      localStorage.getItem(`alcaldia_quibdo_report_${docKey}_${informeNro}`);
      if (rawData) {
        const parsed = JSON.parse(rawData);
        if (parsed?.comentariosCampos && Object.keys(parsed.comentariosCampos).length > 0) {
          return parsed.comentariosCampos;
        }
      }
      // CRITICAL: When docKey is present, do NOT fall back to global keys.
      // This prevents Contractor B from loading Contractor A's comments (as they share the same informeNro).
      return {};
    }
    if (informeNro) {
      const raw = localStorage.getItem(`informe_comentarios_${informeNro}`) || 
                  localStorage.getItem(`informe_comments_${informeNro}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Object.keys(parsed).length > 0) return parsed;
      }
      const rawData = localStorage.getItem(`informe_data_${informeNro}`) || 
                      localStorage.getItem(`alcaldia_quibdo_report_${informeNro}`);
      if (rawData) {
        const parsed = JSON.parse(rawData);
        if (parsed?.comentariosCampos && Object.keys(parsed.comentariosCampos).length > 0) {
          return parsed.comentariosCampos;
        }
      }
    }
  } catch (e) {}
  return {};
};

// Helper para obtener informe completo almacenado
const getStoredReportData = (docKey?: string, informeNro?: string): Partial<ReportData> | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (docKey && informeNro) {
      const raw = localStorage.getItem(`informe_data_${docKey}_${informeNro}`) ||
                  localStorage.getItem(`alcaldia_quibdo_report_${docKey}_${informeNro}`);
      if (raw) return JSON.parse(raw);
      // DO NOT fall back to global keys when docKey is provided!
      return null;
    }
    if (informeNro) {
      const raw = localStorage.getItem(`informe_data_${informeNro}`) ||
                  localStorage.getItem(`alcaldia_quibdo_report_${informeNro}`);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
};

// Helper para asociar hasta 5 fotos por obligación de forma consistente con respaldo posicional y textual
const associateFotosToObligaciones = (obligaciones: Obligacion[], anexos: Anexo[], storedObs?: Obligacion[]): { obsWithFotos: Obligacion[]; allAnexos: Anexo[] } => {
  const allAnexos = [...anexos];
  const assignedAnexosIds = new Set<string>();

  const obsWithFotos = obligaciones.map((obs, idx) => {
    // 1. Priorizar la búsqueda de fotos coincidentes en la base de datos (Supabase)
    const matchedDb = allAnexos.filter(a => {
      if (assignedAnexosIds.has(a.id)) return false;
      if (a.obligacionId && a.obligacionId === obs.id) return true;
      if (a.obligacionIndex !== undefined && a.obligacionIndex === (idx + 1)) return true;
      const t = (a.titulo || '').toLowerCase();
      if (
        t.includes(`obligación #${idx + 1}`) || 
        t.includes(`obligacion #${idx + 1}`) || 
        t.includes(`obligación ${idx + 1}`) || 
        t.includes(`obligacion ${idx + 1}`) || 
        t.includes(`obl #${idx + 1}`) ||
        t.includes(`obligación n° ${idx + 1}`) ||
        t.includes(`obligacion n ${idx + 1}`) ||
        t.startsWith(`[obligación ${idx + 1}]`) || 
        t.startsWith(`[obligacion ${idx + 1}]`)
      ) {
        return true;
      }
      return false;
    });

    // 2. Buscar borradores locales pendientes de subida en localStorage (como imágenes data:image)
    const stored = storedObs?.find(so => so.id === obs.id || so.descripcion === obs.descripcion);
    const localDrafts = (stored?.fotos || []).filter(f => {
      const url = f.imagenUrl || '';
      return f.file || url.startsWith('data:') || f.isPendingUpload;
    });

    // Combinar priorizando la base de datos (con URLs públicas de producción) y luego borradores locales
    const combined = [...matchedDb, ...localDrafts].slice(0, 5);

    // Registrar IDs asignados para evitar duplicación
    combined.forEach(f => {
      if (f.id) assignedAnexosIds.add(f.id);
    });

    const finalFotos = combined.map((f, fIdx) => ({
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
    if (obs.fotos && obs.fotos.length > 0) {
      flatAnexos.push(...obs.fotos);
    }
  });

  allAnexos.forEach(a => {
    if (!flatAnexos.some(fa => fa.id === a.id || fa.imagenUrl === a.imagenUrl)) {
      flatAnexos.push(a);
    }
  });

  return { obsWithFotos, allAnexos: flatAnexos };
};

// Helpers para codificar/decodificar observaciones, comentarios por campo y texto de certificación sin requerir migraciones de BD
const parseObservacionesAndComments = (rawObs?: string): { 
  cleanObs: string; 
  comments: Record<string, FieldComment>; 
  valorPagarText?: string;
  plazoText?: string;
  valorMensualText?: string;
} => {
  if (!rawObs) return { cleanObs: '', comments: {} };
  let current = rawObs;
  let comments: Record<string, FieldComment> = {};
  let valorPagarText: string | undefined;
  let plazoText: string | undefined;
  let valorMensualText: string | undefined;

  // 1. Extraer __COMMENTS_JSON__: si existe
  if (current.includes('__COMMENTS_JSON__ :') || current.includes('__COMMENTS_JSON__:')) {
    const isSpaced = current.includes('__COMMENTS_JSON__ :');
    const marker = isSpaced ? '__COMMENTS_JSON__ :' : '__COMMENTS_JSON__:';
    const idx = current.indexOf(marker);
    const afterComments = current.slice(idx + marker.length);
    const rawJson = afterComments.split('__VALOR_PAGAR__:')[0].split('__PLAZO__:')[0].split('__VALOR_MENSUAL__:')[0].trim();
    try {
      comments = JSON.parse(rawJson);
    } catch (e) {
      console.warn('Error parsing __COMMENTS_JSON__:', e);
    }
    // Remover la sección de comentarios del string actual
    current = current.slice(0, idx) + afterComments.slice(rawJson.length);
  }

  // 2. Extraer __VALOR_PAGAR__: si existe
  if (current.includes('__VALOR_PAGAR__:')) {
    const idx = current.indexOf('__VALOR_PAGAR__:');
    const afterVp = current.slice(idx + '__VALOR_PAGAR__:'.length);
    const rawVp = afterVp.split('__COMMENTS_JSON__')[0].split('__PLAZO__:')[0].split('__VALOR_MENSUAL__:')[0].trim();
    try {
      valorPagarText = decodeURIComponent(rawVp);
    } catch (e) {
      valorPagarText = rawVp;
    }
    // Remover la sección de valor a pagar del string actual
    current = current.slice(0, idx) + afterVp.slice(rawVp.length);
  }

  // 3. Extraer __PLAZO__: si existe
  if (current.includes('__PLAZO__:')) {
    const idx = current.indexOf('__PLAZO__:');
    const afterPl = current.slice(idx + '__PLAZO__:'.length);
    const rawPl = afterPl.split('__COMMENTS_JSON__')[0].split('__VALOR_PAGAR__:')[0].split('__VALOR_MENSUAL__:')[0].trim();
    try {
      plazoText = decodeURIComponent(rawPl);
    } catch (e) {
      plazoText = rawPl;
    }
    // Remover la sección de plazo del string actual
    current = current.slice(0, idx) + afterPl.slice(rawPl.length);
  }

  // 4. Extraer __VALOR_MENSUAL__: si existe
  if (current.includes('__VALOR_MENSUAL__:')) {
    const idx = current.indexOf('__VALOR_MENSUAL__:');
    const afterVm = current.slice(idx + '__VALOR_MENSUAL__:'.length);
    const rawVm = afterVm.split('__COMMENTS_JSON__')[0].split('__VALOR_PAGAR__:')[0].split('__PLAZO__:')[0].trim();
    try {
      valorMensualText = decodeURIComponent(rawVm);
    } catch (e) {
      valorMensualText = rawVm;
    }
    // Remover la sección de valor mensual del string actual
    current = current.slice(0, idx) + afterVm.slice(rawVm.length);
  }

  // Limpiar saltos de línea sobrantes y posibles marcadores vacíos
  const cleanObs = current
    .replace(/__VALOR_PAGAR__:\s*/g, '')
    .replace(/__PLAZO__:\s*/g, '')
    .replace(/__VALOR_MENSUAL__:\s*/g, '')
    .replace(/__COMMENTS_JSON__:\s*/g, '')
    .replace(/__COMMENTS_JSON__\s*:\s*/g, '')
    .trim();

  return { cleanObs, comments, valorPagarText, plazoText, valorMensualText };
};

const buildObservacionesWithComments = (
  cleanObs: string, 
  comments?: Record<string, FieldComment>, 
  valorPagarText?: string,
  plazoText?: string,
  valorMensualText?: string
): string => {
  let baseObs = cleanObs || '';
  if (valorPagarText && valorPagarText.trim()) {
    baseObs = `${baseObs}\n\n__VALOR_PAGAR__:${encodeURIComponent(valorPagarText.trim())}`;
  }
  if (plazoText && plazoText.trim()) {
    baseObs = `${baseObs}\n\n__PLAZO__:${encodeURIComponent(plazoText.trim())}`;
  }
  if (valorMensualText && valorMensualText.trim()) {
    baseObs = `${baseObs}\n\n__VALOR_MENSUAL__:${encodeURIComponent(valorMensualText.trim())}`;
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
  // Helper: Obtener comentarios guardados por documento y número de informe
  getStoredComments(docKey?: string, informeNro?: string): Record<string, FieldComment> {
    return getStoredComments(docKey, informeNro);
  },

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

      // Decodificar caracteres especiales como %20 para que coincida exactamente con el archivo original en el Storage de Supabase
      filePath = decodeURIComponent(filePath);

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

  // 4. Actualizar Secretaría y Administrador Oficial
  async updateSecretariaWithAdmin(
    secId: string,
    secData: { nombre: string; codigo: string; nit: string },
    adminData: { id?: string; nombreCompleto: string; documentoIdentidad: string; email: string; password?: string; cargo?: string; telefono?: string }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const trimmedNombre = secData.nombre.trim();
      const trimmedCodigo = secData.codigo.trim();
      const trimmedNit = secData.nit.trim();

      // 1. Actualizar tabla sec_secretarias en Supabase si es UUID
      if (isUuid(secId)) {
        await supabase
          .from('sec_secretarias')
          .update({
            nombre: trimmedNombre,
            codigo: trimmedCodigo,
            nit: trimmedNit,
            updated_at: new Date().toISOString()
          })
          .eq('id', secId);
      }

      // 2. Actualizar almacenamiento local de secretarías
      const storedSecs = localStorage.getItem(STORAGE_SECRETARIAS_KEY);
      if (storedSecs) {
        let secs: Secretaria[] = JSON.parse(storedSecs);
        secs = secs.map(s => s.id === secId || s.codigo === trimmedCodigo ? { ...s, nombre: trimmedNombre, codigo: trimmedCodigo, nit: trimmedNit } : s);
        localStorage.setItem(STORAGE_SECRETARIAS_KEY, JSON.stringify(secs));
      }

      // 3. Actualizar administrador en Supabase
      const adminDoc = adminData.documentoIdentidad.trim().replace(/\./g, '');
      const adminEmail = adminData.email.trim();
      const adminPass = adminData.password?.trim();

      if (adminData.id && isUuid(adminData.id)) {
        await supabase
          .from('profiles')
          .update({
            nombre_completo: adminData.nombreCompleto.trim().toUpperCase(),
            documento_identidad: adminDoc,
            email: adminEmail,
            cargo: adminData.cargo?.trim() || 'Secretaria de Despacho / Supervisora',
            telefono: adminData.telefono?.trim() || '3100000000',
            updated_at: new Date().toISOString()
          })
          .eq('id', adminData.id);
      }

      if (adminPass) {
        this.saveUserPassword(adminEmail, adminPass);
        this.saveUserPassword(adminDoc, adminPass);
      }

      // 4. Actualizar almacenamiento local de usuarios
      const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
      if (storedUsers) {
        let customUsers: AuthUser[] = JSON.parse(storedUsers);
        customUsers = customUsers.map(u => {
          if (
            (adminData.id && u.id === adminData.id) || 
            (u.role === 'secretaria_admin' && (u.secretariaId === secId || u.secretariaCodigo === trimmedCodigo))
          ) {
            return {
              ...u,
              nombreCompleto: adminData.nombreCompleto.trim().toUpperCase(),
              documentoIdentidad: adminDoc,
              email: adminEmail,
              cargo: adminData.cargo?.trim() || u.cargo,
              telefono: adminData.telefono?.trim() || u.telefono,
              password: adminPass || u.password,
              secretariaNombre: trimmedNombre,
              secretariaCodigo: trimmedCodigo
            };
          }
          return u;
        });
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(customUsers));
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error al actualizar secretaria:', e);
      return { success: false, message: e.message || 'Error al actualizar secretaría' };
    }
  },

  // 5. Eliminar Secretaría de Despacho (Solo si no tiene registros vinculados)
  async deleteSecretaria(secId: string, secCodigo: string, secNombre: string): Promise<{ success: boolean; message?: string }> {
    try {
      const allUsers = await this.getAllUsers();
      const linkedContractors = allUsers.filter(
        u => u.role === 'contratista' && (u.secretariaId === secId || u.secretariaCodigo === secCodigo || u.secretariaNombre?.toLowerCase() === secNombre.toLowerCase())
      );

      const allReports = await this.getInformes();
      const linkedReports = allReports.filter(
        r => r.secretariaId === secId || r.secretariaNombre?.toLowerCase() === secNombre.toLowerCase()
      );

      if (linkedContractors.length > 0 || linkedReports.length > 0) {
        return {
          success: false,
          message: `No se puede eliminar la dependencia. Tiene ${linkedContractors.length} contratista(s) y ${linkedReports.length} informe(s) registrados.`
        };
      }

      // Eliminar de Supabase si aplica
      if (isUuid(secId)) {
        await supabase.from('sec_secretarias').delete().eq('id', secId);
        await supabase.from('profiles').delete().eq('secretaria_id', secId);
      }

      // Actualizar local storage secretarias
      const storedSecs = localStorage.getItem(STORAGE_SECRETARIAS_KEY);
      if (storedSecs) {
        let secs: Secretaria[] = JSON.parse(storedSecs);
        secs = secs.filter(s => s.id !== secId && s.codigo !== secCodigo);
        localStorage.setItem(STORAGE_SECRETARIAS_KEY, JSON.stringify(secs));
      }

      // Actualizar local storage usuarios (remover administrador asignado a esta secretaría)
      const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
      if (storedUsers) {
        let customUsers: AuthUser[] = JSON.parse(storedUsers);
        customUsers = customUsers.filter(u => !(u.role === 'secretaria_admin' && (u.secretariaId === secId || u.secretariaCodigo === secCodigo)));
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(customUsers));
      }

      return { success: true, message: 'Dependencia eliminada correctamente.' };
    } catch (e: any) {
      console.error('Error al eliminar secretaría:', e);
      return { success: false, message: e.message || 'Error al eliminar la dependencia.' };
    }
  },

  // 4. Obtener Contratistas y Supervisores en Tiempo Real de Supabase
  async getContractors(secretariaId?: string): Promise<AuthUser[]> {
    let contractorsFromDb: AuthUser[] = [];
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*, sec_secretarias(*), contratos(*)')
        .in('role', ['contratista', 'secretaria_admin'])
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from('profiles')
          .select('*, contratos(*)')
          .in('role', ['contratista', 'secretaria_admin']);
        if (!fallback.error && fallback.data) {
          data = fallback.data;
          error = null;
        }
      }

      if (!error && data && data.length > 0) {
        contractorsFromDb = data.map((row: any) => {
          const doc = row.documento_identidad || '';
          const mail = row.email || '';
          const userRole = (row.role as any) || 'contratista';
          // Obtener la contraseña asignada si fue guardada previamente; si no, dejar vacío para indicar que está protegida en Auth
          const pass = this.getUserPassword(mail) || this.getUserPassword(doc) || '';
          const cont = Array.isArray(row.contratos) ? row.contratos[0] : row.contratos;

          return {
            id: row.id,
            email: mail,
            password: pass,
            nombreCompleto: row.nombre_completo || 'USUARIO REGISTRADO',
            documentoIdentidad: doc,
            role: userRole,
            secretariaId: row.secretaria_id || '',
            secretariaNombre: row.sec_secretarias?.nombre || '',
            secretariaCodigo: row.sec_secretarias?.codigo || '',
            cargo: row.cargo || (userRole === 'secretaria_admin' ? 'Supervisor / Apoyo a la Supervisión' : 'Contratista de Prestación de Servicios'),
            telefono: row.telefono || '',
            barrio: row.direccion || '',
            direccion: row.direccion || '',
            numeroCuenta: cont?.numero_cuenta || '',
            banco: cont?.banco || '',
            tipoCuenta: cont?.tipo_cuenta || 'AHORRO',
            ciudad: cont?.ciudad || '',
            contratoNro: cont?.contrato_nro || '',
            objetoContrato: cont?.objeto || '',
            valorContrato: cont?.valor_contrato ? String(cont.valor_contrato) : '',
            cdpNro: cont?.cdp_nro || '',
            crpNro: cont?.crp_nro || '',
            polizaNro: cont?.poliza_nro || '',
            fechaPoliza: cont?.fecha_aprobacion_poliza || '',
            fechaInicio: cont?.fecha_inicio || '',
            fechaTerminacion: cont?.fecha_terminacion || '',
            supervisorNombre: cont?.supervisor_nombre || '',
            supervisorDocumento: cont?.supervisor_documento || '',
            apoyoSupervisionNombre: cont?.apoyo_supervision_nombre || '',
            apoyoSupervisionDocumento: cont?.apoyo_supervision_documento || '',
            createdAt: row.created_at || new Date().toISOString(),
            isSyncedToDb: true,
          };
        });
      }
    } catch (err) {
      console.warn('Error fetching contractors from Supabase:', err);
    }

    // SIEMPRE combinar con contratistas guardados localmente
    const map = new Map<string, AuthUser>();
    contractorsFromDb.forEach(c => {
      const key = (c.documentoIdentidad || c.email || c.id).replace(/\./g, '').trim().toLowerCase();
      if (key) map.set(key, c);
    });

    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = stored ? JSON.parse(stored) : [];
    const localContractors = customUsers.filter(u => u.role === 'contratista' || u.role === 'secretaria_admin');
    localContractors.forEach(c => {
      const key = (c.documentoIdentidad || c.email || c.id).replace(/\./g, '').trim().toLowerCase();
      if (key) {
        const existing = map.get(key);
        if (existing) {
          map.set(key, { ...existing, ...c, isSyncedToDb: existing.isSyncedToDb ?? isUuid(existing.id) });
        } else {
          map.set(key, { ...c, isSyncedToDb: isUuid(c.id) });
        }
      }
    });

    let allContractors = Array.from(map.values());

    // Filtrar por secretaría si se proporcionó parámetro
    if (secretariaId) {
      allContractors = allContractors.filter(c => {
        if (c.secretariaId === secretariaId) return true;
        if (isUuid(secretariaId) && isUuid(c.secretariaId) && c.secretariaId === secretariaId) return true;
        if (secretariaId.includes('170') && c.secretariaCodigo === '170') return true;
        return false;
      });
    }

    return allContractors;
  },

  // 5. Crear Contratista o Supervisor en Supabase (Tabla 'profiles')
  async createContractor(
    contractorData: Omit<AuthUser, 'id'> | (Omit<AuthUser, 'id' | 'role'> & { role?: UserRole })
  ): Promise<{ success: boolean; data: AuthUser; error?: string }> {
    const rawEmail = contractorData.email.trim();
    const rawDoc = contractorData.documentoIdentidad.trim().replace(/\./g, '');
    const userRole: UserRole = (contractorData as any).role || 'contratista';
    const pass = contractorData.password?.trim() || (userRole === 'secretaria_admin' ? 'Supervisor2026*' : 'Contratista2026*');
    const fullName = contractorData.nombreCompleto.trim().toUpperCase();
    const phone = contractorData.telefono?.trim() || '';
    const cargo = contractorData.cargo?.trim() || (userRole === 'secretaria_admin' ? 'Supervisor / Apoyo a la Supervisión' : 'Contratista de Prestación de Servicios');

    // Resolver UUID real de la secretaría
    const secUuid = await this.resolveSecretariaUuid(contractorData.secretariaId || contractorData.secretariaCodigo || contractorData.secretariaNombre);

    // 1. Verificar si ya existe un perfil en Supabase 'profiles' (por documento o email)
    let existingProfile: any = null;
    try {
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .or(`documento_identidad.eq.${rawDoc},email.ilike.${rawEmail}`)
        .limit(1);
      if (profData && profData.length > 0) {
        existingProfile = profData[0];
      }
    } catch (e) {
      console.warn('Notice checking existing profile:', e);
    }

    let createdId: string = `usr-${userRole}-${Date.now()}`;
    let dbErrorMsg: string | undefined;

    if (existingProfile) {
      // SI YA EXISTE EN PROFILES: Actualizar directamente sin llamar auth.signUp (evita 429)
      createdId = existingProfile.id;
      try {
        const updatePayload: any = {
          role: userRole,
          nombre_completo: fullName,
          telefono: phone,
          direccion: contractorData.direccion || contractorData.barrio || '',
          cargo: cargo,
          activo: true,
        };
        if (secUuid && isUuid(secUuid)) {
          updatePayload.secretaria_id = secUuid;
        }
        await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', existingProfile.id);
      } catch (e: any) {
        console.warn('Notice updating existing contractor profile:', e);
      }
    } else {
      // SI NO EXISTE EN PROFILES: Insertamos directamente sin pasar por auth.users
      // IMPORTANTE: Esto requiere haber eliminado la FK en la base de datos de Supabase.
      const finalUserId = crypto.randomUUID();
      createdId = finalUserId;
      
      const profilePayload: any = {
        id: finalUserId,
        role: userRole,
        nombre_completo: fullName,
        documento_identidad: rawDoc,
        email: rawEmail,
        telefono: phone,
        direccion: contractorData.direccion || contractorData.barrio || '',
        cargo: cargo,
        activo: true,
      };
      
      if (secUuid && isUuid(secUuid)) {
        profilePayload.secretaria_id = secUuid;
      }

      try {
        const { data: inserted, error: insertErr } = await supabase
          .from('profiles')
          .insert([profilePayload])
          .select('*');

        if (inserted && inserted.length > 0) {
          createdId = inserted[0].id;
        } else if (insertErr) {
          console.warn('Profiles insert notice (might be missing FK in auth.users):', insertErr.message);
        }
      } catch (e: any) {
        console.warn('Profiles catch notice:', e);
      }
    }

    // 2. Crear o actualizar contrato vinculado en la tabla 'contratos' de Supabase (SOLO si se proporcionaron datos de contrato)
    if (contractorData.contratoNro || contractorData.valorContrato || contractorData.objetoContrato) {
      try {
        const cleanNumeric = (val?: string | number): number | null => {
          if (typeof val === 'number') return val;
          if (!val) return null;
          const cleaned = val.toString().replace(/[^0-9]/g, '');
          const parsed = parseInt(cleaned, 10);
          return isNaN(parsed) ? null : parsed;
        };

        const parseDateForPg = (dateStr?: string): string | null => {
          if (!dateStr || dateStr === 'N/A') return null;
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
          return null;
        };

        const validContratistaId = (createdId && isUuid(createdId)) ? createdId : null;
        const secId = await this.resolveSecretariaUuid(contractorData.secretariaId, contractorData.secretariaNombre);
        const contratoNro = contractorData.contratoNro ? contractorData.contratoNro.trim() : null;

        // Buscar si ya existe contrato registrado
        let existingContrato: any = null;
        try {
          if (validContratistaId) {
            const { data: cData } = await supabase
              .from('contratos')
              .select('id')
              .eq('contratista_id', validContratistaId)
              .limit(1);
            if (cData && cData.length > 0) {
              existingContrato = cData[0];
            }
          }
          if (!existingContrato && contratoNro) {
            const { data: cDataNro } = await supabase
              .from('contratos')
              .select('id')
              .eq('contrato_nro', contratoNro)
              .limit(1);
            if (cDataNro && cDataNro.length > 0) {
              existingContrato = cDataNro[0];
            }
          }
        } catch (cCheckErr) {
          console.warn('Notice checking existing contrato:', cCheckErr);
        }

        const contratoPayload: any = {
          contratista_id: validContratistaId,
          secretaria_id: secId,
          contrato_nro: contratoNro || '',
          objeto: contractorData.objetoContrato || '',
          valor_contrato: cleanNumeric(contractorData.valorContrato),
          cdp_nro: contractorData.cdpNro || null,
          crp_nro: contractorData.crpNro || null,
          poliza_nro: contractorData.polizaNro && contractorData.polizaNro !== 'N/A' ? contractorData.polizaNro : null,
          fecha_aprobacion_poliza: parseDateForPg((contractorData as any).fechaPoliza),
          plazo_meses: (contractorData as any).plazoMeses ? Number((contractorData as any).plazoMeses) : null,
          fecha_inicio: parseDateForPg(contractorData.fechaInicio),
          fecha_terminacion: parseDateForPg(contractorData.fechaTerminacion),
          supervisor_nombre: contractorData.supervisorNombre || null,
          supervisor_documento: contractorData.supervisorDocumento || null,
          apoyo_supervision_nombre: contractorData.apoyoSupervisionNombre && contractorData.apoyoSupervisionNombre !== 'N/A' ? contractorData.apoyoSupervisionNombre : null,
          apoyo_supervision_documento: contractorData.apoyoSupervisionDocumento && contractorData.apoyoSupervisionDocumento !== 'N/A' ? contractorData.apoyoSupervisionDocumento : null,
          numero_cuenta: contractorData.numeroCuenta || null,
          banco: contractorData.banco || null,
          tipo_cuenta: contractorData.tipoCuenta || 'AHORRO',
          ciudad: contractorData.ciudad || null,
          vigencia: 2026,
        };

        if (existingContrato) {
          await supabase
            .from('contratos')
            .update(contratoPayload)
            .eq('id', existingContrato.id);
        } else {
          const { error: cErr } = await supabase
            .from('contratos')
            .insert([contratoPayload]);
          if (cErr) {
            console.warn('Contrato insert warning:', cErr.message);
          }
        }
      } catch (e) {
        console.warn('Notice creating initial contract:', e);
      }
    }

    // 3. Guardar credenciales para inicio de sesión si se definió contraseña
    if (pass) {
      this.saveUserPassword(rawEmail, pass);
      this.saveUserPassword(rawDoc, pass);
    }

    const newContractor: AuthUser = {
      ...contractorData,
      id: createdId,
      role: userRole,
      password: pass,
      nombreCompleto: fullName,
      email: rawEmail,
      documentoIdentidad: rawDoc,
      telefono: phone,
      cargo: cargo,
      secretariaId: secUuid || contractorData.secretariaId,
      createdAt: new Date().toISOString(),
    };

    newContractor.isSyncedToDb = isUuid(createdId);

    // 4. Persistir en localStorage como respaldo
    const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = storedUsers ? JSON.parse(storedUsers) : [];
    const filtered = customUsers.filter(u => u.documentoIdentidad !== rawDoc && u.email.toLowerCase() !== rawEmail.toLowerCase());
    filtered.push(newContractor);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(filtered));

    return { success: true, data: newContractor, error: dbErrorMsg };
  },

  // 5b. Sincronizar manualmente un Contratista con Supabase (Auth + Profiles + Contratos)
  async syncContractorToSupabase(
    contractor: AuthUser
  ): Promise<{ success: boolean; message: string; updatedUser?: AuthUser }> {
    const rawEmail = contractor.email.trim();
    const rawDoc = contractor.documentoIdentidad.trim().replace(/\./g, '');
    const pass = contractor.password?.trim() || this.getUserPassword(rawEmail) || this.getUserPassword(rawDoc) || 'Contratista2026*';
    const fullName = contractor.nombreCompleto.trim().toUpperCase();
    const phone = contractor.telefono?.trim() || '';
    const cargo = contractor.cargo?.trim() || 'Contratista de Prestación de Servicios';

    const secUuid = await this.resolveSecretariaUuid(contractor.secretariaId || contractor.secretariaCodigo || contractor.secretariaNombre);

    // 1. Verificar si ya existe en profiles por documento o email
    let existingProfile: any = null;
    try {
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .or(`documento_identidad.eq.${rawDoc},email.ilike.${rawEmail}`)
        .limit(1);
      if (profData && profData.length > 0) {
        existingProfile = profData[0];
      }
    } catch (e) {
      console.warn('Notice checking existing profile:', e);
    }

    let authUserId: string | null = existingProfile?.id || null;

    // 2. Si no existe en profiles, insertamos directamente
    const finalUserId = (authUserId && isUuid(authUserId)) ? authUserId : contractor.id || crypto.randomUUID();
    
    // 3. Insertar o actualizar en la tabla profiles
    const profilePayload: any = {
      id: finalUserId,
      role: 'contratista',
      nombre_completo: fullName,
      documento_identidad: rawDoc,
      email: rawEmail,
      telefono: phone,
      direccion: contractor.direccion || contractor.barrio || '',
      cargo: cargo,
      activo: true,
    };
    if (secUuid && isUuid(secUuid)) {
      profilePayload.secretaria_id = secUuid;
    }

    try {
      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert([profilePayload], { onConflict: 'id' });
      if (upsertErr) {
        console.warn('Profiles upsert notice during sync (might be missing FK in auth.users):', upsertErr.message);
      }
    } catch (e: any) {
      console.warn('Profiles catch during sync:', e);
    }

    // 4. Actualizar el contratista_id en la tabla contratos
    try {
      await supabase
        .from('contratos')
        .update({ contratista_id: finalUserId })
        .or(`contratista_id.eq.${contractor.id},contrato_nro.eq.${contractor.contratoNro || '015'}`);
    } catch (e) {
      console.warn('Contratos update notice during sync:', e);
    }

    // 5. Actualizar en localStorage
    const updatedContractor: AuthUser = {
      ...contractor,
      id: finalUserId,
      isSyncedToDb: true,
    };

    try {
      const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
      if (storedUsers) {
        const customUsers: AuthUser[] = JSON.parse(storedUsers);
        const updatedList = customUsers.map(u => {
          if (u.documentoIdentidad === rawDoc || u.email.toLowerCase() === rawEmail.toLowerCase() || u.id === contractor.id) {
            return updatedContractor;
          }
          return u;
        });
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updatedList));
      }
    } catch (e) {}

    this.saveUserPassword(rawEmail, pass);
    this.saveUserPassword(rawDoc, pass);

    return {
      success: true,
      message: `¡Contratista ${fullName} sincronizado exitosamente con la base de datos de Supabase!`,
      updatedUser: updatedContractor,
    };
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
      if (updateData.role) profileUpdatePayload.role = updateData.role;
      if (updateData.direccion !== undefined || updateData.barrio !== undefined) {
        profileUpdatePayload.direccion = updateData.direccion || updateData.barrio || '';
      }
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
      if (updateData.numeroCuenta) contractUpdatePayload.numero_cuenta = updateData.numeroCuenta;
      if (updateData.banco) contractUpdatePayload.banco = updateData.banco;
      if (updateData.tipoCuenta) contractUpdatePayload.tipo_cuenta = updateData.tipoCuenta;
      if (updateData.ciudad) contractUpdatePayload.ciudad = updateData.ciudad;

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
          direccion: updateData.direccion !== undefined ? updateData.direccion : (u.direccion || u.barrio || ''),
          barrio: updateData.direccion !== undefined ? updateData.direccion : (u.barrio || u.direccion || ''),
          password: pass || u.password,
        };
        return updatedUser;
      }
      return u;
    });

    if (!updatedUser) {
      updatedUser = {
        id: contractorId,
        email: rawEmail || '',
        nombreCompleto: fullName || '',
        documentoIdentidad: rawDoc || '',
        role: 'contratista',
        telefono: phone,
        cargo: cargo,
        direccion: updateData.direccion || updateData.barrio || '',
        barrio: updateData.barrio || updateData.direccion || '',
        ...updateData,
      };
    }

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
    let usersFromDb: AuthUser[] = [];
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
        usersFromDb = data.map((row: any) => {
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
            barrio: row.direccion || row.barrio || '',
            direccion: row.direccion || row.barrio || '',
            createdAt: row.created_at || new Date().toISOString(),
          };
        });
      }
    } catch (err) {
      console.warn('Error fetching all users from Supabase:', err);
    }

    // SIEMPRE combinar usuarios de DB con SYSTEM_CORE_USERS y localStorage
    const map = new Map<string, AuthUser>();
    SYSTEM_CORE_USERS.forEach(u => {
      const key = (u.email ? u.email.toLowerCase() : u.documentoIdentidad).replace(/\./g, '').trim();
      if (key) map.set(key, u);
    });

    usersFromDb.forEach(u => {
      const key = (u.email ? u.email.toLowerCase() : u.documentoIdentidad).replace(/\./g, '').trim();
      if (key) map.set(key, u);
    });

    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    const customUsers: AuthUser[] = stored ? JSON.parse(stored) : [];
    customUsers.forEach(u => {
      const key = (u.email ? u.email.toLowerCase() : u.documentoIdentidad).replace(/\./g, '').trim();
      if (key) {
        const existing = map.get(key);
        map.set(key, existing ? { ...existing, ...u } : u);
      }
    });

    return Array.from(map.values());
  },

  // Helper: Obtener Perfil de Usuario Completo por ID, Documento o Email
  async getUserProfile(identifier: string): Promise<AuthUser | null> {
    if (!identifier) return null;
    const cleanId = identifier.trim().replace(/\./g, '');
    try {
      let { data } = await supabase
        .from('profiles')
        .select('*, sec_secretarias(*), contratos(*)')
        .or(`id.eq.${cleanId},documento_identidad.eq.${cleanId},email.ilike.${cleanId}`)
        .limit(1);

      if (data && data.length > 0) {
        const row = data[0];
        const cont = Array.isArray(row.contratos) ? row.contratos[0] : row.contratos;
        let dirVal = row.direccion || row.barrio || '';

        // Fallback: Si no tiene dirección en perfil, intentar buscar en sus informes
        let valMensual = '';
        if (cont?.id) {
          try {
            const { data: latestReport } = await supabase
              .from('informes_mensuales')
              .select('observaciones')
              .eq('contrato_id', cont.id)
              .order('informe_nro', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestReport?.observaciones) {
              const { valorMensualText } = parseObservacionesAndComments(latestReport.observaciones);
              if (valorMensualText) {
                valMensual = valorMensualText;
              }
            }
          } catch (e) {
            console.warn('Error fetching latest report inside getUserProfile:', e);
          }
        }

        if (!dirVal && row.documento_identidad) {
          try {
            const { data: infData } = await supabase
              .from('informes_mensuales')
              .select('payload')
              .limit(10);
            if (infData) {
              for (const item of infData) {
                const p = item.payload;
                if (p && (p.contratistaDocumento === row.documento_identidad || p.contratistaDocumento === cleanId)) {
                  if (p.direccion || p.barrio || p.contratistaDireccion) {
                    dirVal = p.direccion || p.barrio || p.contratistaDireccion;
                    break;
                  }
                }
              }
            }
          } catch (e) {}
        }

        return {
          id: row.id,
          email: row.email || '',
          nombreCompleto: row.nombre_completo || '',
          documentoIdentidad: row.documento_identidad || '',
          role: row.role || 'contratista',
          secretariaId: row.secretaria_id || '',
          secretariaNombre: row.sec_secretarias?.nombre || '',
          secretariaCodigo: row.sec_secretarias?.codigo || '',
          cargo: row.cargo || '',
          telefono: row.telefono || '',
          barrio: dirVal,
          direccion: dirVal,
          contratoNro: cont?.contrato_nro || '',
          objetoContrato: cont?.objeto || '',
          valorContrato: cont?.valor_contrato ? formatColombianCurrency(cont.valor_contrato) : '',
          valorMensual: valMensual || '',
          cdpNro: cont?.cdp_nro || '',
          crpNro: cont?.crp_nro || '',
          polizaNro: cont?.poliza_nro || '',
          fechaPoliza: cont?.fecha_aprobacion_poliza ? formatDateSlash(cont.fecha_aprobacion_poliza) : '',
          plazo: cont?.plazo_meses ? `${cont.plazo_meses} meses` : '',
          fechaInicio: cont?.fecha_inicio ? formatDateSlash(cont.fecha_inicio) : '',
          fechaTerminacion: cont?.fecha_terminacion ? formatDateSlash(cont.fecha_terminacion) : '',
          numeroCuenta: cont?.numero_cuenta || '',
          banco: cont?.banco || '',
          tipoCuenta: cont?.tipo_cuenta || '',
          ciudad: cont?.ciudad || '',
          ciudadCuenta: cont?.ciudad || '',
          supervisorNombre: cont?.supervisor_nombre || '',
          supervisorDocumento: cont?.supervisor_documento || '',
        };
      }
    } catch (err) {
      console.warn('Error fetching user profile:', err);
    }
    return null;
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
      const contratoNro = extractContratoNroOnly(report.contratoNro) || extractContratoNroOnly(user?.contratoNro) || '590';

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
        numero_cuenta: report.numeroCuenta || user?.numeroCuenta || '53686186829',
        banco: report.banco || user?.banco || 'BANCOLOMBIA',
        tipo_cuenta: report.tipoCuenta || user?.tipoCuenta || 'AHORRO',
        ciudad: report.ciudad || report.ciudadCuenta || user?.ciudad || 'CHOCÓ',
        vigencia: 2026
      };

      // Actualizar la dirección en la tabla profiles si viene especificada
      const dirVal = report.direccion || report.barrio || report.contratistaDireccion || user?.direccion || user?.barrio;
      if (validContratistaId && dirVal) {
        await supabase.from('profiles').update({ direccion: dirVal }).eq('id', validContratistaId);
      }

      // 3. Buscar si ya existe contrato exclusivamente para este contratista_id y sincronizar cambios
      if (validContratistaId) {
        const { data: existingContract } = await supabase
          .from('contratos')
          .select('id')
          .eq('contratista_id', validContratistaId)
          .order('created_at', { ascending: false })
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

      // Si no existe contrato para este contratista_id, insertar un nuevo contrato independiente
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
              documento_identidad,
              direccion
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
          let dbComments = (row.comentarios_campos && typeof row.comentarios_campos === 'object' && Object.keys(row.comentarios_campos).length > 0)
            ? row.comentarios_campos
            : ((obsComments && typeof obsComments === 'object' && Object.keys(obsComments).length > 0) ? obsComments : null);
          if (typeof dbComments === 'string') {
            try { dbComments = JSON.parse(dbComments); } catch (e) {}
          }
          const doc = row.contratos?.profiles?.documento_identidad;
          const infNro = row.informe_nro ? String(row.informe_nro) : '1';
          const storedComm = getStoredComments(doc, infNro);
          const comments = (dbComments && typeof dbComments === 'object' && Object.keys(dbComments).length > 0) 
            ? dbComments 
            : ((storedComm && typeof storedComm === 'object' && Object.keys(storedComm).length > 0) ? storedComm : (obsComments || {}));
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
            comentariosCampos: comments,
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
              telefono,
              direccion
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

        const { cleanObs, comments: obsComments, valorPagarText, plazoText, valorMensualText } = parseObservacionesAndComments(row.observaciones);
        let dbComments = (row.comentarios_campos && typeof row.comentarios_campos === 'object' && Object.keys(row.comentarios_campos).length > 0)
          ? row.comentarios_campos
          : ((obsComments && typeof obsComments === 'object' && Object.keys(obsComments).length > 0) ? obsComments : null);
        if (typeof dbComments === 'string') {
          try { dbComments = JSON.parse(dbComments); } catch (e) {}
        }
        const docIdentidad = row.contratos?.profiles?.documento_identidad || '';
        const infNumStr = String(row.informe_nro || '1');
        const storedComm = getStoredComments(docIdentidad, infNumStr);
        const finalComments = (dbComments && typeof dbComments === 'object' && Object.keys(dbComments).length > 0)
          ? dbComments
          : ((storedComm && typeof storedComm === 'object' && Object.keys(storedComm).length > 0) ? storedComm : (obsComments || {}));
        const hasComm = Object.keys(finalComments).length > 0;
        const finalState = mapStatusFromDb(row.estado, hasComm);

        const storedData = getStoredReportData(docIdentidad, infNumStr);
        const { obsWithFotos, allAnexos } = associateFotosToObligaciones(obs, anx, storedData?.obligaciones);

        const numCert = row.valor_pagar_certificado ? Number(row.valor_pagar_certificado) : 0;
        let finalValorPagar = '';
        if (numCert > 0) {
          const rawLetters = valorPagarText ? valorPagarText.replace(/\([^)]*\)/g, '').replace(/\$\s*[\d.,]+/g, '').trim() : '';
          const finalLetters = (rawLetters && rawLetters.length > 5 && /[a-zA-Z]/.test(rawLetters)) 
            ? (rawLetters.toUpperCase().includes('PESOS') ? rawLetters.toUpperCase() : `${rawLetters.toUpperCase()} PESOS M/CTE`)
            : convertirNumeroALetras(numCert);
          finalValorPagar = `${finalLetters} ($${numCert.toLocaleString('es-CO')})`;
        } else if (valorPagarText) {
          finalValorPagar = valorPagarText;
        } else if (storedData?.valorPagar) {
          finalValorPagar = storedData.valorPagar;
        } else {
          finalValorPagar = '$ 2.160.000';
        }

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
          valorMensual: valorMensualText || storedData?.valorMensual || '',
          valorAdicion: formatValorAdicion(row.valor_adicion),
          contratoNro: row.contratos?.contrato_nro || '015',
          objeto: row.contratos?.objeto || '',
          cdpNro: row.contratos?.cdp_nro || '137',
          crpNro: row.contratos?.crp_nro || '191',
          polizaNro: row.contratos?.poliza_nro || 'N/A',
          fechaPoliza: formatDateSlash(row.contratos?.fecha_aprobacion_poliza || 'N/A'),
          plazo: formatPlazoLetraYNumero(plazoText || storedData?.plazo || (row.contratos?.plazo_meses ? `${row.contratos.plazo_meses} MESES` : 'SEIS(6) MESES')),
          fechaInicio: formatDateSlash(row.contratos?.fecha_inicio || '15/01/2026'),
          fechaTerminacion: formatDateSlash(row.contratos?.fecha_terminacion || '14/07/2026'),
          modificaciones: row.modificaciones_contrato || 'N/A',
          observaciones: cleanObs,
          obligaciones: obsWithFotos,
          anexos: allAnexos,
          valorPagar: finalValorPagar,
          estado: finalState,
          comentariosCampos: finalComments,
          numeroCuenta: storedData?.numeroCuenta || (row.contratos as any)?.numero_cuenta || '53686186829',
          banco: storedData?.banco || (row.contratos as any)?.banco || 'BANCOLOMBIA',
          tipoCuenta: storedData?.tipoCuenta || (row.contratos as any)?.tipo_cuenta || 'AHORRO',
          ciudad: storedData?.ciudad || storedData?.ciudadCuenta || (row.contratos as any)?.ciudad || 'CHOCÓ',
          ciudadCuenta: storedData?.ciudadCuenta || storedData?.ciudad || (row.contratos as any)?.ciudad || 'CHOCÓ',
          barrio: (row.contratos?.profiles as any)?.direccion || (row.contratos?.profiles as any)?.barrio || storedData?.barrio || storedData?.direccion || '',
          direccion: (row.contratos?.profiles as any)?.direccion || (row.contratos?.profiles as any)?.barrio || storedData?.direccion || storedData?.barrio || '',
          contratistaDireccion: (row.contratos?.profiles as any)?.direccion || (row.contratos?.profiles as any)?.barrio || storedData?.contratistaDireccion || storedData?.barrio || storedData?.direccion || '',
          fechaRegistroPresupuestal: storedData?.fechaRegistroPresupuestal ? formatDateSlash(storedData.fechaRegistroPresupuestal) : '14/01/2026',
          codigoRubro: storedData?.codigoRubro || '2.3.2.02.02.008.04.01.02',
          syncedToDb: true,
        };
      }
    } catch (err) {
      console.warn('Error in getReportById from Supabase:', err);
    }
    return null;
  },

  // 8.2. Cargar Informes Específicos de un Contratista con sus Obligaciones y Fotos de Supabase
  async getContractorReports(contractorDocument?: string, contractorId?: string): Promise<ReportData[] | null> {
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
              telefono,
              direccion
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

            const { cleanObs, comments: obsComments, valorPagarText, plazoText, valorMensualText } = parseObservacionesAndComments(row.observaciones);
            let dbComments = (row.comentarios_campos && typeof row.comentarios_campos === 'object' && Object.keys(row.comentarios_campos).length > 0)
              ? row.comentarios_campos
              : ((obsComments && typeof obsComments === 'object' && Object.keys(obsComments).length > 0) ? obsComments : null);
            if (typeof dbComments === 'string') {
              try { dbComments = JSON.parse(dbComments); } catch (e) {}
            }
            const docIdentidad = row.contratos?.profiles?.documento_identidad || contractorDocument || '';
            const infNumStr = String(row.informe_nro || '1');
            const storedComm = getStoredComments(docIdentidad, infNumStr);
            const finalComments = row.estado === 'Borrador' ? {} : (
              (dbComments && typeof dbComments === 'object' && Object.keys(dbComments).length > 0)
                ? dbComments
                : ((storedComm && typeof storedComm === 'object' && Object.keys(storedComm).length > 0) ? storedComm : (obsComments || {}))
            );
            const hasComm = Object.keys(finalComments).length > 0;
            const finalState = mapStatusFromDb(row.estado, hasComm);

            const storedData = getStoredReportData(docIdentidad, infNumStr);
            const { obsWithFotos, allAnexos } = associateFotosToObligaciones(obs, anx, storedData?.obligaciones);

            const numCert = row.valor_pagar_certificado ? Number(row.valor_pagar_certificado) : 0;
            let finalValorPagar = '';
            if (numCert > 0) {
              const rawLetters = valorPagarText ? valorPagarText.replace(/\([^)]*\)/g, '').replace(/\$\s*[\d.,]+/g, '').trim() : '';
              const finalLetters = (rawLetters && rawLetters.length > 5 && /[a-zA-Z]/.test(rawLetters)) 
                ? (rawLetters.toUpperCase().includes('PESOS') ? rawLetters.toUpperCase() : `${rawLetters.toUpperCase()} PESOS M/CTE`)
                : convertirNumeroALetras(numCert);
              finalValorPagar = `${finalLetters} ($${numCert.toLocaleString('es-CO')})`;
            } else if (valorPagarText) {
              finalValorPagar = valorPagarText;
            } else if (storedData?.valorPagar) {
              finalValorPagar = storedData.valorPagar;
            } else {
              finalValorPagar = '$ 2.160.000';
            }

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
              valorMensual: valorMensualText || storedData?.valorMensual || '',
              valorAdicion: formatValorAdicion(row.valor_adicion),
              contratoNro: row.contratos?.contrato_nro || '015',
              objeto: row.contratos?.objeto || '',
              cdpNro: row.contratos?.cdp_nro || '137',
              crpNro: row.contratos?.crp_nro || '191',
              polizaNro: row.contratos?.poliza_nro || 'N/A',
              fechaPoliza: formatDateSlash(row.contratos?.fecha_aprobacion_poliza || 'N/A'),
              plazo: formatPlazoLetraYNumero(plazoText || storedData?.plazo || (row.contratos?.plazo_meses ? `${row.contratos.plazo_meses} MESES` : 'SEIS(6) MESES')),
              fechaInicio: formatDateSlash(row.contratos?.fecha_inicio || '15/01/2026'),
              fechaTerminacion: formatDateSlash(row.contratos?.fecha_terminacion || '14/07/2026'),
              modificaciones: row.modificaciones_contrato || 'N/A',
              observaciones: cleanObs,
              rawObservacionesDb: row.observaciones || '',
              obligaciones: obsWithFotos,
              anexos: allAnexos,
              valorPagar: finalValorPagar,
              valorPagarCertificado: row.valor_pagar_certificado || (numCert ? String(numCert) : ''),
              estado: finalState,
              comentariosCampos: finalComments,
              numeroCuenta: storedData?.numeroCuenta || (row.contratos as any)?.numero_cuenta || '53686186829',
              banco: storedData?.banco || (row.contratos as any)?.banco || 'BANCOLOMBIA',
              tipoCuenta: storedData?.tipoCuenta || (row.contratos as any)?.tipo_cuenta || 'AHORRO',
              ciudad: storedData?.ciudad || storedData?.ciudadCuenta || (row.contratos as any)?.ciudad || 'CHOCÓ',
              ciudadCuenta: storedData?.ciudadCuenta || storedData?.ciudad || (row.contratos as any)?.ciudad || 'CHOCÓ',
              barrio: (row.contratos?.profiles as any)?.direccion || (row.contratos?.profiles as any)?.barrio || storedData?.barrio || storedData?.direccion || '',
              direccion: (row.contratos?.profiles as any)?.direccion || (row.contratos?.profiles as any)?.barrio || storedData?.direccion || storedData?.barrio || '',
              contratistaDireccion: (row.contratos?.profiles as any)?.direccion || (row.contratos?.profiles as any)?.barrio || storedData?.contratistaDireccion || storedData?.barrio || storedData?.direccion || '',
              fechaRegistroPresupuestal: storedData?.fechaRegistroPresupuestal ? formatDateSlash(storedData.fechaRegistroPresupuestal) : '14/01/2026',
              codigoRubro: storedData?.codigoRubro || '2.3.2.02.02.008.04.01.02',
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
      return null;
    }

    return [];
  },

  // 9. Guardar / Sincronizar Informe Completo a Supabase (Garantizando Contrato, Obligaciones y Fotos)
  async saveFullInforme(report: ReportData, user?: AuthUser): Promise<{ success: boolean; id?: string; error?: string; obligaciones?: Obligacion[]; anexos?: Anexo[] }> {
    try {
      // 1. Asegurar Contrato ID válido y sincronizar fechas del contrato
      let contratoId = report.contratoId;
      if (!contratoId || !isUuid(contratoId)) {
        contratoId = (await this.ensureContrato(report, user)) || undefined;
      } else {
        // Actualizar datos del contrato existente (fechas de inicio y terminación, etc.)
        const parsePlazoToMeses = (plazoStr?: string): number => {
          if (!plazoStr) return 6;
          const parsed = parsePlazoComponents(plazoStr);
          return parsed.meses || 6;
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

        const cleanContractNroVal = extractContratoNroOnly(report.contratoNro);
        try {
          await supabase.from('contratos').update({
            ...(cleanContractNroVal ? { contrato_nro: cleanContractNroVal } : {}),
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
            numero_cuenta: report.numeroCuenta || '53686186829',
            banco: report.banco || 'BANCOLOMBIA',
            tipo_cuenta: report.tipoCuenta || 'AHORRO',
            ciudad: report.ciudad || report.ciudadCuenta || 'CHOCÓ',
          }).eq('id', contratoId);

          const dirVal = report.direccion || report.barrio || report.contratistaDireccion;
          const contractorDoc = report.contratistaDocumento || user?.documentoIdentidad;
          if (dirVal && contractorDoc) {
            await supabase.from('profiles').update({ direccion: dirVal }).eq('documento_identidad', contractorDoc);
          }
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
      const fullObsPayload = buildObservacionesWithComments(cleanObsText, report.comentariosCampos, report.valorPagar, report.plazo, report.valorMensual);

      const parsedValorPagar = limpiarNumeroMoneda(report.valorPagar) || 3338300;

      const informePayload: any = {
        informe_nro: parseInt(report.informeNro, 10) || 1,
        tipo_informe: report.tipoInforme || 'Mensual',
        fecha_presentacion: parseDateForPg(report.fechaPresentacion || report.periodoHasta, new Date().toISOString().split('T')[0]),
        periodo_desde: parseDateForPg(report.periodoDesde, '2026-07-01'),
        periodo_hasta: parseDateForPg(report.periodoHasta, '2026-07-31'),
        valor_adicion: limpiarNumeroMoneda(report.valorAdicion),
        valor_pagar_certificado: parsedValorPagar,
        modificaciones_contrato: report.modificaciones || 'N/A',
        observaciones: fullObsPayload,
        estado: mapStatusToDb(report.estado || 'Enviado'),
      };

      if (report.comentariosCampos && typeof localStorage !== 'undefined') {
        if (contractorDoc) {
          localStorage.setItem(`informe_comentarios_${contractorDoc}_${report.informeNro}`, JSON.stringify(report.comentariosCampos));
          localStorage.setItem(`informe_comments_${contractorDoc}_${report.informeNro}`, JSON.stringify(report.comentariosCampos));
        } else {
          localStorage.setItem(`informe_comentarios_${report.informeNro}`, JSON.stringify(report.comentariosCampos));
          localStorage.setItem(`informe_comments_${report.informeNro}`, JSON.stringify(report.comentariosCampos));
        }
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

          const rawTitle = foto.titulo || `Evidencia ${processedObsFotos.length + 1}`;
          const hasObligacionTag = rawTitle.toLowerCase().includes('obligación') || rawTitle.toLowerCase().includes('obligacion');
          const finalTitle = hasObligacionTag ? rawTitle : `Obligación #${obsIdx + 1} - ${rawTitle}`;

          const processedFoto: Anexo = {
            id: foto.id,
            titulo: finalTitle,
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
          // Si el anexo está marcado como perteneciente a una obligación o tiene un título de obligación, omitir para evitar duplicados o fotos huérfanas
          const isObligacionPhoto = anexo.obligacionId || 
                                    (anexo.obligacionIndex !== undefined && anexo.obligacionIndex > 0) ||
                                    (anexo.titulo || '').toLowerCase().startsWith('obligación #') ||
                                    (anexo.titulo || '').toLowerCase().startsWith('obligacion #');
          if (isObligacionPhoto) {
            continue;
          }

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

      if (typeof localStorage !== 'undefined') {
        if (contractorDoc) {
          localStorage.setItem(`alcaldia_quibdo_report_${contractorDoc}_${report.informeNro}`, JSON.stringify(updatedReportWithDb));
        } else {
          localStorage.setItem(`alcaldia_quibdo_report_${report.informeNro}`, JSON.stringify(updatedReportWithDb));
        }
      }

      // Sincronizar automáticamente Certificado de Supervisión, Soporte Fiduciaria y Autorización de Desembolso en Supabase
      try {
        const certDataToSync = createDefaultCertificadoData(updatedReportWithDb);
        // Excluir saldo_por_pagar y porcentaje_ejecucion al guardar o guardar cambios del informe mensual
        await this.saveCertificadoSupervision(certDataToSync, informeId, undefined, contratoId, { excludeLiquidacion: true });

        const fidDataToSync = createDefaultFiduciariaData(updatedReportWithDb);
        await this.saveSoporteFiduciaria(informeId, fidDataToSync, contractorDoc, String(report.informeNro || '1'), contratoId);

        const desembolsoDataToSync = createDefaultAutorizacionDesembolsoData(updatedReportWithDb);
        await this.saveAutorizacionDesembolso(informeId, desembolsoDataToSync, contractorDoc, String(report.informeNro || '1'), contratoId);
      } catch (certSyncErr) {
        console.warn('Error syncing certificados/soportes in saveFullInforme:', certSyncErr);
      }

      return { 
        success: true, 
        id: informeId || `local-${Date.now()}`,
        obligaciones: processedObligaciones,
        anexos: processedAnexos
      };
    } catch (err: any) {
      console.error('Error saving to Supabase:', err);
      return { success: false, error: err?.message || 'Error de conexión' };
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
    const allCommentsList = Object.values(comments || {});
    const pendingComments = allCommentsList.filter(c => !c.corregido);
    const pendingMain = pendingComments.filter(isMainReportComment);
    const fixedComments = allCommentsList.filter(c => Boolean(c.corregido));

    // Si solo hay observaciones en certificados (2 al 5) y ninguna en el informe principal (1),
    // se mantiene el estado del informe principal como 'Enviado' para evitar marcarlo como Devuelto en el dashboard.
    let statusToSave = newStatus;
    if (newStatus === 'Devuelto' && pendingMain.length === 0 && pendingComments.length > 0) {
      statusToSave = 'Enviado';
    }

    // Marcar como leídas las notificaciones de radicado de este informe para el supervisor
    this.marcarNotificacionesRadicadasComoLeidas(informeNro, reportId).catch(err => console.warn('Error marking radicado notifs as read:', err));

    try {
      if (isUuid(reportId)) {
        const { data: currentReport } = await supabase
          .from('informes_mensuales')
          .select('observaciones, estado')
          .eq('id', reportId)
          .maybeSingle();

        if (currentReport?.estado === 'Aprobado' || currentReport?.estado === 'aprobado' || newStatus === 'Aprobado') {
          statusToSave = 'Aprobado';
        } else if (newStatus === 'Devuelto' && pendingMain.length === 0 && pendingComments.length > 0) {
          statusToSave = 'Enviado';
        }

        const { cleanObs, valorPagarText, plazoText, valorMensualText } = parseObservacionesAndComments(currentReport?.observaciones);
        const newObsWithComments = buildObservacionesWithComments(cleanObs, comments, valorPagarText, plazoText, valorMensualText);

        const updatePayload: any = { 
          observaciones: newObsWithComments,
          estado: mapStatusToDb(statusToSave) 
        };

        try {
          updatePayload.comentarios_campos = comments;
        } catch (e) {}

        const { error: updErr } = await supabase
          .from('informes_mensuales')
          .update(updatePayload)
          .eq('id', reportId);

        if (updErr) {
          await supabase
            .from('informes_mensuales')
            .update({ 
              observaciones: newObsWithComments,
              estado: mapStatusToDb(statusToSave) 
            })
            .eq('id', reportId);
        }
      }
    } catch (e) {
      console.warn('Error saving comments to Supabase:', e);
    }

    // Guardar respaldo inmediato en LocalStorage
    if (typeof localStorage !== 'undefined') {
      const docKey = contractorDoc ? `_${contractorDoc}` : '';
      if (contractorDoc) {
        localStorage.setItem(`informe_comments_${contractorDoc}_${informeNro}`, JSON.stringify(comments));
        localStorage.setItem(`informe_comentarios_${contractorDoc}_${informeNro}`, JSON.stringify(comments));
      } else {
        localStorage.setItem(`informe_comments_${informeNro}`, JSON.stringify(comments));
        localStorage.setItem(`informe_comentarios_${informeNro}`, JSON.stringify(comments));
      }

      const localKey = `informe_data${docKey}_${informeNro}`;
      const saved = localStorage.getItem(localKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.comentariosCampos = comments;
          parsed.estado = statusToSave;
          localStorage.setItem(localKey, JSON.stringify(parsed));
        } catch (e) {}
      } else if (!contractorDoc) {
        const globalSaved = localStorage.getItem(`informe_data_${informeNro}`);
        if (globalSaved) {
          try {
            const parsed = JSON.parse(globalSaved);
            parsed.comentariosCampos = comments;
            parsed.estado = statusToSave;
            localStorage.setItem(`informe_data_${informeNro}`, JSON.stringify(parsed));
          } catch (e) {}
        }
      }
    }

    // 1. Notificación para el Contratista si hay observaciones pendientes
    if (contractorDoc && (newStatus === 'Devuelto' || pendingComments.length > 0)) {
      const docNamesSet = new Set<string>();
      pendingComments.forEach(c => {
        const fn = (c.nombreCampo || c.fieldName || '').toLowerCase();
        const fid = (c.campoId || '').toLowerCase();
        if (fid === 'certificado_supervision' || fn.includes('certificado de supervisión')) docNamesSet.add('Certificado de Supervisión');
        else if (fid === 'soporte_fiduciaria' || fn.includes('fiduciaria') || fn.includes('pagos')) docNamesSet.add('Soporte Fiduciaria / Pagos');
        else if (fid === 'declaracion_juramento' || fn.includes('declaración') || fn.includes('juramento')) docNamesSet.add('Declaración Bajo Juramento');
        else if (fid === 'autorizacion_desembolso' || fn.includes('desembolso')) docNamesSet.add('Autorización de Desembolso');
        else docNamesSet.add('Informe Mensual');
      });

      const docNames = Array.from(docNamesSet).join(', ') || 'Informe Mensual';
      const bulletPoints = pendingComments.map((c, i) => `· ${c.nombreCampo || c.campoId || `Campo ${i + 1}`}: ${c.comentario}`).join('\n');
      
      const titulo = `⚠️ Observación en ${docNames} (Informe #${informeNro})`;
      const mensaje = `La supervisión ha registrado observaciones en ${docNames} del Informe #${informeNro}:\n\n${bulletPoints}\n\nPor favor ingrese a la plataforma, corrija las casillas resaltadas en amarillo y presione "Radicar / Reenviar Informe".`;

      this.crearNotificacion({
        user_id: contractorDoc,
        titulo,
        mensaje,
        tipo: 'devolucion',
        leida: false,
        informe_nro: informeNro,
        report_id: isUuid(reportId) ? reportId : undefined
      }).catch(err => console.warn('Error creating contractor notification:', err));
    } else if (contractorDoc && pendingComments.length === 0) {
      // Si ya no quedan observaciones pendientes, marcar como leídas/resueltas las notificaciones de devolución previas
      this.marcarNotificacionesInformeResueltas(contractorDoc, informeNro, reportId).catch(err => console.warn('Error resolving notifications:', err));
    }

    // 2. Notificación para la Supervisora si el contratista marcó observaciones como SUBSANADAS
    if (fixedComments.length > 0) {
      const fixedDocsSet = new Set<string>();
      fixedComments.forEach(c => {
        const fn = (c.nombreCampo || c.fieldName || '').toLowerCase();
        const fid = (c.campoId || '').toLowerCase();
        if (fid === 'certificado_supervision' || fn.includes('certificado de supervisión')) fixedDocsSet.add('Certificado de Supervisión');
        else if (fid === 'soporte_fiduciaria' || fn.includes('fiduciaria') || fn.includes('pagos')) fixedDocsSet.add('Soporte Fiduciaria');
        else if (fid === 'declaracion_juramento' || fn.includes('declaración') || fn.includes('juramento')) fixedDocsSet.add('Declaración Bajo Juramento');
        else if (fid === 'autorizacion_desembolso' || fn.includes('desembolso')) fixedDocsSet.add('Autorización de Desembolso');
        else fixedDocsSet.add('Informe Mensual');
      });

      const fixedNames = Array.from(fixedDocsSet).join(', ') || 'Documento';
      const titulo = `🟢 Subsanación Realizada en ${fixedNames} (Informe #${informeNro})`;
      const mensaje = `El contratista ha corregido y marcado como subsanada la observación en ${fixedNames} del Informe #${informeNro}. Por favor ingrese a validar.`;

      this.crearNotificacion({
        user_id: 'supervisor',
        titulo,
        mensaje,
        tipo: 'devolucion',
        leida: false,
        informe_nro: informeNro,
        report_id: isUuid(reportId) ? reportId : undefined
      }).catch(err => console.warn('Error creating supervisor notification:', err));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
      window.dispatchEvent(new CustomEvent('informe_comments_updated'));
    }

    return true;
  },

  // 10. Eliminar Informe Completo (En Supabase, Almacenamiento de Fotos, Certificaciones, Documentos Asociados y Notificaciones)
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

      // Helper para limpiar tablas asociadas a un ID de informe
      const purgeInformeTables = async (id: string) => {
        // Consultar fotos asociadas en la tabla informe_anexos y borrarlas del Storage
        const { data: dbAnexos } = await supabase
          .from('informe_anexos')
          .select('imagen_url')
          .eq('informe_id', id);

        if (dbAnexos && dbAnexos.length > 0) {
          for (const anx of dbAnexos) {
            if (anx.imagen_url) {
              await this.deleteImageFromStorage(anx.imagen_url);
            }
          }
        }

        // Eliminar registros hijos y vinculados
        await supabase.from('informe_obligaciones').delete().eq('informe_id', id);
        await supabase.from('informe_anexos').delete().eq('informe_id', id);
        await supabase.from('certificaciones_supervision').delete().eq('informe_id', id);
        await supabase.from('soportes_fiduciaria').delete().eq('informe_id', id);
        await supabase.from('declaraciones_renta').delete().eq('informe_id', id);
        await supabase.from('autorizaciones_desembolso').delete().eq('informe_id', id);
        await supabase.from('notificaciones').delete().eq('report_id', id);
        await supabase.from('informes_mensuales').delete().eq('id', id);
      };

      // 2. Eliminar de Supabase por reportId UUID
      if (reportId && isUuid(reportId)) {
        await purgeInformeTables(reportId);
        await supabase.from('notificaciones').delete().eq('report_id', reportId);
      }

      // 3. Eliminar por número de informe y documento del contratista (con aislamiento estricto)
      if (informeNro && contractorDoc) {
        // Encontrar contratos que pertenecen exclusivamente a este contratista
        const { data: userContracts } = await supabase
          .from('contratos')
          .select('id, profiles!inner(documento_identidad)')
          .eq('profiles.documento_identidad', contractorDoc);

        const contractIds = (userContracts || []).map((c: any) => c.id).filter(Boolean);
        if (contractIds.length > 0) {
          const { data: duplicates } = await supabase
            .from('informes_mensuales')
            .select('id')
            .in('contrato_id', contractIds)
            .eq('informe_nro', parseInt(informeNro, 10) || 1);

          if (duplicates && duplicates.length > 0) {
            for (const dup of duplicates) {
              await purgeInformeTables(dup.id);
            }
          }
        }

        // Limpiar registros sueltos o vinculados por documento y número de pago/informe
        await supabase.from('certificaciones_supervision').delete().eq('contratista_documento', contractorDoc).eq('informe_nro', informeNro);
        await supabase.from('soportes_fiduciaria').delete().eq('contratista_documento', contractorDoc).eq('pago_nro', informeNro);
        await supabase.from('declaraciones_renta').delete().eq('contratista_documento', contractorDoc).eq('pago_nro', informeNro);
        await supabase.from('autorizaciones_desembolso').delete().eq('contratista_documento', contractorDoc).eq('pago_nro', informeNro);
        
        // Limpiar notificaciones de contratista y supervisión vinculadas a este informe
        await supabase.from('notificaciones').delete().eq('user_id', contractorDoc).eq('informe_nro', informeNro);
        await supabase.from('notificaciones').delete().eq('user_id', 'supervisor').eq('informe_nro', informeNro);

        // Limpiar completamente las memorias y cachés de LocalStorage para este contratista e informe
        if (typeof localStorage !== 'undefined') {
          const cleanDoc = contractorDoc.replace(/[^0-9]/g, '');
          
          // Escanear y remover cualquier llave en localStorage que pertenezca a este número de informe y documento
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              const lowerKey = key.toLowerCase();
              const isTargetReportKey = key.endsWith(`_${informeNro}`) || lowerKey.includes(`_${informeNro}_`) || lowerKey.includes(`_${informeNro}`);
              const containsContractor = lowerKey.includes(contractorDoc.toLowerCase()) || (cleanDoc && lowerKey.includes(cleanDoc.toLowerCase()));
              
              if (isTargetReportKey && containsContractor) {
                keysToRemove.push(key);
              }
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));

          const keysToDelete = [
            `alcaldia_quibdo_report_${contractorDoc}_${informeNro}`,
            `alcaldia_quibdo_report_${cleanDoc}_${informeNro}`,
            `alcaldia_quibdo_report_${informeNro}`,
            `informe_data_${contractorDoc}_${informeNro}`,
            `informe_data_${cleanDoc}_${informeNro}`,
            `informe_data_${informeNro}`,
            `cert_data_${contractorDoc}_${informeNro}`,
            `cert_data_${cleanDoc}_${informeNro}`,
            `cert_data_${informeNro}`,
            `fid_data_${contractorDoc}_${informeNro}`,
            `fid_data_${cleanDoc}_${informeNro}`,
            `fid_data_${informeNro}`,
            `dec_renta_${contractorDoc}_${informeNro}`,
            `dec_renta_${cleanDoc}_${informeNro}`,
            `desembolso_${contractorDoc}_${informeNro}`,
            `desembolso_${cleanDoc}_${informeNro}`,
            `desembolso_${informeNro}`,
            `notified_approved_${contractorDoc}_${informeNro}`,
            `notified_approved_${cleanDoc}_${informeNro}`,
            `informe_comments_${contractorDoc}_${informeNro}`,
            `informe_comments_${cleanDoc}_${informeNro}`,
            `informe_comentarios_${contractorDoc}_${informeNro}`,
            `informe_comentarios_${cleanDoc}_${informeNro}`
          ];

          if (reportId) {
            keysToDelete.push(
              `alcaldia_quibdo_report_${reportId}_${informeNro}`,
              `cert_data_${reportId}_${informeNro}`,
              `fid_data_${reportId}_${informeNro}`,
              `desembolso_${reportId}_${informeNro}`
            );
          }

          keysToDelete.forEach(k => localStorage.removeItem(k));

          // Limpiar de localStorage las notificaciones de este informe para contratista y supervisor
          const notifKeys = [`notificaciones_${contractorDoc}`, `notificaciones_${cleanDoc}`, 'notificaciones_supervisor'];
          notifKeys.forEach(k => {
            const saved = localStorage.getItem(k);
            if (saved) {
              try {
                const list: Notificacion[] = JSON.parse(saved);
                const filtered = list.filter(n => n.informe_nro !== informeNro && (!reportId || n.report_id !== reportId));
                localStorage.setItem(k, JSON.stringify(filtered));
              } catch (e) {}
            }
          });
        }
      }
    } catch (err) {
      console.warn('Error deleting report from Supabase:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
    }

    return true;
  },

  // 11. Actualizar Estado de Informe
  async updateEstado(id: string, nuevoEstado: EstadoInforme, contractorDoc?: string, informeNro?: string): Promise<boolean> {
    try {
      if (isUuid(id)) {
        const { error } = await supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('report_id', id)
          .eq('tipo', 'radicado');
        
        const { error: updErr } = await supabase
          .from('informes_mensuales')
          .update({ estado: mapStatusToDb(nuevoEstado) })
          .eq('id', id);
        if (updErr) throw updErr;
      }

      // Marcar como leídas las de radicado
      await this.marcarNotificacionesRadicadasComoLeidas(informeNro, id);

      if (contractorDoc && nuevoEstado === 'Aprobado') {
        const nro = informeNro || '1';
        // Marcar observaciones previas como resueltas
        await this.marcarNotificacionesInformeResueltas(contractorDoc, nro, id);

        this.crearNotificacion({
          user_id: contractorDoc,
          titulo: `¡Informe #${nro} Aprobado!`,
          mensaje: `Tu Informe Contractual #${nro} ha sido revisado y APROBADO formalmente por la supervisión. Ya puedes descargar el PDF oficial.`,
          tipo: 'aprobacion',
          leida: false,
          informe_nro: nro,
          report_id: isUuid(id) ? id : undefined
        }).catch(err => console.warn('Error creating approval notification:', err));
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
      // NUNCA eliminar informes en Borrador, Enviados, En Revisión o Rechazados
      // La política de 7 meses aplica ÚNICAMENTE a informes históricos que ya fueron totalmente 'Aprobados'
      if (rep.estado !== 'Aprobado') {
        validReports.push(rep);
        continue;
      }

      const targetDate = parseDate(rep.fechaPresentacion) || parseDate(rep.periodoHasta);
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
    supervisorId?: string,
    contratoIdParam?: string,
    options?: { excludeLiquidacion?: boolean }
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const docKey = certData.contratistaDocumento || '';
    const cleanDoc = docKey.replace(/[^0-9]/g, '');
    const pagoNroStr = String(certData.pagoNro || '1');

    // 1. Guardar copia en LocalStorage inmediatamente con todas las variantes de clave
    if (typeof localStorage !== 'undefined') {
      const storageKey = `cert_data_${docKey}_${pagoNroStr}`;
      
      // Si excludeLiquidacion es true, verificar si ya había datos de liquidación reales en localStorage
      let mergedCertData = { ...certData };
      if (options?.excludeLiquidacion) {
        const prevRaw = localStorage.getItem(storageKey) || (informeId ? localStorage.getItem(`cert_data_${informeId}_${pagoNroStr}`) : null);
        if (prevRaw) {
          try {
            const prevObj = JSON.parse(prevRaw);
            if (prevObj?.saldoPorPagar) mergedCertData.saldoPorPagar = prevObj.saldoPorPagar;
            if (prevObj?.porcentajeEjecucion) mergedCertData.porcentajeEjecucion = prevObj.porcentajeEjecucion;
            if (prevObj?.valorRubro) mergedCertData.valorRubro = prevObj.valorRubro;
            if (prevObj?.valorPagadoAcumulado) mergedCertData.valorPagadoAcumulado = prevObj.valorPagadoAcumulado;
          } catch (e) {}
        }
      }

      localStorage.setItem(storageKey, JSON.stringify(mergedCertData));
      if (cleanDoc) {
        localStorage.setItem(`cert_data_${cleanDoc}_${pagoNroStr}`, JSON.stringify(mergedCertData));
      }
      localStorage.setItem(`cert_data_${pagoNroStr}`, JSON.stringify(mergedCertData));
      if (informeId) {
        localStorage.setItem(`cert_data_${informeId}_${pagoNroStr}`, JSON.stringify(mergedCertData));
      }
    }

    try {
      let resolvedInformeId = (informeId && isUuid(informeId)) ? informeId : null;
      let contratoId: string | null = (contratoIdParam && isUuid(contratoIdParam)) ? contratoIdParam : null;

      // Si tenemos informeId pero no contratoId, consultar contrato_id desde informes_mensuales
      if (resolvedInformeId && !contratoId) {
        const { data: rep } = await supabase
          .from('informes_mensuales')
          .select('contrato_id')
          .eq('id', resolvedInformeId)
          .limit(1)
          .maybeSingle();
        if (rep?.contrato_id && isUuid(rep.contrato_id)) {
          contratoId = rep.contrato_id;
        }
      }

      // Si no tenemos UUID de informe, buscar si existe informe por documento y número de pago
      if (!resolvedInformeId && (docKey || cleanDoc)) {
        const { data: rep } = await supabase
          .from('informes_mensuales')
          .select('id, contrato_id, contratos!inner(id, profiles!inner(documento_identidad))')
          .eq('informe_nro', parseInt(pagoNroStr, 10) || 1)
          .or(`contratos.profiles.documento_identidad.eq.${docKey},contratos.profiles.documento_identidad.eq.${cleanDoc}`)
          .limit(1)
          .maybeSingle();

        if (rep?.id && isUuid(rep.id)) {
          resolvedInformeId = rep.id;
          if (!contratoId && (rep as any).contrato_id) {
            contratoId = (rep as any).contrato_id;
          }
        }
      }

      const numTotalAPagar = limpiarNumeroMoneda(certData.valorTotalAPagar || certData.valorAPagarSinIva || certData.valorAvalado);
      const numTotalContrato = limpiarNumeroMoneda(certData.valorTotal || certData.valorInicial);
      const numSaldoPorPagar = limpiarNumeroMoneda(certData.saldoPorPagar);

      const payload: any = {
        contratista_documento: cleanDoc || docKey,
        pago_nro: pagoNroStr,
        periodo_certificado: `${certData.periodoDesde || ''} - ${certData.periodoHasta || ''}`,
        valor_autorizado_pago: numTotalAPagar,
        valor_total_contrato: numTotalContrato,
        observaciones_supervision: certData.objeto || '',
        observaciones_liquidacion: certData.observacionesLiquidacion || '',
        expedicion_dia: certData.expedicionDia || '',
        expedicion_mes: certData.expedicionMes || '',
        expedicion_ano: certData.expedicionAno || '',
        datos_formulario: certData, // Guardar todos los campos del formulario íntegramente
        certifica_cumplimiento: true,
        updated_at: new Date().toISOString(),
      };

      // Si no se solicita excluir liquidación (o si es guardado directo desde el certificado/calculadora), enviar saldo_por_pagar y porcentaje_ejecucion
      if (!options?.excludeLiquidacion) {
        payload.saldo_por_pagar = numSaldoPorPagar;
        payload.porcentaje_ejecucion = certData.porcentajeEjecucion || '';
      }

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

      if (!existingId && (docKey || cleanDoc)) {
        const { data: existingByDoc } = await supabase
          .from('certificaciones_supervision')
          .select('id')
          .or(`contratista_documento.eq.${docKey},contratista_documento.eq.${cleanDoc}`)
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

        if (!error && data) {
          const form = data.datos_formulario ? (data.datos_formulario as CertificadoSupervisionData) : null;
          if (form) return form;
        }
      }

      const cleanDoc = (docIdentidad || '').replace(/[^0-9]/g, '');
      if (docIdentidad && pagoNro) {
        const { data, error } = await supabase
          .from('certificaciones_supervision')
          .select('*')
          .or(`contratista_documento.eq.${docIdentidad},contratista_documento.eq.${cleanDoc}`)
          .eq('pago_nro', String(pagoNro))
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const form = data.datos_formulario ? (data.datos_formulario as CertificadoSupervisionData) : null;
          if (form) return form;
        }
      }
    } catch (e) {
      console.warn('Error fetching certificado supervision:', e);
    }

    // Fallback a LocalStorage
    if (typeof localStorage !== 'undefined') {
      const cleanDoc = (docIdentidad || '').replace(/[^0-9]/g, '');
      const key = `cert_data_${docIdentidad || ''}_${pagoNro || '1'}`;
      const saved = localStorage.getItem(key) || 
        (cleanDoc ? localStorage.getItem(`cert_data_${cleanDoc}_${pagoNro || '1'}`) : null) ||
        (pagoNro ? localStorage.getItem(`cert_data_${pagoNro}`) : null);
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
    pagoNroStr?: string,
    contratoIdStr?: string
  ): Promise<{ success: boolean; id?: string }> {
    try {
      const docKeyToUse = docKey || data?.cedula || data?.nitCc || data?.contratistaDocumento || '';
      const cleanDoc = docKeyToUse ? docKeyToUse.replace(/[^0-9]/g, '') : '';
      const nroStr = pagoNroStr || String(data?.pagoNro || data?.consecutivoNro || '1');

      // 1. Guardar copia en LocalStorage inmediatamente
      if (typeof localStorage !== 'undefined' && data) {
        if (docKeyToUse) {
          localStorage.setItem(`fid_data_${docKeyToUse}_${nroStr}`, JSON.stringify(data));
        }
        if (cleanDoc) {
          localStorage.setItem(`fid_data_${cleanDoc}_${nroStr}`, JSON.stringify(data));
        }
        localStorage.setItem(`fid_data_${nroStr}`, JSON.stringify(data));
        if (informeId) {
          localStorage.setItem(`fid_data_${informeId}_${nroStr}`, JSON.stringify(data));
        }
      }

      let resolvedInformeId = (informeId && isUuid(informeId)) ? informeId : '';
      let contratoId: string | null = (contratoIdStr && isUuid(contratoIdStr)) ? contratoIdStr : null;

      if (!resolvedInformeId && (docKeyToUse || cleanDoc)) {
        const { data: rep } = await supabase
          .from('informes_mensuales')
          .select('id, contrato_id, contratos!inner(id, profiles!inner(documento_identidad))')
          .eq('informe_nro', parseInt(nroStr, 10) || 1)
          .or(`contratos.profiles.documento_identidad.eq.${docKeyToUse},contratos.profiles.documento_identidad.eq.${cleanDoc}`)
          .limit(1)
          .maybeSingle();

        if (rep?.id && isUuid(rep.id)) {
          resolvedInformeId = rep.id;
          if (!contratoId && (rep as any).contrato_id) {
            contratoId = (rep as any).contrato_id;
          }
        }
      }

      if (resolvedInformeId && !contratoId) {
        const { data: rep } = await supabase
          .from('informes_mensuales')
          .select('contrato_id')
          .eq('id', resolvedInformeId)
          .limit(1)
          .maybeSingle();
        if (rep?.contrato_id && isUuid(rep.contrato_id)) {
          contratoId = rep.contrato_id;
        }
      }

      if (typeof data === 'object' && data !== null) {
        if (resolvedInformeId) data.reportId = resolvedInformeId;
        if (contratoId) data.contratoId = contratoId;
      }

      const payload: any = {
        contratista_documento: cleanDoc || docKeyToUse,
        pago_nro: nroStr,
        datos_formulario: data,
        fecha_actualizacion: new Date().toISOString()
      };

      if (resolvedInformeId && isUuid(resolvedInformeId)) {
        payload.informe_id = resolvedInformeId;
      }
      if (contratoId && isUuid(contratoId)) {
        payload.contrato_id = contratoId;
      }

      let existingId: string | null = null;
      if (resolvedInformeId) {
        const { data: existingFid } = await supabase
          .from('soportes_fiduciaria')
          .select('id')
          .eq('informe_id', resolvedInformeId)
          .limit(1)
          .maybeSingle();
        if (existingFid?.id) existingId = existingFid.id;
      }

      if (!existingId && (docKeyToUse || cleanDoc)) {
        const { data: existingByDoc } = await supabase
          .from('soportes_fiduciaria')
          .select('id')
          .or(`contratista_documento.eq.${docKeyToUse},contratista_documento.eq.${cleanDoc}`)
          .eq('pago_nro', nroStr)
          .limit(1)
          .maybeSingle();
        if (existingByDoc?.id) existingId = existingByDoc.id;
      }

      if (contratoId) {
        const contractUpdate: any = {};
        if (data?.nroCuenta) contractUpdate.numero_cuenta = data.nroCuenta;
        if (data?.banco) contractUpdate.banco = data.banco;
        if (data?.tipoCuenta) contractUpdate.tipo_cuenta = data.tipoCuenta;
        if (data?.ciudad) contractUpdate.ciudad = data.ciudad;
        if (Object.keys(contractUpdate).length > 0) {
          await supabase.from('contratos').update(contractUpdate).eq('id', contratoId);
        }
      }
      const dirValFid = data?.direccion;
      const docValFid = cleanDoc || docKeyToUse;
      if (dirValFid && docValFid) {
        await supabase.from('profiles').update({ direccion: dirValFid }).or(`documento_identidad.eq.${docValFid},documento_identidad.eq.${docKeyToUse}`);
      }

      if (existingId) {
        const { error: updateErr } = await supabase
          .from('soportes_fiduciaria')
          .update(payload)
          .eq('id', existingId);
        if (updateErr) {
          console.warn('Supabase update soportes_fiduciaria error:', updateErr);
        }
        return { success: true, id: existingId };
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('soportes_fiduciaria')
          .insert([payload])
          .select('id')
          .maybeSingle();
        if (insertErr) {
          console.warn('Supabase insert soportes_fiduciaria error:', insertErr);
        }
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
        const { data, error } = await supabase
          .from('soportes_fiduciaria')
          .select('*')
          .eq('informe_id', informeId)
          .limit(1)
          .maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
      if (docIdentidad && pagoNro) {
        const cleanDoc = docIdentidad.replace(/[^0-9]/g, '');
        const { data, error } = await supabase
          .from('soportes_fiduciaria')
          .select('*')
          .or(`contratista_documento.eq.${docIdentidad},contratista_documento.eq.${cleanDoc}`)
          .eq('pago_nro', pagoNro)
          .limit(1)
          .maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
    } catch (e) {
      console.warn('Error fetching soporte fiduciaria:', e);
    }

    if (typeof localStorage !== 'undefined') {
      const cleanDoc = docIdentidad ? docIdentidad.replace(/[^0-9]/g, '') : '';
      const keysToTry = [
        `fid_data_${docIdentidad || ''}_${pagoNro || '1'}`,
        `fid_data_${cleanDoc}_${pagoNro || '1'}`,
        `fid_data_${informeId || ''}_${pagoNro || '1'}`,
        `fid_data_${pagoNro || '1'}`
      ];
      for (const k of keysToTry) {
        const saved = localStorage.getItem(k);
        if (saved) {
          try { return JSON.parse(saved); } catch (e) {}
        }
      }
    }
    return null;
  },

  // 17. Guardar Declaracion Renta
  async saveDeclaracionRenta(
    informeId: string,
    data: any,
    docKey?: string,
    pagoNroStr?: string,
    contratoIdStr?: string
  ): Promise<{ success: boolean; id?: string }> {
    try {
      let resolvedInformeId = (informeId && isUuid(informeId)) ? informeId : '';
      let contratoId: string | null = (contratoIdStr && isUuid(contratoIdStr)) ? contratoIdStr : null;

      if (resolvedInformeId && !contratoId) {
        const { data: rep } = await supabase
          .from('informes_mensuales')
          .select('contrato_id')
          .eq('id', resolvedInformeId)
          .limit(1)
          .maybeSingle();
        if (rep?.contrato_id && isUuid(rep.contrato_id)) {
          contratoId = rep.contrato_id;
        }
      }

      const payload: any = {
        datos_formulario: data,
        fecha_actualizacion: new Date().toISOString()
      };

      if (docKey) payload.contratista_documento = docKey;
      if (pagoNroStr) payload.pago_nro = pagoNroStr;
      if (resolvedInformeId) payload.informe_id = resolvedInformeId;
      if (contratoId) payload.contrato_id = contratoId;

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

  // 19. Guardar Autorización de Desembolso
  async saveAutorizacionDesembolso(
    informeId: string,
    data: any,
    docKey?: string,
    pagoNroStr?: string,
    contratoIdStr?: string
  ): Promise<{ success: boolean; id?: string }> {
    try {
      const docKeyToUse = docKey || data?.nitCc || data?.contratistaDocumento || '';
      const cleanDoc = docKeyToUse ? docKeyToUse.replace(/[^0-9]/g, '') : '';
      const nroStr = pagoNroStr || String(data?.consecutivoNro || data?.pagoNro || '1');

      // 1. Guardar copia en LocalStorage inmediatamente con todas las variantes de clave
      if (typeof localStorage !== 'undefined' && data) {
        if (docKeyToUse) {
          localStorage.setItem(`desembolso_${docKeyToUse}_${nroStr}`, JSON.stringify(data));
        }
        if (cleanDoc) {
          localStorage.setItem(`desembolso_${cleanDoc}_${nroStr}`, JSON.stringify(data));
        }
        localStorage.setItem(`desembolso_${nroStr}`, JSON.stringify(data));
        if (informeId) {
          localStorage.setItem(`desembolso_${informeId}_${nroStr}`, JSON.stringify(data));
        }
      }

      let resolvedInformeId = (informeId && isUuid(informeId)) ? informeId : '';
      let contratoId: string | null = (contratoIdStr && isUuid(contratoIdStr)) ? contratoIdStr : null;

      // Buscar si existe informe en DB por documento y número de pago
      if (!resolvedInformeId && (docKeyToUse || cleanDoc)) {
        const { data: rep } = await supabase
          .from('informes_mensuales')
          .select('id, contrato_id, contratos!inner(id, profiles!inner(documento_identidad))')
          .eq('informe_nro', parseInt(nroStr, 10) || 1)
          .or(`contratos.profiles.documento_identidad.eq.${docKeyToUse},contratos.profiles.documento_identidad.eq.${cleanDoc}`)
          .limit(1)
          .maybeSingle();

        if (rep?.id && isUuid(rep.id)) {
          resolvedInformeId = rep.id;
          if (!contratoId && (rep as any).contrato_id) {
            contratoId = (rep as any).contrato_id;
          }
        }
      }

      if (resolvedInformeId && !contratoId) {
        const { data: rep } = await supabase
          .from('informes_mensuales')
          .select('contrato_id')
          .eq('id', resolvedInformeId)
          .limit(1)
          .maybeSingle();
        if (rep?.contrato_id && isUuid(rep.contrato_id)) {
          contratoId = rep.contrato_id;
        }
      }

      if (typeof data === 'object' && data !== null) {
        if (resolvedInformeId) data.reportId = resolvedInformeId;
        if (contratoId) data.contratoId = contratoId;
      }

      const payload: any = {
        contratista_documento: cleanDoc || docKeyToUse,
        pago_nro: nroStr,
        datos_formulario: data,
        fecha_actualizacion: new Date().toISOString()
      };

      if (resolvedInformeId && isUuid(resolvedInformeId)) {
        payload.informe_id = resolvedInformeId;
      }

      let existingId: string | null = null;
      if (resolvedInformeId) {
        const { data: existingDoc } = await supabase
          .from('autorizaciones_desembolso')
          .select('id')
          .eq('informe_id', resolvedInformeId)
          .limit(1)
          .maybeSingle();
        if (existingDoc?.id) existingId = existingDoc.id;
      }

      if (!existingId && (docKeyToUse || cleanDoc)) {
        const { data: existingByDoc } = await supabase
          .from('autorizaciones_desembolso')
          .select('id')
          .or(`contratista_documento.eq.${docKeyToUse},contratista_documento.eq.${cleanDoc}`)
          .eq('pago_nro', nroStr)
          .limit(1)
          .maybeSingle();
        if (existingByDoc?.id) existingId = existingByDoc.id;
      }

      if (contratoId) {
        const contractUpdate: any = {};
        if (data?.nroCuenta) contractUpdate.numero_cuenta = data.nroCuenta;
        if (data?.banco) contractUpdate.banco = data.banco;
        if (data?.tipoCuenta) contractUpdate.tipo_cuenta = data.tipoCuenta;
        if (data?.ciudad) contractUpdate.ciudad = data.ciudad;
        if (Object.keys(contractUpdate).length > 0) {
          await supabase.from('contratos').update(contractUpdate).eq('id', contratoId);
        }
      }
      const dirValDes = data?.direccion;
      const docValDes = cleanDoc || docKeyToUse;
      if (dirValDes && docValDes) {
        await supabase.from('profiles').update({ direccion: dirValDes }).or(`documento_identidad.eq.${docValDes},documento_identidad.eq.${docKeyToUse}`);
      }

      if (existingId) {
        const { error: updateErr } = await supabase
          .from('autorizaciones_desembolso')
          .update(payload)
          .eq('id', existingId);
        if (updateErr) {
          console.warn('Supabase update autorizaciones_desembolso error:', updateErr);
        }
        return { success: true, id: existingId };
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('autorizaciones_desembolso')
          .insert([payload])
          .select('id')
          .maybeSingle();
        if (insertErr) {
          console.warn('Supabase insert autorizaciones_desembolso error:', insertErr);
        }
        return { success: true, id: inserted?.id };
      }
    } catch (e: any) {
      console.warn('Error saving autorizacion desembolso to Supabase:', e);
      return { success: true, id: `local-${Date.now()}` };
    }
  },

  // 20. Obtener Autorización de Desembolso
  async getAutorizacionDesembolso(
    informeId?: string,
    docIdentidad?: string,
    pagoNro?: string
  ): Promise<any | null> {
    try {
      if (informeId && isUuid(informeId)) {
        const { data, error } = await supabase
          .from('autorizaciones_desembolso')
          .select('*')
          .eq('informe_id', informeId)
          .limit(1)
          .maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
      if (docIdentidad && pagoNro) {
        const cleanDoc = docIdentidad.replace(/[^0-9]/g, '');
        const { data, error } = await supabase
          .from('autorizaciones_desembolso')
          .select('*')
          .or(`contratista_documento.eq.${docIdentidad},contratista_documento.eq.${cleanDoc}`)
          .eq('pago_nro', pagoNro)
          .limit(1)
          .maybeSingle();
        if (!error && data?.datos_formulario) return data.datos_formulario;
      }
    } catch (e) {
      console.warn('Error fetching autorizacion desembolso:', e);
    }

    if (typeof localStorage !== 'undefined') {
      const cleanDoc = docIdentidad ? docIdentidad.replace(/[^0-9]/g, '') : '';
      const keysToTry = [
        `desembolso_${docIdentidad || ''}_${pagoNro || '1'}`,
        `desembolso_${cleanDoc}_${pagoNro || '1'}`,
        `desembolso_${informeId || ''}_${pagoNro || '1'}`,
        `desembolso_${pagoNro || '1'}`
      ];
      for (const k of keysToTry) {
        const saved = localStorage.getItem(k);
        if (saved) {
          try { return JSON.parse(saved); } catch (e) {}
        }
      }
    }
    return null;
  },

  // 21. Obtener el último informe guardado por un usuario (Para precarga inteligente)
  async getLastSavedReport(contractorDocument: string, contractorId?: string): Promise<ReportData | null> {
    try {
      const reports = await this.getContractorReports(contractorDocument, contractorId);
      if (reports && reports.length > 0) {
        // Ordenar por número de informe descendente
        const sorted = [...reports].sort((a, b) => parseInt(b.informeNro || '0', 10) - parseInt(a.informeNro || '0', 10));
        return sorted[0];
      }
    } catch (e) {
      console.warn('Error fetching last saved report from Supabase:', e);
    }

    // Fallback a LocalStorage aislado del contratista
    if (typeof localStorage !== 'undefined' && contractorDocument) {
      for (let i = 12; i >= 1; i--) {
        const saved = localStorage.getItem(`informe_data_${contractorDocument}_${i}`);
        if (saved) {
          try {
            return JSON.parse(saved) as ReportData;
          } catch (e) {}
        }
      }
    }
    return null;
  },

  // 22. Obtener Notificaciones Institucionales (Filtrado estricto por usuario)
  async getNotificaciones(userId?: string, userDoc?: string): Promise<Notificacion[]> {
    const targetIds = [userId, userDoc].filter(Boolean) as string[];
    if (targetIds.length === 0) return [];

    let dbNotifs: Notificacion[] = [];
    try {
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .in('user_id', targetIds)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        dbNotifs = data.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          mensaje: d.mensaje,
          tipo: d.tipo || 'info',
          leida: Boolean(d.leida),
          created_at: d.created_at,
          informe_nro: d.informe_nro,
          report_id: d.report_id,
          titulo: d.titulo || (d.tipo === 'aprobacion' ? 'Informe Aprobado' : d.tipo === 'devolucion' ? 'Informe Devuelto' : 'Notificación')
        }));
      }
    } catch (e) {
      console.warn('Error fetching notifications from Supabase:', e);
    }

    // Unir con almacenamiento local aislado por usuario
    const primaryKey = userDoc || userId || 'default';
    let localNotifs: Notificacion[] = [];
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`notificaciones_${primaryKey}`);
      if (saved) {
        try {
          localNotifs = JSON.parse(saved);
        } catch (e) {}
      }
    }

    // Combinar y deduplicar por id
    const combinedMap = new Map<string, Notificacion>();
    dbNotifs.forEach(n => combinedMap.set(n.id, n));
    localNotifs.forEach(n => {
      if (!combinedMap.has(n.id)) {
        combinedMap.set(n.id, n);
      }
    });

    const result = Array.from(combinedMap.values()).sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  },

  // 23. Crear Notificación Institucional
  async crearNotificacion(notif: Omit<Notificacion, 'id' | 'created_at'>): Promise<Notificacion | null> {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newNotif: Notificacion = {
      ...notif,
      id,
      created_at: new Date().toISOString(),
      leida: false,
    };

    // 1. Limpiar/consolidar notificaciones previas no leídas del mismo tipo para este mismo informe
    try {
      if (notif.informe_nro && (notif.tipo === 'devolucion' || notif.tipo === 'radicado')) {
        await supabase
          .from('notificaciones')
          .delete()
          .eq('user_id', notif.user_id)
          .eq('informe_nro', notif.informe_nro)
          .eq('tipo', notif.tipo);
      }
    } catch (e) {
      console.warn('Error deduplicating notification in Supabase:', e);
    }

    // 2. Guardar en Supabase
    try {
      const { data, error } = await supabase
        .from('notificaciones')
        .insert([{
          user_id: notif.user_id,
          mensaje: notif.mensaje,
          tipo: notif.tipo || 'info',
          leida: false,
          informe_nro: notif.informe_nro || null,
          report_id: (notif.report_id && isUuid(notif.report_id)) ? notif.report_id : null
        }])
        .select('*')
        .maybeSingle();

      if (!error && data?.id) {
        newNotif.id = data.id;
      }
    } catch (e) {
      console.warn('Error saving notification to Supabase:', e);
    }

    // 3. Guardar en LocalStorage aislado del usuario (reemplazando anteriores del mismo tipo si aplica)
    if (typeof localStorage !== 'undefined') {
      const key = `notificaciones_${notif.user_id}`;
      const saved = localStorage.getItem(key);
      let list: Notificacion[] = [];
      if (saved) {
        try { 
          list = JSON.parse(saved); 
          if (notif.informe_nro && (notif.tipo === 'devolucion' || notif.tipo === 'radicado')) {
            list = list.filter(n => !(n.informe_nro === notif.informe_nro && n.tipo === notif.tipo));
          }
        } catch (e) {}
      }
      list.unshift(newNotif);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
    }

    // 4. Emitir evento para actualización instantánea en la interfaz
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas', { detail: newNotif }));
    }

    return newNotif;
  },

  // 23.1. Marcar notificaciones de un informe como resueltas/leídas (cuando se subsana, radica o aprueba)
  async marcarNotificacionesInformeResueltas(userDoc?: string, informeNro?: string, reportId?: string): Promise<boolean> {
    if (!userDoc && !reportId && !informeNro) return false;
    try {
      if (userDoc && informeNro) {
        await supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('user_id', userDoc)
          .eq('informe_nro', informeNro)
          .eq('tipo', 'devolucion');
      }
      if (reportId && isUuid(reportId)) {
        await supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('report_id', reportId)
          .eq('tipo', 'devolucion');
      }
    } catch (e) {
      console.warn('Error resolving report notifications in Supabase:', e);
    }

    if (typeof localStorage !== 'undefined') {
      const keys = [userDoc, 'supervisor'].filter(Boolean) as string[];
      for (const k of keys) {
        const storageKey = `notificaciones_${k}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const list: Notificacion[] = JSON.parse(saved);
            const updated = list.map(n => {
              if (
                (informeNro && n.informe_nro === informeNro && n.tipo === 'devolucion') || 
                (reportId && n.report_id === reportId && n.tipo === 'devolucion')
              ) {
                return { ...n, leida: true };
              }
              return n;
            });
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (e) {}
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
    }
    return true;
  },

  // 23.2. Marcar notificaciones de radicado de un informe como leídas (para el supervisor/secretaría)
  async marcarNotificacionesRadicadasComoLeidas(informeNro?: string, reportId?: string): Promise<boolean> {
    if (!reportId && !informeNro) return false;
    try {
      let query = supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('tipo', 'radicado');

      if (reportId && isUuid(reportId)) {
        await query.eq('report_id', reportId);
      } else if (informeNro) {
        await query.eq('informe_nro', informeNro);
      }
    } catch (e) {
      console.warn('Error resolving radicado notifications in Supabase:', e);
    }

    if (typeof localStorage !== 'undefined') {
      const keys = ['supervisor', 'supervisor_apoyo', 'admin'];
      for (const k of keys) {
        const storageKey = `notificaciones_${k}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const list: Notificacion[] = JSON.parse(saved);
            const updated = list.map(n => {
              if (
                (informeNro && n.informe_nro === informeNro && n.tipo === 'radicado') || 
                (reportId && n.report_id === reportId && n.tipo === 'radicado')
              ) {
                return { ...n, leida: true };
              }
              return n;
            });
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (e) {}
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
    }
    return true;
  },

  // 24. Marcar Notificación como Leída
  async marcarNotificacionLeida(notifId: string, userDoc?: string): Promise<boolean> {
    try {
      if (isUuid(notifId)) {
        await supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('id', notifId);
      }
    } catch (e) {
      console.warn('Error marking notification as read in Supabase:', e);
    }

    if (typeof localStorage !== 'undefined' && userDoc) {
      const key = `notificaciones_${userDoc}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const list: Notificacion[] = JSON.parse(saved);
          const updated = list.map(n => n.id === notifId ? { ...n, leida: true } : n);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {}
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
    }
    return true;
  },

  // 25. Marcar Todas las Notificaciones como Leídas
  async marcarTodasNotificacionesLeidas(userId?: string, userDoc?: string): Promise<boolean> {
    const targetIds = [userId, userDoc].filter(Boolean) as string[];
    if (targetIds.length === 0) return false;

    try {
      await supabase
        .from('notificaciones')
        .update({ leida: true })
        .in('user_id', targetIds);
    } catch (e) {
      console.warn('Error marking all notifications as read in Supabase:', e);
    }

    const primaryKey = userDoc || userId;
    if (typeof localStorage !== 'undefined' && primaryKey) {
      const key = `notificaciones_${primaryKey}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const list: Notificacion[] = JSON.parse(saved);
          const updated = list.map(n => ({ ...n, leida: true }));
          localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {}
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
    }
    return true;
  },

  // 26. Eliminar Notificación Individual
  async eliminarNotificacion(notifId: string, userDoc?: string, userId?: string): Promise<boolean> {
    try {
      if (isUuid(notifId)) {
        await supabase
          .from('notificaciones')
          .delete()
          .eq('id', notifId);
      }
    } catch (e) {
      console.warn('Error deleting notification from Supabase:', e);
    }

    const keys = [userDoc, userId].filter(Boolean);
    if (typeof localStorage !== 'undefined') {
      for (const k of keys) {
        const storageKey = `notificaciones_${k}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const list: Notificacion[] = JSON.parse(saved);
            const updated = list.filter(n => n.id !== notifId);
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (e) {}
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
    }
    return true;
  },

  // 27. Limpiar Todas las Notificaciones de un Usuario
  async limpiarTodasNotificaciones(userId?: string, userDoc?: string): Promise<boolean> {
    const targetIds = [userId, userDoc].filter(Boolean) as string[];
    if (targetIds.length === 0) return false;

    try {
      await supabase
        .from('notificaciones')
        .delete()
        .in('user_id', targetIds);
    } catch (e) {
      console.warn('Error clearing notifications from Supabase:', e);
    }

    if (typeof localStorage !== 'undefined') {
      for (const target of targetIds) {
        localStorage.removeItem(`notificaciones_${target}`);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
    }
    return true;
  }
};
