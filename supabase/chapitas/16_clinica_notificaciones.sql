-- Notificaciones in-app para la clínica (turnos pendientes del tutor).
-- Requiere 11_clinica_operativa.sql.

begin;

create table if not exists public.clinica_notificaciones (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  tipo text not null default 'cita_pendiente',
  titulo text not null,
  mensaje text,
  cita_id uuid references public.clinica_citas (id) on delete cascade,
  leida boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists clinica_notificaciones_clinica_idx
  on public.clinica_notificaciones (clinica_id, leida, creado_en desc);

alter table public.clinica_notificaciones enable row level security;

drop policy if exists "clinica_notificaciones_all_public" on public.clinica_notificaciones;
create policy "clinica_notificaciones_all_public"
on public.clinica_notificaciones for all to public using (true) with check (true);

grant select, insert, update, delete on public.clinica_notificaciones to anon, authenticated;

notify pgrst, 'reload schema';

commit;
