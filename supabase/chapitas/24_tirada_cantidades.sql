-- Capacidad por tirada hasta 165.
-- seq 1–100 (tirada N≥2): IDs numéricos históricos (200-299, 300-399…).
-- seq 101–165: TN-101 … TN-165 (sin solapar el bloque siguiente).

CREATE OR REPLACE FUNCTION public.chapita_id_de_tirada(p_tirada int, p_seq int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_tirada = 1 OR p_seq > 100 THEN
      'T' || p_tirada || '-' || lpad(p_seq::text, 3, '0')
    ELSE
      (p_tirada * 100 + (p_seq - 1))::text
  END;
$$;

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
  capacidad int := 165;
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

  FOR i IN 1..capacidad LOOP
    id_text := public.chapita_id_de_tirada(nueva_tirada, i);
    INSERT INTO public.chapitas (id) VALUES (id_text)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  desde_id := public.chapita_id_de_tirada(nueva_tirada, 1);
  hasta_id := public.chapita_id_de_tirada(nueva_tirada, capacidad);

  UPDATE public.chapita_inventario
  SET tirada_actual = nueva_tirada,
      max_id_numerico = CASE
        WHEN nueva_tirada = 1 THEN capacidad
        ELSE nueva_tirada * 100 + 99
      END
  WHERE id = 1;

  RETURN json_build_object(
    'tirada', nueva_tirada,
    'desde', desde_id,
    'hasta', hasta_id,
    'capacidad', capacidad,
    'tirada_actual', nueva_tirada
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.eliminar_ultima_tirada()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t int;
  i int;
  id_text text;
  capacidad int := 165;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT tirada_actual INTO t
  FROM public.chapita_inventario
  WHERE id = 1
  FOR UPDATE;

  IF t IS NULL OR t < 1 THEN
    RAISE EXCEPTION 'no hay tiradas para eliminar';
  END IF;

  FOR i IN 1..capacidad LOOP
    id_text := public.chapita_id_de_tirada(t, i);

    DELETE FROM public.mascotas
    WHERE id = id_text
       OR (t = 1 AND i <= 100 AND id = lpad(i::text, 3, '0'))
       OR lower(id) = lower('T' || t || '-' || lpad(i::text, 3, '0'));

    DELETE FROM public.chapitas
    WHERE id = id_text
       OR (t = 1 AND i <= 100 AND id = lpad(i::text, 3, '0'))
       OR lower(id) = lower('T' || t || '-' || lpad(i::text, 3, '0'));
  END LOOP;

  IF t <= 1 THEN
    UPDATE public.chapita_inventario
    SET tirada_actual = 1,
        max_id_numerico = 165
    WHERE id = 1;

    RETURN json_build_object(
      'ok', true,
      'tirada_eliminada', 1,
      'tirada_actual', 1,
      'reinicio', true
    );
  END IF;

  UPDATE public.chapita_inventario
  SET tirada_actual = t - 1,
      max_id_numerico = CASE
        WHEN t - 1 = 1 THEN 165
        ELSE (t - 1) * 100 + 99
      END
  WHERE id = 1;

  RETURN json_build_object(
    'ok', true,
    'tirada_eliminada', t,
    'tirada_actual', t - 1,
    'reinicio', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_lote_100_chapitas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_ultima_tirada() TO authenticated;
