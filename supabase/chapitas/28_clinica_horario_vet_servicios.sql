-- Horario de apertura del local (clinica_horarios.veterinario_id IS NULL)
-- + servicios que ofrece cada veterinario.
-- Requiere 10_clinicas.sql, 11_clinica_operativa.sql, 17_veterinario_horarios.sql.

begin;

-- Asegurar columna de horario por vet (por si no corrieron el 17).
alter table public.clinica_horarios
  add column if not exists veterinario_id uuid
    references public.clinica_veterinarios (id) on delete cascade;

comment on column public.clinica_horarios.veterinario_id is
  'NULL = horario de apertura/cierre de la clínica. Con valor = agenda del veterinario.';

create table if not exists public.clinica_veterinario_servicios (
  veterinario_id uuid not null
    references public.clinica_veterinarios (id) on delete cascade,
  servicio_id uuid not null
    references public.clinica_servicios (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (veterinario_id, servicio_id)
);

create index if not exists clinica_veterinario_servicios_servicio_idx
  on public.clinica_veterinario_servicios (servicio_id);

alter table public.clinica_veterinario_servicios enable row level security;

drop policy if exists "clinica_veterinario_servicios_all_public"
  on public.clinica_veterinario_servicios;
create policy "clinica_veterinario_servicios_all_public"
on public.clinica_veterinario_servicios for all to public
using (true) with check (true);

grant select, insert, update, delete
  on public.clinica_veterinario_servicios to anon, authenticated;

notify pgrst, 'reload schema';

commit;
