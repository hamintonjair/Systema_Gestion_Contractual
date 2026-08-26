ALTER TABLE soportes_fiduciaria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura soportes fiduciaria" ON soportes_fiduciaria;
CREATE POLICY "Lectura y escritura soportes fiduciaria" ON soportes_fiduciaria FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_soportes_fiduciaria_informe ON soportes_fiduciaria(informe_id);
CREATE INDEX IF NOT EXISTS idx_soportes_fiduciaria_doc ON soportes_fiduciaria(contratista_documento);
