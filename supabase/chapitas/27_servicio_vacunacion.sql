-- Servicio base "Vacunación" por clínica + código para detectar tipo.
-- Al crear una cita con este servicio, la app registra vacuna + recordatorio.
-- Requiere 10_clinicas.sql.

begin;

alter table public.clinica_servicios
  add column if not exists codigo text;

create index if not exists clinica_servicios_codigo_idx
  on public.clinica_servicios (clinica_id, codigo)
  where codigo is not null;

-- Una sola Vacunación por clínica (si ya existe por nombre, le pone código).
update public.clinica_servicios
set codigo = 'vacunacion'
where codigo is null
  and lower(btrim(nombre)) in ('vacunacion', 'vacunación', 'vacuna', 'vacunas');

insert into public.clinica_servicios (clinica_id, nombre, descripcion, codigo, activo)
select
  c.id,
  'Vacunación',
  'Registra la vacuna en el historial del paciente y permite programar el recordatorio de refuerzo.',
  'vacunacion',
  true
from public.clinicas c
where not exists (
  select 1
  from public.clinica_servicios s
  where s.clinica_id = c.id
    and (
      s.codigo = 'vacunacion'
      or lower(btrim(s.nombre)) in ('vacunacion', 'vacunación', 'vacuna', 'vacunas')
    )
);

comment on column public.clinica_servicios.codigo is
  'Código interno del servicio (ej. vacunacion).';

notify pgrst, 'reload schema';

commit;
