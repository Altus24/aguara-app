-- Ejecutar en Supabase > SQL Editor (proyecto ya existente)

-- Ampliar IDs: 001-100 o código dinámico de 8 caracteres
ALTER TABLE mascotas DROP CONSTRAINT IF EXISTS mascotas_id_check;
ALTER TABLE mascotas ADD CONSTRAINT mascotas_id_check
  CHECK (id ~ '^(0[0-9]{2}|100|[a-z0-9]{8})$');

CREATE TABLE IF NOT EXISTS chapitas (
  id TEXT PRIMARY KEY CHECK (id ~ '^(0[0-9]{2}|100|[a-z0-9]{8})$'),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_por UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE chapitas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin();
$$;

GRANT EXECUTE ON FUNCTION public.check_is_superadmin() TO authenticated;

DROP POLICY IF EXISTS "mascotas_insert_activation" ON mascotas;

CREATE POLICY "mascotas_insert_activation"
  ON mascotas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    id ~ '^(0[0-9]{2}|100)$'
    OR EXISTS (SELECT 1 FROM public.chapitas c WHERE c.id = mascotas.id)
  );

CREATE POLICY "mascotas_admin_update"
  ON mascotas
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "mascotas_admin_delete"
  ON mascotas
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "chapitas_select_public"
  ON chapitas
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "chapitas_admin_insert"
  ON chapitas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin());

CREATE POLICY "chapitas_public_insert"
  ON chapitas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (id ~ '^[a-z0-9]{8}$');

CREATE POLICY "chapitas_admin_delete"
  ON chapitas
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

-- Crear superadmin:
-- 1) Authentication > Users > Add user (email + password)
-- 2) INSERT INTO admin_users (user_id) VALUES ('uuid-del-usuario');
