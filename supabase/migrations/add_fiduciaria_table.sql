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
