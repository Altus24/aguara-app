-- Temperamento de la mascota (registro chapita / digital / clínica).
-- Requiere 07_mascotas_ficha_extendida.sql (y 11 para clinica_pacientes).

begin;

alter table public.mascotas
  add column if not exists temperamento text;

alter table public.mascotas drop constraint if exists mascotas_temperamento_check;
alter table public.mascotas
  add constraint mascotas_temperamento_check
  check (
    temperamento is null
    or temperamento in ('Agresivo', 'Asustadizo', 'Nervioso', 'Tranquilo', 'Amigable')
  );

alter table public.clinica_pacientes
  add column if not exists temperamento text;

alter table public.clinica_pacientes
  add column if not exists castrado boolean;

alter table public.clinica_pacientes drop constraint if exists clinica_pacientes_temperamento_check;
alter table public.clinica_pacientes
  add constraint clinica_pacientes_temperamento_check
  check (
    temperamento is null
    or temperamento in ('Agresivo', 'Asustadizo', 'Nervioso', 'Tranquilo', 'Amigable')
  );

comment on column public.mascotas.temperamento is
  'Agresivo | Asustadizo | Nervioso | Tranquilo | Amigable';

-- Si ya corrieron 31, actualiza el RPC para copiar temperamento al vincular.
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

notify pgrst, 'reload schema';

commit;
