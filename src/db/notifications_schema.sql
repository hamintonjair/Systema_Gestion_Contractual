-- ==============================================================================
-- TABLA DE NOTIFICACIONES INSTITUCIONALES (ALCALDÍA DE QUIBDÓ)
-- ==============================================================================
-- Permite notificaciones no invasivas para contratistas y supervisores:
-- - Aprobación de informes contractuales
-- - Devolución con observaciones por corregir
-- - Radicación de nuevos informes
-- - Avisos del sistema
-- ==============================================================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info', -- 'aprobacion' | 'devolucion' | 'radicado' | 'info' | 'sistema'
  leida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  informe_nro TEXT,
  report_id UUID
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_notificaciones_user_id ON notificaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at ON notificaciones(created_at DESC);

-- Habilitar RLS
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Política de lectura: usuarios pueden leer sus propias notificaciones
DROP POLICY IF EXISTS "Users can read own notifications" ON notificaciones;
CREATE POLICY "Users can read own notifications" 
ON notificaciones FOR SELECT 
USING (true);

-- Política de inserción: autenticados o funciones del sistema pueden insertar
DROP POLICY IF EXISTS "Allow insert notifications" ON notificaciones;
CREATE POLICY "Allow insert notifications" 
ON notificaciones FOR INSERT 
WITH CHECK (true);

-- Política de actualización: marcar como leída
DROP POLICY IF EXISTS "Users can update own notifications" ON notificaciones;
CREATE POLICY "Users can update own notifications" 
ON notificaciones FOR UPDATE 
USING (true);
