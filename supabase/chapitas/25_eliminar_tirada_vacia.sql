-- Permite borrar T1 por completo (tirada_actual = 0) para reiniciar pruebas.
-- La próxima creación vuelve a ser T1 con la config nueva.

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

  -- Si era T1 (o la única), el inventario queda vacío: la próxima tirada será T1.
  IF t <= 1 THEN
    UPDATE public.chapita_inventario
    SET tirada_actual = 0,
        max_id_numerico = 0
    WHERE id = 1;

    RETURN json_build_object(
      'ok', true,
      'tirada_eliminada', 1,
      'tirada_actual', 0,
      'reinicio', true
    );
  END IF;

  UPDATE public.chapita_inventario
  SET tirada_actual = t - 1,
      max_id_numerico = CASE
        WHEN t - 1 <= 0 THEN 0
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

CREATE OR REPLACE FUNCTION public.reset_todas_las_tiradas()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM public.mascotas;
  DELETE FROM public.chapitas;

  INSERT INTO public.chapita_inventario (id, max_id_numerico, tirada_actual)
  VALUES (1, 0, 0)
  ON CONFLICT (id) DO UPDATE
  SET max_id_numerico = 0,
      tirada_actual = 0;

  RETURN json_build_object(
    'ok', true,
    'tirada_actual', 0,
    'max_id_numerico', 0
  );
END;
$$;

-- Asegurar que crear lote funciona con inventario vacío (0 → T1).
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

  SELECT COALESCE(tirada_actual, 0) INTO nueva_tirada
  FROM public.chapita_inventario
  WHERE id = 1
  FOR UPDATE;

  IF nueva_tirada IS NULL THEN
    INSERT INTO public.chapita_inventario (id, max_id_numerico, tirada_actual)
    VALUES (1, 0, 0);
    nueva_tirada := 0;
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

GRANT EXECUTE ON FUNCTION public.eliminar_ultima_tirada() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_todas_las_tiradas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_lote_100_chapitas() TO authenticated;
