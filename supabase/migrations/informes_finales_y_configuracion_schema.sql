-- ==============================================================================
-- TABLAS PARA MÓDULO DE INTELIGENCIA ARTIFICIAL E INFORME FINAL DE EJECUCIÓN
-- ALCALDÍA MUNICIPAL DE QUIBDÓ
-- ==============================================================================

-- 1. TABLA: CONFIGURACIÓN GLOBAL DE IA (GOOGLE GEMINI)
-- Guarda la API Key institucional y el modelo activo seleccionado por el SuperAdmin
CREATE TABLE IF NOT EXISTS configuracion_ia (
  id TEXT PRIMARY KEY DEFAULT 'global_config',
  api_key TEXT NOT NULL,
  modelo TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

-- Habilitar RLS en configuracion_ia
ALTER TABLE configuracion_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica configuracion_ia" ON configuracion_ia;
CREATE POLICY "Lectura publica configuracion_ia" 
ON configuracion_ia FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Actualizacion configuracion_ia" ON configuracion_ia;
CREATE POLICY "Actualizacion configuracion_ia" 
ON configuracion_ia FOR ALL 
USING (true)
WITH CHECK (true);


-- 2. TABLA: INFORMES FINALES DE EJECUCIÓN CONTRACTUAL
-- Almacena todo el consolidado técnico, cuadro de actividades y alineación con el Plan de Desarrollo
CREATE TABLE IF NOT EXISTS informes_finales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  documento_identidad TEXT NOT NULL,
  contrato_nro TEXT NOT NULL,
  contratista_nombre TEXT,
  contratista_lugar_doc TEXT,
  dependencia TEXT,
  supervisor_nombre TEXT,
  supervisor_cargo TEXT,
  objeto_contractual TEXT,
  periodo_ejecucion TEXT,
  fecha_presentacion TEXT,
  meta_plan_desarrollo TEXT,
  indicador TEXT,
  introduccion TEXT,
  metodologia_enfoque TEXT,
  metodologia_estrategias TEXT,
  metodologia_zonas TEXT,
  metodologia_herramientas TEXT,
  cuadro_actividades JSONB DEFAULT '[]'::jsonb,
  productos_entregados JSONB DEFAULT '[]'::jsonb,
  resultados_alcanzados JSONB DEFAULT '[]'::jsonb,
  cumplimiento_meta TEXT,
  analisis_tecnico TEXT,
  impacto_ejecucion TEXT,
  conclusiones TEXT,
  recomendaciones JSONB DEFAULT '[]'::jsonb,
  anexos_fotograficos JSONB DEFAULT '[]'::jsonb,
  generado_con_ia BOOLEAN DEFAULT false,
  fecha_generacion_ia TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_informe_final_contrato UNIQUE (documento_identidad, contrato_nro)
);

ALTER TABLE informes_finales ADD COLUMN IF NOT EXISTS contratista_nombre TEXT;
ALTER TABLE informes_finales ADD COLUMN IF NOT EXISTS contratista_lugar_doc TEXT;
ALTER TABLE informes_finales ADD COLUMN IF NOT EXISTS dependencia TEXT;
ALTER TABLE informes_finales ADD COLUMN IF NOT EXISTS supervisor_nombre TEXT;
ALTER TABLE informes_finales ADD COLUMN IF NOT EXISTS supervisor_cargo TEXT;
ALTER TABLE informes_finales ADD COLUMN IF NOT EXISTS objeto_contractual TEXT;

-- Índices de búsqueda y rendimiento
CREATE INDEX IF NOT EXISTS idx_informes_finales_doc ON informes_finales(documento_identidad);
CREATE INDEX IF NOT EXISTS idx_informes_finales_contrato ON informes_finales(contrato_nro);

-- Habilitar RLS en informes_finales
ALTER TABLE informes_finales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura informes_finales" ON informes_finales;
CREATE POLICY "Lectura informes_finales" 
ON informes_finales FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Modificacion informes_finales" ON informes_finales;
CREATE POLICY "Modificacion informes_finales" 
ON informes_finales FOR ALL 
USING (true)
WITH CHECK (true);
