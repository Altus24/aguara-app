-- IDs con tirada: T1-001 … T1-100 (tirada 1 sigue aceptando 001–100 grabados)
-- Incluye tabla chapita_inventario (no hace falta migration_chapita_inventario.sql)

CREATE TABLE IF NOT EXISTS public.chapita_inventario (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_id_numerico int NOT NULL DEFAULT 100,
  tirada_actual int NOT NULL DEFAULT 1
);

ALTER TABLE public.chapita_inventario
  ADD COLUMN IF NOT EXISTS max_id_numerico int NOT NULL DEFAULT 100;

ALTER TABLE public.chapita_inventario
  ADD COLUMN IF NOT EXISTS tirada_actual int NOT NULL DEFAULT 1;

INSERT INTO public.chapita_inventario (id, max_id_numerico, tirada_actual)
VALUES (1, 100, 1)
ON CONFLICT (id) DO NOTHING;

UPDATE public.chapita_inventario
SET tirada_actual = GREATEST(
  tirada_actual,
  1,
  COALESCE((max_id_numerico + 99) / 100, 1)
)
WHERE id = 1;

ALTER TABLE public.chapita_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chapita_inventario_select_admin" ON public.chapita_inventario;
CREATE POLICY "chapita_inventario_select_admin"
  ON public.chapita_inventario
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin());

ALTER TABLE mascotas DROP CONSTRAINT IF EXISTS mascotas_id_check;
ALTER TABLE mascotas ADD CONSTRAINT mascotas_id_check
  CHECK (
    id ~ '^(0[0-9]{2}|100)$'
    OR id ~ '^[Tt][1-9][0-9]*-[0-9]{3}$'
    OR id ~ '^[a-z0-9]{8}$'
  );

ALTER TABLE chapitas DROP CONSTRAINT IF EXISTS chapitas_id_check;
ALTER TABLE chapitas ADD CONSTRAINT chapitas_id_check
  CHECK (
    id ~ '^(0[0-9]{2}|100)$'
    OR id ~ '^[Tt][1-9][0-9]*-[0-9]{3}$'
    OR id ~ '^[a-z0-9]{8}$'
  );

CREATE OR REPLACE FUNCTION public.chapita_id_ocupada(p_tirada int, p_seq int)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mascotas m
    WHERE
      m.id = lpad(p_seq::text, 3, '0')
      OR lower(m.id) = lower('T' || p_tirada || '-' || lpad(p_seq::text, 3, '0'))
  );
$$;

DROP POLICY IF EXISTS "mascotas_insert_activation" ON mascotas;

CREATE POLICY "mascotas_insert_activation"
  ON mascotas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (
      id ~ '^(0[0-9]{2}|100)$'
      AND NOT public.chapita_id_ocupada(1, id::integer)
    )
    OR (
      id ~ '^[Tt][1-9][0-9]*-[0-9]{3}$'
      AND NOT public.chapita_id_ocupada(
        (regexp_match(id, '^[Tt]([1-9][0-9]*)-[0-9]{3}$'))[1]::integer,
        (regexp_match(id, '^[Tt][1-9][0-9]*-([0-9]{3})$'))[1]::integer
      )
      AND (
        lower(id) ~ '^t1-'
        OR EXISTS (SELECT 1 FROM public.chapitas c WHERE lower(c.id) = lower(mascotas.id))
      )
    )
    OR (
      id ~ '^[a-z0-9]{8}$'
      AND EXISTS (SELECT 1 FROM public.chapitas c WHERE c.id = mascotas.id)
    )
  );

CREATE OR REPLACE FUNCTION public.crear_lote_100_chapitas()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nueva_tirada int;
  i int;
  id_text text;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT tirada_actual INTO nueva_tirada
  FROM public.chapita_inventario
  WHERE id = 1
  FOR UPDATE;

  IF nueva_tirada IS NULL THEN
    RAISE EXCEPTION 'inventario no configurado';
  END IF;

  IF nueva_tirada >= 99 THEN
    RAISE EXCEPTION 'limite de tiradas alcanzado (99)';
  END IF;

  nueva_tirada := nueva_tirada + 1;

  FOR i IN 1..100 LOOP
    id_text := 'T' || nueva_tirada || '-' || lpad(i::text, 3, '0');
    INSERT INTO public.chapitas (id) VALUES (id_text)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  UPDATE public.chapita_inventario
  SET tirada_actual = nueva_tirada,
      max_id_numerico = nueva_tirada * 100
  WHERE id = 1;

  RETURN json_build_object(
    'tirada', nueva_tirada,
    'desde', 'T' || nueva_tirada || '-001',
    'hasta', 'T' || nueva_tirada || '-100',
    'tirada_actual', nueva_tirada
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reservar_chapita_publica()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_tirada int;
  t int;
  s int;
  id_text text;
BEGIN
  SELECT tirada_actual INTO max_tirada
  FROM public.chapita_inventario
  WHERE id = 1;

  IF max_tirada IS NULL THEN
    max_tirada := 1;
  END IF;

  FOR t IN 1..max_tirada LOOP
    FOR s IN 1..100 LOOP
      IF public.chapita_id_ocupada(t, s) THEN
        CONTINUE;
      END IF;

      id_text := 'T' || t || '-' || lpad(s::text, 3, '0');

      IF t = 1 THEN
        INSERT INTO public.chapitas (id) VALUES (id_text)
        ON CONFLICT (id) DO NOTHING;
        RETURN id_text;
      END IF;

      IF EXISTS (SELECT 1 FROM public.chapitas c WHERE lower(c.id) = lower(id_text)) THEN
        RETURN id_text;
      END IF;
    END LOOP;
  END LOOP;

  RAISE EXCEPTION 'sin chapitas disponibles en las tiradas activas';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reservar_chapita_publica() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_lote_100_chapitas() TO authenticated;
