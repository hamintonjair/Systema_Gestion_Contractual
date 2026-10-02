-- ==============================================================================
-- MIGRACIÓN: AGREGAR CAMPO firma_url A PROFILES Y POLÍTICAS DE BUCKET 'firma'
-- Alcaldía Municipal de Quibdó
-- ==============================================================================

-- 1. Agregar columna firma_url a la tabla profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS firma_url TEXT;

-- 2. Asegurar que el bucket 'firma' existe en Supabase Storage y es público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'firma', 
  'firma', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- 3. Políticas de acceso para el bucket 'firma' (Lectura pública, Inserción, Actualización y Eliminación)
DO $$
BEGIN
  -- Lectura pública
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Lectura publica bucket firma' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Lectura publica bucket firma" ON storage.objects
      FOR SELECT USING (bucket_id = 'firma');
  END IF;

  -- Inserción / Carga
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Subida bucket firma' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Subida bucket firma" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'firma');
  END IF;

  -- Actualización
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Actualizacion bucket firma' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Actualizacion bucket firma" ON storage.objects
      FOR UPDATE USING (bucket_id = 'firma');
  END IF;

  -- Eliminación
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Eliminacion bucket firma' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Eliminacion bucket firma" ON storage.objects
      FOR DELETE USING (bucket_id = 'firma');
  END IF;
END $$;
