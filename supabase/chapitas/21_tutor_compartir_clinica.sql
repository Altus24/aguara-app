-- Solicitudes para que una clínica vea el perfil completo del tutor.
-- Sin aceptación: solo nombre del tutor + nombres de mascotas (directorio).
-- Requiere 09_tutores.sql + 10_clinicas.sql (+ 16 notificaciones tutor si aplica).

begin;

create table if not exists public.tutor_compartir_clinica (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada', 'revocada')),
  mensaje text,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  constraint tutor_compartir_clinica_unique unique (clinica_id, tutor_id)
);

create index if not exists tutor_compartir_clinica_tutor_idx
  on public.tutor_compartir_clinica (tutor_id, estado, creado_en desc);

create index if not exists tutor_compartir_clinica_clinica_idx
  on public.tutor_compartir_clinica (clinica_id, estado, creado_en desc);

alter table public.tutor_compartir_clinica enable row level security;

drop policy if exists "tutor_compartir_clinica_all_public" on public.tutor_compartir_clinica;
create policy "tutor_compartir_clinica_all_public"
on public.tutor_compartir_clinica for all to public using (true) with check (true);

grant select, insert, update, delete on public.tutor_compartir_clinica to anon, authenticated;

-- Asegurar columna clinica_id usable en consultas (ya existe en 11)
comment on table public.tutor_compartir_clinica is
  'La clínica pide ver el perfil del tutor; el tutor debe aceptar.';

notify pgrst, 'reload schema';

commit;
