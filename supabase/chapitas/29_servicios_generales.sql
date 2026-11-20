-- Catálogo de servicios generales (compartidos) + copia por clínica.
-- Cada clínica elige ofrecerlos o no con clinica_servicios.activo.
-- Requiere 10_clinicas.sql y 27_servicio_vacunacion.sql (columna codigo).

begin;

alter table public.clinica_servicios
  add column if not exists codigo text;

create table if not exists public.servicios_generales (
  codigo text primary key,
  nombre text not null,
  descripcion text,
  orden integer not null default 100,
  activo_por_defecto boolean not null default true,
  constraint servicios_generales_nombre_not_blank check (char_length(btrim(nombre)) >= 2)
);

alter table public.servicios_generales enable row level security;

drop policy if exists "servicios_generales_select_public" on public.servicios_generales;
create policy "servicios_generales_select_public"
on public.servicios_generales for select to public using (true);

drop policy if exists "servicios_generales_all_public" on public.servicios_generales;
create policy "servicios_generales_all_public"
on public.servicios_generales for all to public using (true) with check (true);

grant select, insert, update, delete on public.servicios_generales to anon, authenticated;

insert into public.servicios_generales (codigo, nombre, descripcion, orden, activo_por_defecto)
values
  (
    'consulta',
    'Consulta general',
    'Consulta clínica de rutina.',
    10,
    true
  ),
  (
    'control',
    'Control / seguimiento',
    'Revisión de evolución o control post-tratamiento.',
    20,
    true
  ),
  (
    'vacunacion',
    'Vacunación',
    'Registra la vacuna en el historial y permite programar el recordatorio de refuerzo.',
    30,
    true
  ),
  (
    'desparasitacion',
    'Desparasitación',
    'Antiparasitarios internos o externos.',
    40,
    true
  ),
  (
    'urgencia',
    'Urgencia',
    'Atención de urgencia.',
    50,
    true
  ),
  (
    'cirugia',
    'Cirugía',
    'Procedimientos quirúrgicos.',
    60,
    false
  ),
  (
    'castracion',
    'Castración / esterilización',
    'Cirugía de castración o esterilización.',
    70,
    false
  ),
  (
    'laboratorio',
    'Análisis clínicos',
    'Laboratorio / análisis de sangre u otros.',
    80,
    false
  ),
  (
    'ecografia',
    'Ecografía',
    'Estudio ecográfico.',
    90,
    false
  ),
  (
    'radiografia',
    'Radiografía',
    'Estudio radiográfico.',
    100,
    false
  ),
  (
    'odontologia',
    'Odontología',
    'Limpieza o tratamientos dentales.',
    110,
    false
  ),
  (
    'peluqueria',
    'Peluquería',
    'Baño, corte y estética.',
    120,
    false
  ),
  (
    'internacion',
    'Internación',
    'Internación / hospitalización.',
    130,
    false
  ),
  (
    'domicilio',
    'Atención a domicilio',
    'Visita veterinaria a domicilio.',
    140,
    false
  ),
  (
    'microchip',
    'Microchip / identificación',
    'Colocación o lectura de microchip.',
    150,
    false
  ),
  (
    'certificado',
    'Certificados',
    'Aptos, certificados de salud o viaje.',
    160,
    false
  )
on conflict (codigo) do update
set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  orden = excluded.orden,
  activo_por_defecto = excluded.activo_por_defecto;

-- Normalizar Vacunación existente al código del catálogo.
update public.clinica_servicios
set codigo = 'vacunacion'
where codigo is null
  and lower(btrim(nombre)) in ('vacunacion', 'vacunación', 'vacuna', 'vacunas');

-- Vincular legacy por nombre exacto/alias antes de insertar (evita duplicados).
-- No usar LIKE '%vacun%' para no tragarse variantes propias (ej. antirrábica).
update public.clinica_servicios s
set codigo = g.codigo
from public.servicios_generales g
where s.codigo is null
  and (
    lower(btrim(s.nombre)) = lower(btrim(g.nombre))
    or lower(btrim(s.nombre)) = g.codigo
    or (
      g.codigo = 'vacunacion'
      and lower(btrim(s.nombre)) in ('vacunacion', 'vacunación', 'vacuna', 'vacunas')
    )
    or (g.codigo = 'consulta' and lower(btrim(s.nombre)) in ('consulta', 'consulta general'))
  );

-- Crear en cada clínica los servicios generales que aún no tenga
-- (ni por codigo ni por el mismo nombre).
insert into public.clinica_servicios (clinica_id, nombre, descripcion, codigo, activo)
select
  c.id,
  g.nombre,
  g.descripcion,
  g.codigo,
  g.activo_por_defecto
from public.clinicas c
cross join public.servicios_generales g
where not exists (
  select 1
  from public.clinica_servicios s
  where s.clinica_id = c.id
    and (
      s.codigo = g.codigo
      or lower(btrim(s.nombre)) = lower(btrim(g.nombre))
    )
);

-- Alinear nombre/descripcion de filas ya existentes con el catálogo (sin tocar activo ni precio).
update public.clinica_servicios s
set
  nombre = g.nombre,
  descripcion = coalesce(s.descripcion, g.descripcion)
from public.servicios_generales g
where s.codigo = g.codigo;

create index if not exists clinica_servicios_codigo_idx
  on public.clinica_servicios (clinica_id, codigo)
  where codigo is not null;

comment on table public.servicios_generales is
  'Catálogo de servicios estándar. Cada clínica los copia y elige ofrecerlos (activo).';

notify pgrst, 'reload schema';

commit;
