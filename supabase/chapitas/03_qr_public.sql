-- Ejecutar en Supabase > SQL Editor
-- Permite que cualquier visitante genere chapitas desde /qr (rol anon)

DROP POLICY IF EXISTS "chapitas_public_insert" ON chapitas;

CREATE POLICY "chapitas_public_insert"
  ON chapitas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (id ~ '^[a-z0-9]{8}$');
