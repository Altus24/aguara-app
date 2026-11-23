-- Formato canónico de tiradas: T1-001, T3-005, T12-165, etc.
-- Los IDs numéricos históricos (200-299…) se siguen aceptando al leer/activar.
--
-- Si ves deadlock: pausá `npm run dev` / cerrá el SQL Editor paralelo y reejecutá.
-- Este script usa transacciones cortas para reducir locks.

-- 1) Formato de IDs
begin;
create or replace function public.chapita_id_de_tirada(p_tirada int, p_seq int)
returns text
language sql
immutable
as $$
  select 'T' || p_tirada || '-' || lpad(p_seq::text, 3, '0');
$$;

create or replace function public.chapita_id_numerico_legacy(p_tirada int, p_seq int)
returns text
language sql
immutable
as $$
  select case
    when p_tirada >= 2 and p_seq between 1 and 100
      then (p_tirada * 100 + (p_seq - 1))::text
    else null
  end;
$$;

create or replace function public.chapita_id_ocupada(p_tirada int, p_seq int)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.mascotas m
    where
      m.id = public.chapita_id_de_tirada(p_tirada, p_seq)
      or lower(m.id) = lower(public.chapita_id_de_tirada(p_tirada, p_seq))
      or (p_tirada = 1 and p_seq between 1 and 100 and m.id = lpad(p_seq::text, 3, '0'))
      or (
        public.chapita_id_numerico_legacy(p_tirada, p_seq) is not null
        and m.id = public.chapita_id_numerico_legacy(p_tirada, p_seq)
      )
  );
$$;
commit;

-- 2) Política de insert (lock exclusivo breve sobre mascotas)
begin;
drop policy if exists "mascotas_insert_activation" on public.mascotas;
create policy "mascotas_insert_activation"
  on public.mascotas
  for insert
  to anon, authenticated
  with check (
    (
      id ~ '^(0[0-9]{2}|100)$'
      and not public.chapita_id_ocupada(1, id::integer)
    )
    or (
      id ~ '^[Tt]1-[0-9]{3}$'
      and not public.chapita_id_ocupada(
        1,
        (regexp_match(id, '^[Tt]1-([0-9]{3})$'))[1]::integer
      )
    )
    or (
      id ~ '^[Tt][1-9][0-9]*-[0-9]{3}$'
      and exists (select 1 from public.chapitas c where c.id = mascotas.id)
      and not public.chapita_id_ocupada(
        (regexp_match(id, '^[Tt]([0-9]+)-'))[1]::integer,
        (regexp_match(id, '-([0-9]{3})$'))[1]::integer
      )
    )
    or (
      id ~ '^[1-9][0-9]{2,3}$'
      and id::integer >= 200
      and not public.chapita_id_ocupada(
        id::integer / 100,
        (id::integer % 100) + 1
      )
      and exists (select 1 from public.chapitas c where c.id = mascotas.id)
    )
    or (
      id ~ '^[a-z0-9]{8}$'
      and exists (select 1 from public.chapitas c where c.id = mascotas.id)
    )
    or (
      id ~ '^DIG-[a-f0-9]{12}$'
      and tutor_id is not null
    )
  );
commit;

