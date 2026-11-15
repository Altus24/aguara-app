-- Eliminar la última tirada (solo superadmin).
-- Borra mascotas/chapitas de ese lote y baja tirada_actual.

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

  FOR i IN 1..100 LOOP
    id_text := public.chapita_id_de_tirada(t, i);

    DELETE FROM public.mascotas
    WHERE id = id_text
       OR (t = 1 AND id = lpad(i::text, 3, '0'))
       OR lower(id) = lower('T' || t || '-' || lpad(i::text, 3, '0'));

    DELETE FROM public.chapitas
    WHERE id = id_text
       OR (t = 1 AND id = lpad(i::text, 3, '0'))
       OR lower(id) = lower('T' || t || '-' || lpad(i::text, 3, '0'));
  END LOOP;

  IF t <= 1 THEN
    UPDATE public.chapita_inventario
    SET tirada_actual = 1,
        max_id_numerico = 100
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
        WHEN t - 1 = 1 THEN 100
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

GRANT EXECUTE ON FUNCTION public.eliminar_ultima_tirada() TO authenticated;
