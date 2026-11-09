-- Numeración por tirada: T1-001…T1-100 | tirada 2 → 200-299 | tirada 3 → 300-399

CREATE OR REPLACE FUNCTION public.chapita_id_de_tirada(p_tirada int, p_seq int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_tirada = 1 THEN 'T1-' || lpad(p_seq::text, 3, '0')
    ELSE (p_tirada * 100 + (p_seq - 1))::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.chapita_id_ocupada(p_tirada int, p_seq int)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mascotas m
    WHERE
      m.id = public.chapita_id_de_tirada(p_tirada, p_seq)
      OR (p_tirada = 1 AND m.id = lpad(p_seq::text, 3, '0'))
      OR lower(m.id) = lower('T' || p_tirada || '-' || lpad(p_seq::text, 3, '0'))
  );
$$;

ALTER TABLE mascotas DROP CONSTRAINT IF EXISTS mascotas_id_check;
ALTER TABLE mascotas ADD CONSTRAINT mascotas_id_check
  CHECK (
    id ~ '^(0[0-9]{2}|100)$'
    OR id ~ '^[Tt][1-9][0-9]*-[0-9]{3}$'
    OR id ~ '^[1-9][0-9]{2,3}$'
    OR id ~ '^[a-z0-9]{8}$'
  );

ALTER TABLE chapitas DROP CONSTRAINT IF EXISTS chapitas_id_check;
ALTER TABLE chapitas ADD CONSTRAINT chapitas_id_check
  CHECK (
    id ~ '^(0[0-9]{2}|100)$'
    OR id ~ '^[Tt][1-9][0-9]*-[0-9]{3}$'
    OR id ~ '^[1-9][0-9]{2,3}$'
    OR id ~ '^[a-z0-9]{8}$'
  );

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
      id ~ '^[Tt]1-[0-9]{3}$'
      AND NOT public.chapita_id_ocupada(
        1,
        (regexp_match(id, '^[Tt]1-([0-9]{3})$'))[1]::integer
      )
    )
    OR (
      id ~ '^[1-9][0-9]{2,3}$'
      AND id::integer >= 200
      AND NOT public.chapita_id_ocupada(
        id::integer / 100,
        (id::integer % 100) + 1
      )
      AND EXISTS (SELECT 1 FROM public.chapitas c WHERE c.id = mascotas.id)
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
  desde_id text;
  hasta_id text;
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
    id_text := public.chapita_id_de_tirada(nueva_tirada, i);
    INSERT INTO public.chapitas (id) VALUES (id_text)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  desde_id := public.chapita_id_de_tirada(nueva_tirada, 1);
  hasta_id := public.chapita_id_de_tirada(nueva_tirada, 100);

  UPDATE public.chapita_inventario
  SET tirada_actual = nueva_tirada,
      max_id_numerico = nueva_tirada * 100 + 99
  WHERE id = 1;

  RETURN json_build_object(
    'tirada', nueva_tirada,
    'desde', desde_id,
    'hasta', hasta_id,
    'tirada_actual', nueva_tirada
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_lote_100_chapitas() TO authenticated;
