-- Recordatorios de medicación (y otros) cargados por el tutor.
-- Paralelo a clinica_recordatorios. Requiere 09_tutores.sql (+ 11 clínica opcional).

begin;

create table if not exists public.tutor_recordatorios (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  mascota_id text references public.mascotas (id) on delete cascade,
  paciente_id uuid references public.clinica_pacientes (id) on delete set null,
  tipo text not null default 'medicacion'
    check (tipo in ('vacuna', 'control', 'medicacion', 'otro')),
  titulo text not null,
  detalle text,
  fecha_proxima date,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint tutor_recordatorios_titulo_not_blank check (char_length(btrim(titulo)) >= 2),
  constraint tutor_recordatorios_vinculo check (mascota_id is not null or paciente_id is not null)
);

create index if not exists tutor_recordatorios_tutor_idx
  on public.tutor_recordatorios (tutor_id, activo, fecha_proxima);

create index if not exists tutor_recordatorios_mascota_idx
  on public.tutor_recordatorios (mascota_id, activo);

create index if not exists tutor_recordatorios_paciente_idx
  on public.tutor_recordatorios (paciente_id, activo);

alter table public.tutor_recordatorios enable row level security;

drop policy if exists "tutor_recordatorios_all_public" on public.tutor_recordatorios;
create policy "tutor_recordatorios_all_public"
on public.tutor_recordatorios for all to public using (true) with check (true);

grant select, insert, update, delete on public.tutor_recordatorios to anon, authenticated;

comment on table public.tutor_recordatorios is
  'Recordatorios (p. ej. medicación) cargados por el tutor (paralelo a clinica_recordatorios).';

notify pgrst, 'reload schema';

commit;
