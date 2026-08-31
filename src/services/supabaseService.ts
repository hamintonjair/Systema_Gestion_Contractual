import { supabase } from '../lib/supabase';
import { Secretaria, ReportData, InformeSummary, EstadoInforme, AuthUser, Anexo, FieldComment, CertificadoSupervisionData, createDefaultCertificadoData, createDefaultFiduciariaData, createDefaultAutorizacionDesembolsoData, Obligacion, Notificacion, extractContratoNroOnly } from '../types';
import { formatColombianCurrency, formatValorAdicion, formatPlazoLetraYNumero, formatDateSlash, formatFechaAplicacion } from '../utils/formatters';
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
      const raw = localStorage.getItem(`informe_comentarios_${docKey}_${informeNro}`);
      if (raw) return JSON.parse(raw);
    }
    if (informeNro) {
      const raw = localStorage.getItem(`informe_comentarios_${informeNro}`);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
};

// Helper para obtener informe completo almacenado
const getStoredReportData = (docKey?: string, informeNro?: string): Partial<ReportData> | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (docKey && informeNro) {
      const raw = localStorage.getItem(`alcaldia_quibdo_report_${docKey}_${informeNro}`);
      if (raw) return JSON.parse(raw);
    }
    if (informeNro) {
      const raw = localStorage.getItem(`alcaldia_quibdo_report_${informeNro}`);
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
    const stored = storedObs?.find(so => so.id === obs.id || so.descripcion === obs.descripcion);
    if (stored?.fotos && stored.fotos.length > 0) {
      stored.fotos.forEach(f => { if (f.id) assignedAnexosIds.add(f.id); });
      return { ...obs, fotos: stored.fotos.slice(0, 5) };
    }

    const matched = allAnexos.filter(a => {
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

    matched.forEach(m => assignedAnexosIds.add(m.id));

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

  // Fallback positional distribution for unassigned anexos if obligations have no photos
  let unassignedAnexos = allAnexos.filter(a => !assignedAnexosIds.has(a.id));
  if (unassignedAnexos.length > 0) {
    for (let i = 0; i < obsWithFotos.length && unassignedAnexos.length > 0; i++) {
      const obs = obsWithFotos[i];
      if ((obs.fotos?.length || 0) === 0) {
        const takeCount = Math.min(5, unassignedAnexos.length);
        const taken = unassignedAnexos.splice(0, takeCount).map((f, fIdx) => ({
          ...f,
          obligacionId: obs.id,
          obligacionIndex: i + 1,
          titulo: f.titulo || `Evidencia fotográfica ${fIdx + 1} - Obligación #${i + 1}`
        }));
        obsWithFotos[i] = {
          ...obs,
          fotos: taken
        };
      }
    }
  }

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

  // 1. Extraer __VALOR_PAGAR__: si existe
  if (current.includes('__VALOR_PAGAR__:')) {
    const parts = current.split('__VALOR_PAGAR__:');
    current = parts[0] || '';
    if (parts[1]) {
      const rawVp = parts[1].split('__COMMENTS_JSON__:')[0].trim();
      try {
        valorPagarText = decodeURIComponent(rawVp);
      } catch (e) {
        valorPagarText = rawVp;
      }
    }
  }

  // 2. Extraer __COMMENTS_JSON__: si existe
  if (current.includes('__COMMENTS_JSON__:')) {
    const parts = current.split('__COMMENTS_JSON__:');
    current = parts[0] || '';
    if (parts[1]) {
      const rawComm = parts[1].split('__VALOR_PAGAR__:')[0].trim();
      try {
        comments = JSON.parse(rawComm);
      } catch (e) {}
    }
  }

  return { cleanObs: current.trim(), comments, valorPagarText };
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
        vigencia: 2026
      };

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
              rawObservacionesDb: row.observaciones || '',
              obligaciones: obsWithFotos,
              anexos: allAnexos,
              valorPagar: finalValorPagar,
              valorPagarCertificado: row.valor_pagar_certificado || (numCert ? String(numCert) : ''),
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
      return null;
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

      const parsedValorPagar = limpiarNumeroMoneda(report.valorPagar) || 3338300;

      const informePayload: any = {
        informe_nro: parseInt(report.informeNro, 10) || 1,
        tipo_informe: report.tipoInforme || 'Mensual',
        fecha_presentacion: parseDateForPg(report.fechaPresentacion, new Date().toISOString().split('T')[0]),
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
        }
        localStorage.setItem(`alcaldia_quibdo_report_${report.informeNro}`, JSON.stringify(updatedReportWithDb));
      }

      // Sincronizar automáticamente Certificado de Supervisión, Soporte Fiduciaria y Autorización de Desembolso en Supabase
      try {
        const certDataToSync = createDefaultCertificadoData(updatedReportWithDb);
        await this.saveCertificadoSupervision(certDataToSync, informeId, undefined, contratoId);

        const fidDataToSync = createDefaultFiduciariaData(updatedReportWithDb);
        await this.saveSoporteFiduciaria(informeId, fidDataToSync, contractorDoc, String(report.informeNro || '1'), contratoId);

        const desembolsoDataToSync = createDefaultAutorizacionDesembolsoData(updatedReportWithDb);
        await this.saveAutorizacionDesembolso(informeId, desembolsoDataToSync, contractorDoc, String(report.informeNro || '1'), contratoId);
      } catch (certSyncErr) {
        console.warn('Error syncing certificados/soportes in saveFullInforme:', certSyncErr);
      }

      return { success: true, id: informeId || `local-${Date.now()}` };
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
            estado: mapStatusToDb(statusToSave) 
          })
          .eq('id', reportId);
      }
    } catch (e) {
      console.warn('Error saving comments to Supabase:', e);
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
      const firstComm = pendingComments[0]?.comentario || 'Verifique las observaciones en el documento.';
      
      const titulo = `⚠️ Observación en ${docNames} (Informe #${informeNro})`;
      const mensaje = `La supervisión ha registrado observaciones en ${docNames} del Informe #${informeNro}: "${firstComm}". Por favor ingrese para realizar la corrección.`;

      this.crearNotificacion({
        user_id: contractorDoc,
        titulo,
        mensaje,
        tipo: 'devolucion',
        leida: false,
        informe_nro: informeNro,
        report_id: isUuid(reportId) ? reportId : undefined
      }).catch(err => console.warn('Error creating contractor notification:', err));
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

  // 10. Eliminar Informe Completo (En Supabase, Almacenamiento de Fotos, Certificaciones, Documentos Asociados y Ejecutar Depuración de 7 Meses)
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
        await supabase.from('notificaciones').delete().eq('user_id', contractorDoc).eq('informe_nro', informeNro);

        // Limpiar notificaciones en LocalStorage para este contratista e informe
        if (typeof localStorage !== 'undefined') {
          const key = `notificaciones_${contractorDoc}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            try {
              const list: Notificacion[] = JSON.parse(saved);
              const filtered = list.filter(n => n.informe_nro !== informeNro);
              localStorage.setItem(key, JSON.stringify(filtered));
            } catch (e) {}
          }
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
          .from('informes_mensuales')
          .update({ estado: mapStatusToDb(nuevoEstado) })
          .eq('id', id);
        if (error) throw error;
      }

      if (contractorDoc && nuevoEstado === 'Aprobado') {
        const nro = informeNro || '1';
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
    contratoIdParam?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const docKey = certData.contratistaDocumento || '';
    const cleanDoc = docKey.replace(/[^0-9]/g, '');
    const pagoNroStr = String(certData.pagoNro || '1');

    // 1. Guardar copia en LocalStorage inmediatamente con todas las variantes de clave
    if (typeof localStorage !== 'undefined') {
      const storageKey = `cert_data_${docKey}_${pagoNroStr}`;
      localStorage.setItem(storageKey, JSON.stringify(certData));
      if (cleanDoc) {
        localStorage.setItem(`cert_data_${cleanDoc}_${pagoNroStr}`, JSON.stringify(certData));
      }
      localStorage.setItem(`cert_data_${pagoNroStr}`, JSON.stringify(certData));
      if (informeId) {
        localStorage.setItem(`cert_data_${informeId}_${pagoNroStr}`, JSON.stringify(certData));
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
        saldo_por_pagar: numSaldoPorPagar,
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

    // 1. Guardar en Supabase
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

    // 2. Guardar en LocalStorage aislado del usuario
    if (typeof localStorage !== 'undefined') {
      const key = `notificaciones_${notif.user_id}`;
      const saved = localStorage.getItem(key);
      let list: Notificacion[] = [];
      if (saved) {
        try { list = JSON.parse(saved); } catch (e) {}
      }
      list.unshift(newNotif);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
    }

    // 3. Emitir evento para actualización instantánea en la interfaz
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificaciones_actualizadas', { detail: newNotif }));
    }

    return newNotif;
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
