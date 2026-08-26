-- ==============================================================================
-- ALCALDÍA MUNICIPAL DE QUIBDÓ - CHOCÓ (NIT: 891680011-0)
-- ESQUEMA Y MIGRACIÓN ROBUSTA POSTGRESQL SUPABASE (7 TABLAS ESTRUCTURALES)
-- ==============================================================================

-- 1. Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- TABLA 1: sec_secretarias (Multi-Tenant Core por Dependencia)
-- ==============================================================================
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

-- Asegurar columnas si la tabla ya existía
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS nit TEXT DEFAULT '891680011-0';
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT '100';
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sec_secretarias ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_sec_secretarias_codigo ON sec_secretarias (codigo);

-- ==============================================================================
-- TABLA 2: profiles (Perfiles y Usuarios: Contratistas / Admins / Super Admin)
-- ==============================================================================
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

-- Asegurar columnas si la tabla ya existía en Supabase
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

-- ==============================================================================
-- TABLA 3: contratos (Contratos de Prestación de Servicios Profesionales / Apoyo)
-- ==============================================================================
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

-- Asegurar columnas si la tabla ya existía
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

-- ==============================================================================
-- TABLA 4: informes_mensuales (Cabecera de Informes Contractuales Radicados)
-- ==============================================================================
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

-- Asegurar columnas si la tabla ya existía
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

-- ==============================================================================
-- TABLA 5: informe_obligaciones (Obligaciones Contractuales Específicas 1:N)
-- ==============================================================================
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

-- ==============================================================================
-- TABLA 6: informe_anexos (Evidencias y Soportes Fotográficos en Cuadrícula 2 por Hoja)
-- ==============================================================================
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

-- ==============================================================================
-- TABLA 7: certificaciones_supervision (Certificados de Cumplimiento y Trámite de Pago)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS certificaciones_supervision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contratista_documento TEXT,
  pago_nro TEXT DEFAULT '1',
  periodo_certificado TEXT,
  valor_autorizado_pago NUMERIC(14, 2) DEFAULT 0,
  valor_total_contrato NUMERIC(14, 2) DEFAULT 0,
  saldo_por_pagar NUMERIC(14, 2) DEFAULT 0,
  porcentaje_ejecucion TEXT,
  nro_radicado_financiera TEXT,
  observaciones_supervision TEXT,
  observaciones_liquidacion TEXT,
  expedicion_dia TEXT,
  expedicion_mes TEXT,
  expedicion_ano TEXT,
  datos_formulario JSONB DEFAULT '{}'::jsonb,
  certifica_cumplimiento BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_certificacion TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS contratista_documento TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS pago_nro TEXT DEFAULT '1';
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS periodo_certificado TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS valor_autorizado_pago NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS valor_total_contrato NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS saldo_por_pagar NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS porcentaje_ejecucion TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS nro_radicado_financiera TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS observaciones_supervision TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS observaciones_liquidacion TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS expedicion_dia TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS expedicion_mes TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS expedicion_ano TEXT;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS datos_formulario JSONB DEFAULT '{}'::jsonb;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS certifica_cumplimiento BOOLEAN DEFAULT TRUE;
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS fecha_certificacion TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE certificaciones_supervision ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_certificaciones_informe ON certificaciones_supervision(informe_id);
CREATE INDEX IF NOT EXISTS idx_certificaciones_doc ON certificaciones_supervision(contratista_documento);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - POLÍTICAS DE ACCESO
-- ==============================================================================
ALTER TABLE sec_secretarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE informe_obligaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE informe_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificaciones_supervision ENABLE ROW LEVEL SECURITY;

