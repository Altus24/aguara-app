-- Solicitudes de cambio de perfil del tutor (propuestas por la clínica).
-- Requiere 09_tutores.sql + 11_clinica_operativa.sql + 13_tutor_portal.sql.

begin;

create table if not exists public.tutor_perfil_solicitudes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  cliente_id uuid references public.clinica_clientes (id) on delete set null,
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  datos_anteriores jsonb not null default '{}'::jsonb,
  datos_propuestos jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada')),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);

create index if not exists tutor_perfil_solicitudes_tutor_estado_idx
  on public.tutor_perfil_solicitudes (tutor_id, estado, creado_en desc);

create index if not exists tutor_perfil_solicitudes_clinica_idx
  on public.tutor_perfil_solicitudes (clinica_id, estado, creado_en desc);

create table if not exists public.tutor_notificaciones (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  tipo text not null default 'perfil_cambio',
  titulo text not null,
  mensaje text,
  solicitud_id uuid references public.tutor_perfil_solicitudes (id) on delete cascade,
  leida boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists tutor_notificaciones_tutor_idx
  on public.tutor_notificaciones (tutor_id, leida, creado_en desc);

alter table public.tutor_perfil_solicitudes enable row level security;
alter table public.tutor_notificaciones enable row level security;

drop policy if exists "tutor_perfil_solicitudes_all_public" on public.tutor_perfil_solicitudes;
create policy "tutor_perfil_solicitudes_all_public"
on public.tutor_perfil_solicitudes for all to public using (true) with check (true);

drop policy if exists "tutor_notificaciones_all_public" on public.tutor_notificaciones;
create policy "tutor_notificaciones_all_public"
on public.tutor_notificaciones for all to public using (true) with check (true);

grant select, insert, update, delete on public.tutor_perfil_solicitudes to anon, authenticated;
grant select, insert, update, delete on public.tutor_notificaciones to anon, authenticated;

notify pgrst, 'reload schema';

commit;