-- 3) Disponibilidad
begin;
create or replace function public.chapita_disponible_para_activar(p_chapita_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id text := btrim(p_chapita_id);
  v_tirada int;
  v_seq int;
begin
  if v_id is null or v_id = '' then
    return false;
  end if;

  if exists (select 1 from public.mascotas m where m.id = v_id) then
    return false;
  end if;

  if v_id ~ '^(0[0-9]{2}|100)$' then
    return not public.chapita_id_ocupada(1, v_id::integer);
  end if;

  if v_id ~ '^[Tt][1-9][0-9]*-[0-9]{3}$' then
    v_tirada := (regexp_match(v_id, '^[Tt]([0-9]+)-'))[1]::integer;
    v_seq := (regexp_match(v_id, '-([0-9]{3})$'))[1]::integer;
    if v_tirada = 1 then
      return not public.chapita_id_ocupada(1, v_seq);
    end if;
    if not exists (select 1 from public.chapitas c where c.id = v_id) then
      return false;
    end if;
    return not public.chapita_id_ocupada(v_tirada, v_seq);
  end if;

  if not exists (select 1 from public.chapitas c where c.id = v_id) then
    return false;
  end if;

  if v_id ~ '^[1-9][0-9]{2,3}$' and v_id::integer >= 200 then
    v_tirada := v_id::integer / 100;
    v_seq := (v_id::integer % 100) + 1;
    return not public.chapita_id_ocupada(v_tirada, v_seq);
  end if;

  if v_id ~ '^[a-z0-9]{8}$' then
    return true;
  end if;

  return false;
end;
$$;
commit;

-- 4) Crear lote
begin;
create or replace function public.crear_lote_100_chapitas()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_tirada int;
  i int;
  id_text text;
  desde_id text;
  hasta_id text;
  capacidad int := 165;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  select coalesce(tirada_actual, 0) into nueva_tirada
  from public.chapita_inventario
  where id = 1
  for update;

  if nueva_tirada is null then
    insert into public.chapita_inventario (id, max_id_numerico, tirada_actual)
    values (1, 0, 0);
    nueva_tirada := 0;
  end if;

  if nueva_tirada >= 99 then
    raise exception 'limite de tiradas alcanzado (99)';
  end if;

  nueva_tirada := nueva_tirada + 1;

  for i in 1..capacidad loop
    id_text := public.chapita_id_de_tirada(nueva_tirada, i);
    insert into public.chapitas (id) values (id_text)
    on conflict (id) do nothing;
  end loop;

  desde_id := public.chapita_id_de_tirada(nueva_tirada, 1);
  hasta_id := public.chapita_id_de_tirada(nueva_tirada, capacidad);

  update public.chapita_inventario
  set tirada_actual = nueva_tirada,
      max_id_numerico = capacidad * nueva_tirada
  where id = 1;

  return json_build_object(
    'tirada', nueva_tirada,
    'desde', desde_id,
    'hasta', hasta_id,
    'capacidad', capacidad,
    'tirada_actual', nueva_tirada
  );
end;
$$;
commit;

-- 5) Eliminar última tirada
begin;
create or replace function public.eliminar_ultima_tirada()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  t int;
  i int;
  id_text text;
  id_legacy text;
  capacidad int := 165;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  select tirada_actual into t
  from public.chapita_inventario
  where id = 1
  for update;

  if t is null or t < 1 then
    raise exception 'no hay tiradas para eliminar';
  end if;

  for i in 1..capacidad loop
    id_text := public.chapita_id_de_tirada(t, i);
    id_legacy := public.chapita_id_numerico_legacy(t, i);

    delete from public.mascotas
    where id = id_text
       or lower(id) = lower(id_text)
       or (t = 1 and i <= 100 and id = lpad(i::text, 3, '0'))
       or (id_legacy is not null and id = id_legacy);

    delete from public.chapitas
    where id = id_text
       or lower(id) = lower(id_text)
       or (t = 1 and i <= 100 and id = lpad(i::text, 3, '0'))
       or (id_legacy is not null and id = id_legacy);
  end loop;

  if t <= 1 then
    update public.chapita_inventario
    set tirada_actual = 0,
        max_id_numerico = 0
    where id = 1;

    return json_build_object(
      'ok', true,
      'tirada_eliminada', 1,
      'tirada_actual', 0,
      'reinicio', true
    );
  end if;

  update public.chapita_inventario
  set tirada_actual = t - 1,
      max_id_numerico = (t - 1) * capacidad
  where id = 1;

  return json_build_object(
    'ok', true,
    'tirada_eliminada', t,
    'tirada_actual', t - 1,
    'reinicio', false
  );
end;
$$;

grant execute on function public.crear_lote_100_chapitas() to authenticated;
grant execute on function public.eliminar_ultima_tirada() to authenticated;
grant execute on function public.chapita_disponible_para_activar(text) to anon, authenticated;
commit;

-- 6) Reload PostgREST
notify pgrst, 'reload schema';
