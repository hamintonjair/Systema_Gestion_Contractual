import React, { useState, useEffect } from 'react';
import { Secretaria, AuthUser } from '../types';
import { supabaseService } from '../services/supabaseService';
import { SUPABASE_CONFIG } from '../lib/supabase';
import { 
  ShieldCheck, 
  Building2, 
  Plus, 
  Database, 
  Check, 
  ExternalLink, 
  Code2, 
  FileSpreadsheet, 
  Layers, 
  Copy,
  Users,
  FileCheck,
  TrendingUp,
  Settings,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  Shield,
  Phone,
  UserPlus
} from 'lucide-react';

interface Props {
  user: AuthUser;
}

export default function SuperAdminView({ user }: Props) {
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [allUsers, setAllUsers] = useState<AuthUser[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
  const [copiedAdminId, setCopiedAdminId] = useState<string | null>(null);

  // Form Fields - Secretaría
  const [newNombre, setNewNombre] = useState('');
  const [newCodigo, setNewCodigo] = useState('');
  const [newNit, setNewNit] = useState('891680011-0');

  // Form Fields - Administrador de Secretaría
  const [adminNombre, setAdminNombre] = useState('');
  const [adminCedula, setAdminCedula] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('Admin2026*');
  const [adminCargo, setAdminCargo] = useState('Secretaria de Despacho / Supervisora');
  const [adminTelefono, setAdminTelefono] = useState('3100000000');

  const loadData = async () => {
    setLoading(true);
    const secs = await supabaseService.getSecretarias();
    setSecretarias(secs);
    const users = await supabaseService.getAllUsers();
    setAllUsers(users);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSecretaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre || !newCodigo || !adminNombre || !adminCedula || !adminEmail || !adminPassword) return;

    const result = await supabaseService.createSecretariaWithAdmin(
      {
        nombre: newNombre,
        codigo: newCodigo,
        nit: newNit,
      },
      {
        nombreCompleto: adminNombre,
        documentoIdentidad: adminCedula,
        email: adminEmail,
        password: adminPassword,
        cargo: adminCargo,
        telefono: adminTelefono,
      }
    );

    if (result.success) {
      await loadData();
      setShowAddModal(false);
      
      // Reset form
      setNewNombre('');
      setNewCodigo('');
      setAdminNombre('');
      setAdminCedula('');
      setAdminEmail('');
      setAdminPassword('Admin2026*');
      setAdminCargo('Secretaria de Despacho / Supervisora');
      setAdminTelefono('3100000000');
    }
  };

  const copySchemaSql = () => {
    const sqlText = `-- ==============================================================================
-- ALCALDÍA MUNICIPAL DE QUIBDÓ - CHOCÓ (NIT: 891680011-0)
-- ESQUEMA Y MIGRACIÓN ROBUSTA POSTGRESQL SUPABASE (7 TABLAS ESTRUCTURALES)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: sec_secretarias
CREATE TABLE IF NOT EXISTS sec_secretarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nit TEXT NOT NULL DEFAULT '891680011-0',
  codigo TEXT NOT NULL DEFAULT '100',
  banner_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS nit TEXT DEFAULT '891680011-0';
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT '100';
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_sec_secretarias_codigo ON sec_secretarias (codigo);

-- 2. TABLA: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL DEFAULT 'contratista',
  secretaria_id UUID REFERENCES sec_secretarias(id) ON DELETE SET NULL,
  nombre_completo TEXT,
  documento_identidad TEXT,
  email TEXT,
  telefono TEXT,
  cargo TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'contratista';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secretaria_id UUID REFERENCES sec_secretarias(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nombre_completo TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS documento_identidad TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_documento ON profiles (documento_identidad) WHERE documento_identidad IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email) WHERE email IS NOT NULL;

-- 3. TABLA: contratos
CREATE TABLE IF NOT EXISTS contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contratista_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  secretaria_id UUID REFERENCES sec_secretarias(id) ON DELETE CASCADE,
  contrato_nro TEXT NOT NULL DEFAULT '001',
  vigencia INTEGER NOT NULL DEFAULT 2026,
  objeto TEXT,
  valor_contrato NUMERIC(14, 2) DEFAULT 0,
  cdp_nro TEXT,
  crp_nro TEXT,
  poliza_nro TEXT,
  fecha_aprobacion_poliza DATE,
  plazo_meses INTEGER DEFAULT 6,
  fecha_inicio DATE,
  fecha_terminacion DATE,
  supervisor_nombre TEXT,
  supervisor_documento TEXT,
  apoyo_supervision_nombre TEXT,
  apoyo_supervision_documento TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS contratista_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS secretaria_id UUID REFERENCES sec_secretarias(id) ON DELETE CASCADE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS contrato_nro TEXT DEFAULT '001';
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS vigencia INTEGER DEFAULT 2026;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS objeto TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_contrato NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cdp_nro TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS crp_nro TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS poliza_nro TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS fecha_aprobacion_poliza DATE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS plazo_meses INTEGER DEFAULT 6;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS fecha_terminacion DATE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS supervisor_nombre TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS supervisor_documento TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS apoyo_supervision_nombre TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS apoyo_supervision_documento TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

-- 4. TABLA: informes_mensuales
CREATE TABLE IF NOT EXISTS informes_mensuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE,
  informe_nro INTEGER NOT NULL DEFAULT 1,
  tipo_informe TEXT DEFAULT 'Mensual',
  fecha_presentacion DATE DEFAULT CURRENT_DATE,
  periodo_desde DATE,
  periodo_hasta DATE,
  valor_adicion NUMERIC(14, 2) DEFAULT 0,
  modificaciones_contrato TEXT,
  observaciones TEXT,
  valor_pagar_certificado NUMERIC(14, 2),
  estado TEXT DEFAULT 'Enviado',
  motivo_rechazo TEXT,
  fecha_aprobacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS informe_nro INTEGER DEFAULT 1;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS tipo_informe TEXT DEFAULT 'Mensual';
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS fecha_presentacion DATE DEFAULT CURRENT_DATE;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS periodo_desde DATE;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS periodo_hasta DATE;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS valor_adicion NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS modificaciones_contrato TEXT;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS valor_pagar_certificado NUMERIC(14, 2);
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Enviado';
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
ALTER TABLE informes_mensuales ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMPTZ;

-- 5. TABLA: informe_obligaciones
CREATE TABLE IF NOT EXISTS informe_obligaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE,
  obligacion_descripcion TEXT NOT NULL,
  actividades_realizadas TEXT NOT NULL,
  soportes_texto TEXT DEFAULT 'Anexo fotográfico',
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE informe_obligaciones ADD COLUMN IF NOT EXISTS informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE;
ALTER TABLE informe_obligaciones ADD COLUMN IF NOT EXISTS obligacion_descripcion TEXT;
ALTER TABLE informe_obligaciones ADD COLUMN IF NOT EXISTS actividades_realizadas TEXT;
ALTER TABLE informe_obligaciones ADD COLUMN IF NOT EXISTS soportes_texto TEXT DEFAULT 'Anexo fotográfico';
ALTER TABLE informe_obligaciones ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 1;

-- 6. TABLA: informe_anexos
CREATE TABLE IF NOT EXISTS informe_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  imagen_url TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE informe_anexos ADD COLUMN IF NOT EXISTS informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE;
ALTER TABLE informe_anexos ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE informe_anexos ADD COLUMN IF NOT EXISTS imagen_url TEXT;
ALTER TABLE informe_anexos ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 1;

-- 7. TABLA: certificaciones_supervision
CREATE TABLE IF NOT EXISTS certificaciones_supervision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  certifica_cumplimiento BOOLEAN NOT NULL DEFAULT TRUE,
  periodo_certificado TEXT NOT NULL,
  valor_autorizado_pago NUMERIC(14, 2) NOT NULL,
  nro_radicado_financiera TEXT,
  observaciones_supervision TEXT,
  fecha_certificacion TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS certifica_cumplimiento BOOLEAN DEFAULT TRUE;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS periodo_certificado TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS valor_autorizado_pago NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS nro_radicado_financiera TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS observaciones_supervision TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS fecha_certificacion TIMESTAMPTZ DEFAULT NOW();

-- HABILITAR RLS
ALTER TABLE sec_secretarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE informe_obligaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE informe_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificaciones_supervision ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores para permitir reejecución sin errores
DROP POLICY IF EXISTS "Lectura general secretarias" ON sec_secretarias;
DROP POLICY IF EXISTS "Lectura perfiles" ON profiles;
DROP POLICY IF EXISTS "Lectura contratos" ON contratos;
DROP POLICY IF EXISTS "Lectura informes" ON informes_mensuales;
DROP POLICY IF EXISTS "Lectura obligaciones" ON informe_obligaciones;
DROP POLICY IF EXISTS "Lectura anexos" ON informe_anexos;
DROP POLICY IF EXISTS "Lectura certificaciones" ON certificaciones_supervision;

-- POLÍTICAS GENERALES DE LECTURA Y ESCRITURA
CREATE POLICY "Lectura general secretarias" ON sec_secretarias FOR ALL USING (true);
CREATE POLICY "Lectura perfiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Lectura contratos" ON contratos FOR ALL USING (true);
CREATE POLICY "Lectura informes" ON informes_mensuales FOR ALL USING (true);
CREATE POLICY "Lectura obligaciones" ON informe_obligaciones FOR ALL USING (true);
CREATE POLICY "Lectura anexos" ON informe_anexos FOR ALL USING (true);
CREATE POLICY "Lectura certificaciones" ON certificaciones_supervision FOR ALL USING (true);

-- SEEDS BÁSICOS
INSERT INTO sec_secretarias (id, nombre, nit, codigo) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Secretaría de Inclusión y Cohesión Social', '891680011-0', '170'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Secretaría de Hacienda y Gestión Financiera', '891680011-0', '110'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Secretaría de Educación Municipal', '891680011-0', '140'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Secretaría de Infraestructura y Obras Públicas', '891680011-0', '150'),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Secretaría General y de Gobierno', '891680011-0', '120'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Secretaría de Salud y Protección Social', '891680011-0', '130')
ON CONFLICT (id) DO UPDATE SET 
  nombre = EXCLUDED.nombre,
  codigo = EXCLUDED.codigo,
  nit = EXCLUDED.nit;`;

    navigator.clipboard.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyAdminCredentials = (admin: AuthUser, secNombre: string) => {
    const credText = `🏛️ ALCALDÍA DE QUIBDÓ - CREDENCIALES DE ADMINISTRADOR DE SECRETARÍA
Dependencia: ${secNombre}
Administrador(a): ${admin.nombreCompleto}
Cédula: ${admin.documentoIdentidad}
Cargo: ${admin.cargo || 'Secretario(a) de Despacho'}

🔐 Usuario / Correo: ${admin.email}
🔑 Contraseña: ${admin.password || 'Admin2026*'}`;

    navigator.clipboard.writeText(credText);
    setCopiedAdminId(admin.id);
    setTimeout(() => setCopiedAdminId(null), 2500);
  };

  // Helper para buscar el admin asignado a cada secretaría
  const getAdminForSecretaria = (sec: Secretaria) => {
    return allUsers.find(
      u => u.role === 'secretaria_admin' && (u.secretariaId === sec.id || u.secretariaCodigo === sec.codigo || u.secretariaNombre?.toLowerCase() === sec.nombre.toLowerCase())
    );
  };

  // Helper para contar contratistas de cada secretaría
  const getContractorsCount = (sec: Secretaria) => {
    return allUsers.filter(
      u => u.role === 'contratista' && (u.secretariaId === sec.id || u.secretariaCodigo === sec.codigo || u.secretariaNombre?.toLowerCase() === sec.nombre.toLowerCase())
    ).length;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Banner Principal del Super Administrador */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldCheck size={16} />
            <span>Nivel Global • Super Administrador Municipal</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Panel Maestro de Secretarías y Dependencias
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Crea secretarías, asigna administradores de despacho con sus credenciales oficiales de acceso, supervisa contratistas y gestiona el multi-tenant institucional.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all shrink-0"
        >
          <Plus size={16} />
          <span>+ Nueva Secretaría y Administrador</span>
        </button>
      </div>

      {/* Tarjetas de Métricas Globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">Secretarías Habilitadas</span>
            <Building2 size={18} className="text-emerald-700" />
          </div>
          <p className="text-2xl font-black text-gray-900">{secretarias.length}</p>
          <p className="text-xs text-emerald-600 font-semibold mt-1">Multi-tenant activo</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">Administradores Asignados</span>
            <UserCheck size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">
            {allUsers.filter(u => u.role === 'secretaria_admin').length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Supervisores con acceso</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">Contratistas Totales</span>
            <Users size={18} className="text-amber-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">
            {allUsers.filter(u => u.role === 'contratista').length}
          </p>
          <p className="text-xs text-amber-600 font-semibold mt-1">En todas las secretarías</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase">Base de Datos Supabase</span>
            <Database size={18} className="text-emerald-600" />
          </div>
          <p className="text-xs font-bold text-gray-900 font-mono">usdsynzkedjydlynkala</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">PostgreSQL Cloud RLS</p>
        </div>

      </div>

      {/* Grid de Secretarías con su Administrador Oficial */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={18} className="text-emerald-800" />
            Secretarías y Administradores Registrados
          </h3>
          <span className="text-xs text-gray-500 font-mono">Total: {secretarias.length} dependencias</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {secretarias.map((sec) => {
            const admin = getAdminForSecretaria(sec);
            const count = getContractorsCount(sec);

            return (
              <div 
                key={sec.id} 
                className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 hover:border-emerald-500 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 font-mono font-bold text-xs">
                      {sec.codigo}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 font-mono">
                      NIT {sec.nit}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-gray-900 mt-3 leading-snug">
                    {sec.nombre}
                  </h4>

                  {/* Administrador Oficial Asignado */}
                  <div className="mt-4 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                        <UserCheck size={12} className="text-emerald-700" /> Administrador(a) Oficial
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>

                    {admin ? (
                      <div className="space-y-1.5 text-xs">
                        <p className="font-bold text-gray-900">{admin.nombreCompleto}</p>
                        <p className="text-[11px] text-gray-600 font-mono">C.C. {admin.documentoIdentidad} • {admin.cargo || 'Supervisor(a)'}</p>
                        
                        {/* Credenciales de Acceso */}
                        <div className="pt-1.5 border-t border-emerald-200/60 space-y-1 font-mono text-[11px]">
                          <div className="flex items-center justify-between text-gray-700">
                            <span className="text-gray-500 font-sans text-[10px]">Correo:</span>
                            <span className="font-semibold text-gray-900">{admin.email}</span>
                          </div>
                          
                          <div className="flex items-center justify-between text-gray-700">
                            <span className="text-gray-500 font-sans text-[10px]">Clave:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">
                                {visiblePasswords[admin.id] ? (admin.password || 'Admin2026*') : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(admin.id)}
                                className="text-gray-400 hover:text-gray-700"
                                title="Mostrar/Ocultar contraseña"
                              >
                                {visiblePasswords[admin.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 italic">
                        Sin administrador asignado específicamente
                      </p>
                    )}
                  </div>

                  {/* Conteo de Contratistas */}
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users size={14} className="text-emerald-700" /> Contratistas Vinculados:
                    </span>
                    <span className="font-bold text-gray-900 font-mono bg-gray-100 px-2 py-0.5 rounded">
                      {count} contratistas
                    </span>
                  </div>
                </div>

                {/* Botón de Copiar Credenciales */}
                {admin && (
                  <button
                    onClick={() => handleCopyAdminCredentials(admin, sec.nombre)}
                    className="w-full py-2 bg-gray-50 hover:bg-emerald-50 text-gray-800 hover:text-emerald-900 border border-gray-200 hover:border-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copiedAdminId === admin.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{copiedAdminId === admin.id ? '¡Credenciales Copiadas!' : 'Copiar Credenciales Admin'}</span>
                  </button>
                )}

              </div>
            );
          })}
        </div>
      </div>

      {/* Sección de Esquema SQL y Conexión Supabase */}
      <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
              <Code2 size={16} />
              <span>DDL PostgreSQL • Tablas Multi-Tenant Supabase</span>
            </div>
            <h4 className="text-base font-bold text-white mt-0.5">
              Esquema de Tablas para la Alcaldía de Quibdó
            </h4>
          </div>

          <button
            onClick={copySchemaSql}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            {copiedSql ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedSql ? '¡SQL Copiado!' : 'Copiar DDL para SQL Editor'}</span>
          </button>
        </div>

        <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800/80 leading-relaxed">
{`-- 7 TABLAS ESTRUCTURALES ACTIVAS EN usdsynzkedjydlynkala.supabase.co
1. sec_secretarias: id, nombre, nit, codigo, banner_url, activo, created_at, updated_at
2. profiles: id, role ('super_admin', 'secretaria_admin', 'contratista'), secretaria_id, nombre_completo, documento_identidad, email, telefono, cargo
3. contratos: id, contratista_id, secretaria_id, contrato_nro, vigencia (2026), objeto, valor_contrato, cdp_nro, crp_nro, poliza_nro, plazo_meses, supervisor_nombre
4. informes_mensuales: id, contrato_id, informe_nro, tipo_informe, fecha_presentacion, periodo_desde, periodo_hasta, estado, valor_pagar_certificado, observaciones
5. informe_obligaciones: id, informe_id, obligacion_descripcion, actividades_realizadas, soportes_texto, orden
6. informe_anexos: id, informe_id, titulo, imagen_url, orden (disposición 2 por página)
7. certificaciones_supervision: id, informe_id, supervisor_id, certifica_cumplimiento, periodo_certificado, valor_autorizado_pago, nro_radicado_financiera, fecha_certificacion`}
        </pre>
      </div>

      {/* MODAL PARA CREAR SECRETARÍA + ADMINISTRADOR */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-emerald-800">
                <Building2 size={22} />
                <div>
                  <h3 className="text-lg font-bold">Registrar Nueva Secretaría y Asignar Administrador</h3>
                  <p className="text-xs text-gray-500">Crea la dependencia y sus credenciales de acceso institucional</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSecretaria} className="mt-4 space-y-4 text-xs">
              
              {/* Sección 1: Datos de la Secretaría */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-gray-900 uppercase tracking-wide">
                  <Building2 size={16} className="text-emerald-700" />
                  <span>1. Datos de la Secretaría / Dependencia</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1">Nombre Oficial de la Secretaría *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. Secretaría de Educación Municipal"
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Código Dependencia *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. 140"
                      value={newCodigo}
                      onChange={(e) => setNewCodigo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-gray-700 mb-1">NIT Institucional</label>
                    <input
                      type="text"
                      value={newNit}
                      onChange={(e) => setNewNit(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Administrador Oficial de la Secretaría */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-950 uppercase tracking-wide">
                  <Shield size={16} className="text-emerald-700" />
                  <span>2. Administrador(a) de Despacho / Supervisor(a) Asignado(a)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Nombre Completo del Administrador(a) *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. MARÍA YANETH PALACIOS PALACIOS"
                      value={adminNombre}
                      onChange={(e) => setAdminNombre(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-bold uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Cédula de Ciudadanía *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. 45.123.789"
                      value={adminCedula}
                      onChange={(e) => setAdminCedula(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Correo Electrónico (Usuario de Acceso) *</label>
                    <input
                      type="email"
                      required
                      placeholder="ej. educacion@quibdo-choco.gov.co"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Contraseña de Acceso *</label>
                    <input
                      type="text"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Cargo / Función</label>
                    <input
                      type="text"
                      value={adminCargo}
                      onChange={(e) => setAdminCargo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Teléfono Institucional</label>
                    <input
                      type="text"
                      value={adminTelefono}
                      onChange={(e) => setAdminTelefono(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  <Plus size={15} />
                  <span>Crear Secretaría y Habilitar Acceso</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