-- Limpieza preventiva de políticas
DROP POLICY IF EXISTS "Lectura general secretarias" ON sec_secretarias;
DROP POLICY IF EXISTS "Insertar y actualizar secretarias" ON sec_secretarias;
DROP POLICY IF EXISTS "Lectura perfiles" ON profiles;
DROP POLICY IF EXISTS "Insertar y actualizar profiles" ON profiles;
DROP POLICY IF EXISTS "Lectura contratos" ON contratos;
DROP POLICY IF EXISTS "Insertar y actualizar contratos" ON contratos;
DROP POLICY IF EXISTS "Lectura informes" ON informes_mensuales;
DROP POLICY IF EXISTS "Insertar y actualizar informes" ON informes_mensuales;
DROP POLICY IF EXISTS "Lectura obligaciones" ON informe_obligaciones;
DROP POLICY IF EXISTS "Insertar y actualizar obligaciones" ON informe_obligaciones;
DROP POLICY IF EXISTS "Lectura anexos" ON informe_anexos;
DROP POLICY IF EXISTS "Insertar y actualizar anexos" ON informe_anexos;
DROP POLICY IF EXISTS "Lectura certificaciones" ON certificaciones_supervision;
DROP POLICY IF EXISTS "Insertar y actualizar certificaciones" ON certificaciones_supervision;

-- Creación de políticas de acceso permisivas para el sistema
CREATE POLICY "Lectura general secretarias" ON sec_secretarias FOR ALL USING (true);
CREATE POLICY "Lectura perfiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Lectura contratos" ON contratos FOR ALL USING (true);
CREATE POLICY "Lectura informes" ON informes_mensuales FOR ALL USING (true);
CREATE POLICY "Lectura obligaciones" ON informe_obligaciones FOR ALL USING (true);
CREATE POLICY "Lectura anexos" ON informe_anexos FOR ALL USING (true);
CREATE POLICY "Lectura certificaciones" ON certificaciones_supervision FOR ALL USING (true);

-- ==============================================================================
-- INSERCIÓN DE DATOS INICIALES (SEEDS DE SECRETARÍAS)
-- ==============================================================================
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
  nit = EXCLUDED.nit;

-- ==============================================================================
-- STORAGE BUCKETS Y POLÍTICAS DE ACCESO PARA ARCHIVOS
-- ==============================================================================

-- Aseguramos que el bucket es público
UPDATE storage.buckets SET public = true WHERE id = 'anexos';

-- Limpiamos las políticas anteriores
DROP POLICY IF EXISTS "anexos_select" ON storage.objects;
DROP POLICY IF EXISTS "anexos_insert" ON storage.objects;
DROP POLICY IF EXISTS "anexos_delete" ON storage.objects;
DROP POLICY IF EXISTS "anexos_update" ON storage.objects;

-- Damos permiso para que CUALQUIERA pueda insertar (subir) imágenes al bucket 'anexos'
CREATE POLICY "anexos_insert" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'anexos');

-- Damos permiso para que CUALQUIERA pueda actualizar imágenes en el bucket 'anexos'
CREATE POLICY "anexos_update" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'anexos');

-- Damos permiso para que CUALQUIERA pueda borrar imágenes en el bucket 'anexos'
CREATE POLICY "anexos_delete" ON storage.objects FOR DELETE TO public USING (bucket_id = 'anexos');

-- Para quitar el warning de "list all files", hacemos que el SELECT sea específico
CREATE POLICY "anexos_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'anexos');
CREATE TABLE IF NOT EXISTS soportes_fiduciaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE,
  contratista_documento TEXT,
  pago_nro TEXT DEFAULT '1',
  datos_formulario JSONB DEFAULT '{}'::jsonb,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE soportes_fiduciaria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura soportes fiduciaria" ON soportes_fiduciaria;
CREATE POLICY "Lectura y escritura soportes fiduciaria" ON soportes_fiduciaria FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_soportes_fiduciaria_informe ON soportes_fiduciaria(informe_id);
CREATE INDEX IF NOT EXISTS idx_soportes_fiduciaria_doc ON soportes_fiduciaria(contratista_documento);

CREATE TABLE IF NOT EXISTS declaraciones_renta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id UUID REFERENCES informes_mensuales(id) ON DELETE CASCADE,
  contratista_documento TEXT,
  pago_nro TEXT DEFAULT '1',
  datos_formulario JSONB DEFAULT '{}'::jsonb,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE declaraciones_renta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura declaraciones renta" ON declaraciones_renta;
CREATE POLICY "Lectura y escritura declaraciones renta" ON declaraciones_renta FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_declaraciones_renta_informe ON declaraciones_renta(informe_id);
CREATE INDEX IF NOT EXISTS idx_declaraciones_renta_doc ON declaraciones_renta(contratista_documento);
