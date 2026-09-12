-- El Informe Final es un documento único por contratista (no por contrato):
-- la restricción original UNIQUE (documento_identidad, contrato_nro) permitía
-- varias filas para el mismo contratista porque contrato_nro se guarda con
-- formato distinto según el momento del guardado (ej. "CPS 590 de 2026" vs
-- "590" vs "CPS de 2026"), así que el mismo informe terminaba insertado
-- varias veces en vez de actualizarse.
--
-- Nota: se confirmó contra la base de datos en producción que YA existe una
-- restricción única funcional sobre documento_identidad por sí solo (no
-- documentada en los scripts de migración versionados, probablemente
-- agregada manualmente en algún momento). Este script solo elimina la
-- restricción compuesta redundante y ya problemática; no agrega una nueva
-- para no duplicarla.

ALTER TABLE informes_finales DROP CONSTRAINT IF EXISTS uq_informe_final_contrato;

-- Si al ejecutar este bloque Postgres indica que documento_identidad ya no
-- tiene ninguna restricción única (verificarlo en el editor de Supabase,
-- pestaña "Database > Tables > informes_finales > Constraints"), descomentar
-- la siguiente línea para crearla:
-- ALTER TABLE informes_finales ADD CONSTRAINT uq_informe_final_documento UNIQUE (documento_identidad);
