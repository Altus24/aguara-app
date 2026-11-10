-- Datos clínicos del perfil interno de mascota (no afectan la ficha pública del QR).
-- Requiere 13_tutor_portal.sql (+ 11 clínica).

begin;

alter table public.mascotas
  add column if not exists fecha_nacimiento date;

alter table public.mascotas
  add column if not exists peso numeric(8, 2);

-- Tratamientos activos visibles para el tutor (fecha_fin null + de_por_vida = de por vida)
create table if not exists public.clinica_tratamientos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid not null references public.clinica_pacientes (id) on delete cascade,
  titulo text not null,
  detalle text,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  de_por_vida boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint clinica_tratamientos_titulo_not_blank check (char_length(btrim(titulo)) >= 2),
  constraint clinica_tratamientos_fin_ok check (
    de_por_vida = true
    or fecha_fin is null
    or fecha_fin >= fecha_inicio
  )
);

create index if not exists clinica_tratamientos_paciente_idx
  on public.clinica_tratamientos (paciente_id, activo);

alter table public.clinica_tratamientos enable row level security;

drop policy if exists "clinica_tratamientos_all_public" on public.clinica_tratamientos;
create policy "clinica_tratamientos_all_public"
on public.clinica_tratamientos for all to public using (true) with check (true);

grant select, insert, update, delete on public.clinica_tratamientos to anon, authenticated;

-- Permitir al tutor actualizar peso / fecha de nacimiento de su chapita (RLS abierto temporal)
drop policy if exists "mascotas_update_public" on public.mascotas;
create policy "mascotas_update_public"
on public.mascotas
for update
to public
using (true)
with check (true);

grant update on public.mascotas to anon, authenticated;

notify pgrst, 'reload schema';

commit;
