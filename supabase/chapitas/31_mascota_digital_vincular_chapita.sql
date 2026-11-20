-- Mascotas digitales (sin chapita física) + RPC para vincular una chapita QR.
-- Requiere esquema de mascotas/chapitas (01–06) y tutores (09).

begin;

-- IDs digitales: DIG- + 12 hex (ej. DIG-a1b2c3d4e5f6)
alter table public.mascotas drop constraint if exists mascotas_id_check;
alter table public.mascotas add constraint mascotas_id_check
  check (
    id ~ '^(0[0-9]{2}|100)$'
    or id ~ '^[Tt][1-9][0-9]*-[0-9]{3}$'
    or id ~ '^[1-9][0-9]{2,3}$'
    or id ~ '^[a-z0-9]{8}$'
    or id ~ '^DIG-[a-f0-9]{12}$'
  );

-- Insert: chapitas físicas (política previa) + digitales con tutor.
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

-- Borrar solo digitales (para migrar al vincular chapita).
drop policy if exists "mascotas_delete_digital" on public.mascotas;
create policy "mascotas_delete_digital"
  on public.mascotas
  for delete
  to anon, authenticated
  using (id ~ '^DIG-[a-f0-9]{12}$');

create or replace function public.chapita_disponible_para_activar(p_chapita_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id text := btrim(p_chapita_id);
  v_ocupada boolean;
  v_tirada int;
  v_seq int;
begin
  if v_id is null or v_id = '' then
    return false;
  end if;

  if exists (select 1 from public.mascotas m where m.id = v_id) then
    return false;
  end if;

  -- Tirada 1 libre (legacy o T1-xxx)
  if v_id ~ '^(0[0-9]{2}|100)$' then
    return not public.chapita_id_ocupada(1, v_id::integer);
  end if;
  if v_id ~ '^[Tt]1-[0-9]{3}$' then
    v_seq := (regexp_match(v_id, '^[Tt]1-([0-9]{3})$'))[1]::integer;
    return not public.chapita_id_ocupada(1, v_seq);
  end if;

  -- Resto: debe existir en inventario chapitas
  if not exists (select 1 from public.chapitas c where c.id = v_id) then
    return false;
  end if;

  if v_id ~ '^[1-9][0-9]{2,3}$' and v_id::integer >= 200 then
    v_tirada := v_id::integer / 100;
    v_seq := (v_id::integer % 100) + 1;
    return not public.chapita_id_ocupada(v_tirada, v_seq);
  end if;

  if v_id ~ '^[Tt][2-9][0-9]*-[0-9]{3}$' then
    v_tirada := (regexp_match(v_id, '^[Tt]([0-9]+)-'))[1]::integer;
    v_seq := (regexp_match(v_id, '-([0-9]{3})$'))[1]::integer;
    return not public.chapita_id_ocupada(v_tirada, v_seq);
  end if;

  if v_id ~ '^[a-z0-9]{8}$' then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.vincular_chapita_a_mascota_digital(
  p_tutor_id uuid,
  p_mascota_digital_id text,
  p_chapita_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digital text := btrim(p_mascota_digital_id);
  v_chapita text := btrim(p_chapita_id);
  v_row public.mascotas%rowtype;
  v_new public.mascotas%rowtype;
begin
  if p_tutor_id is null or v_digital is null or v_chapita is null then
    raise exception 'Faltan datos para vincular la chapita.';
  end if;

  if v_digital !~ '^DIG-[a-f0-9]{12}$' then
    raise exception 'La mascota no es digital (sin chapita).';
  end if;

  if v_chapita ~ '^DIG-' then
    raise exception 'El código no es una chapita física válida.';
  end if;

  select * into v_row
  from public.mascotas
  where id = v_digital
    and tutor_id = p_tutor_id;

  if not found then
    raise exception 'No encontramos esa mascota digital para este tutor.';
  end if;

  if not public.chapita_disponible_para_activar(v_chapita) then
    raise exception 'Esa chapita no está disponible (ya usada o no registrada).';
  end if;

  insert into public.mascotas (
    id, tutor_id, nombre_mascota, especie, raza, sexo, castrado, temperamento,
    fecha_nacimiento, peso, nro_chip, enfermedad, medicacion, datos_adicionales,
    foto_url, nombre_dueno, email_tutor, telefono_contacto, telefono_secundario, qr_svg
  )
  values (
    v_chapita,
    v_row.tutor_id,
    v_row.nombre_mascota,
    v_row.especie,
    v_row.raza,
    v_row.sexo,
    v_row.castrado,
    v_row.temperamento,
    v_row.fecha_nacimiento,
    v_row.peso,
    v_row.nro_chip,
    v_row.enfermedad,
    v_row.medicacion,
    v_row.datos_adicionales,
    v_row.foto_url,
    v_row.nombre_dueno,
    v_row.email_tutor,
    v_row.telefono_contacto,
    v_row.telefono_secundario,
    null
  )
  returning * into v_new;

  -- Reapuntar referencias si las tablas existen.
  if to_regclass('public.tutor_vacunas') is not null then
    execute 'update public.tutor_vacunas set mascota_id = $1 where mascota_id = $2'
      using v_chapita, v_digital;
  end if;

  if to_regclass('public.clinica_pacientes') is not null then
    execute
      'update public.clinica_pacientes
       set mascota_chapita_id = $1, chapita_codigo = $1
       where mascota_chapita_id = $2 or chapita_codigo = $2'
      using v_chapita, v_digital;
  end if;

  delete from public.mascotas where id = v_digital;

  return json_build_object(
    'ok', true,
    'mascota_id', v_new.id,
    'nombre', v_new.nombre_mascota
  );
end;
$$;

grant execute on function public.chapita_disponible_para_activar(text) to anon, authenticated;
grant execute on function public.vincular_chapita_a_mascota_digital(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
