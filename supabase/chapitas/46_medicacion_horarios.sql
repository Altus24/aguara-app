-- Horarios de toma + de por vida en medicación / tratamientos / recordatorios.

begin;

-- Tratamientos (clínica + tutor)
alter table public.clinica_tratamientos
  add column if not exists horarios text[] not null default '{}';

alter table public.tutor_tratamientos
  add column if not exists horarios text[] not null default '{}';

comment on column public.clinica_tratamientos.horarios is
  'Horarios de toma (HH:MM), p. ej. {08:00,20:00}.';
comment on column public.tutor_tratamientos.horarios is
  'Horarios de toma (HH:MM), p. ej. {08:00,20:00}.';

-- Recordatorios (clínica + tutor): horarios + de por vida
alter table public.clinica_recordatorios
  add column if not exists horarios text[] not null default '{}';

alter table public.clinica_recordatorios
  add column if not exists de_por_vida boolean not null default false;

alter table public.tutor_recordatorios
  add column if not exists horarios text[] not null default '{}';

alter table public.tutor_recordatorios
  add column if not exists de_por_vida boolean not null default false;

comment on column public.clinica_recordatorios.horarios is
  'Horarios de toma (HH:MM) cuando tipo = medicacion.';
comment on column public.tutor_recordatorios.horarios is
  'Horarios de toma (HH:MM) cuando tipo = medicacion.';
comment on column public.clinica_recordatorios.de_por_vida is
  'Medicación / recordatorio permanente (sin fecha de fin).';
comment on column public.tutor_recordatorios.de_por_vida is
  'Medicación / recordatorio permanente (sin fecha de fin).';

notify pgrst, 'reload schema';

commit;
