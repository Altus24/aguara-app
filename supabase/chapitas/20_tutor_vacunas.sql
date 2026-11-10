-- Vacunas cargadas manualmente por el tutor.
-- Requiere 09_tutores.sql (+ 11 clínica opcional para paciente_id).

begin;

create table if not exists public.tutor_vacunas (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  mascota_id text references public.mascotas (id) on delete cascade,
  paciente_id uuid references public.clinica_pacientes (id) on delete set null,
  nombre text not null,
  fecha date not null default current_date,
  proxima_fecha date,
  lote text,
  notas text,
  creado_en timestamptz not null default now(),
  constraint tutor_vacunas_nombre_not_blank check (char_length(btrim(nombre)) >= 2),
  constraint tutor_vacunas_vinculo check (mascota_id is not null or paciente_id is not null)
);

create index if not exists tutor_vacunas_tutor_idx
  on public.tutor_vacunas (tutor_id, fecha desc);

create index if not exists tutor_vacunas_mascota_idx
  on public.tutor_vacunas (mascota_id, fecha desc);

create index if not exists tutor_vacunas_paciente_idx
  on public.tutor_vacunas (paciente_id, fecha desc);

alter table public.tutor_vacunas enable row level security;

drop policy if exists "tutor_vacunas_all_public" on public.tutor_vacunas;
create policy "tutor_vacunas_all_public"
on public.tutor_vacunas for all to public using (true) with check (true);

grant select, insert, update, delete on public.tutor_vacunas to anon, authenticated;

notify pgrst, 'reload schema';

commit;
