-- Clínicas veterinarias: perfil, servicios, horarios y stock.
-- Ejecutar en Supabase → SQL Editor.

begin;

create extension if not exists pgcrypto;

create table if not exists public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text not null,
  direccion text not null default '',
  ciudad text not null default '',
  provincia text not null default 'Mendoza',
  descripcion text,
  maps_url text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint clinicas_nombre_not_blank check (char_length(btrim(nombre)) >= 2),
  constraint clinicas_email_not_blank check (char_length(btrim(email)) >= 5),
  constraint clinicas_telefono_not_blank check (char_length(btrim(telefono)) >= 6)
);

create unique index if not exists clinicas_email_lower_uidx
  on public.clinicas (lower(btrim(email)));

create table if not exists public.clinica_servicios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric(12, 2),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint clinica_servicios_nombre_not_blank check (char_length(btrim(nombre)) >= 2)
);

create index if not exists clinica_servicios_clinica_id_idx
  on public.clinica_servicios (clinica_id);

-- dia_semana: 0 = domingo … 6 = sábado (ISO-like JS getDay)
create table if not exists public.clinica_horarios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint clinica_horarios_rango check (hora_fin > hora_inicio)
);

create index if not exists clinica_horarios_clinica_id_idx
  on public.clinica_horarios (clinica_id, dia_semana);

create table if not exists public.clinica_productos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nombre text not null,
  descripcion text,
  stock integer not null default 0 check (stock >= 0),
  unidad text not null default 'u',
  precio numeric(12, 2),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint clinica_productos_nombre_not_blank check (char_length(btrim(nombre)) >= 2)
);

create index if not exists clinica_productos_clinica_id_idx
  on public.clinica_productos (clinica_id);

-- RLS temporal (sin Auth de clínica todavía): acceso público de lectura/escritura.
alter table public.clinicas enable row level security;
alter table public.clinica_servicios enable row level security;
alter table public.clinica_horarios enable row level security;
alter table public.clinica_productos enable row level security;

drop policy if exists "clinicas_select_public" on public.clinicas;
create policy "clinicas_select_public"
on public.clinicas for select to public using (true);

drop policy if exists "clinicas_insert_public" on public.clinicas;
create policy "clinicas_insert_public"
on public.clinicas for insert to public with check (true);

drop policy if exists "clinicas_update_public" on public.clinicas;
create policy "clinicas_update_public"
on public.clinicas for update to public using (true) with check (true);

drop policy if exists "clinica_servicios_all_public" on public.clinica_servicios;
create policy "clinica_servicios_all_public"
on public.clinica_servicios for all to public using (true) with check (true);

drop policy if exists "clinica_horarios_all_public" on public.clinica_horarios;
create policy "clinica_horarios_all_public"
on public.clinica_horarios for all to public using (true) with check (true);

drop policy if exists "clinica_productos_all_public" on public.clinica_productos;
create policy "clinica_productos_all_public"
on public.clinica_productos for all to public using (true) with check (true);

grant select, insert, update on public.clinicas to anon, authenticated;
grant select, insert, update, delete on public.clinica_servicios to anon, authenticated;
grant select, insert, update, delete on public.clinica_horarios to anon, authenticated;
grant select, insert, update, delete on public.clinica_productos to anon, authenticated;

notify pgrst, 'reload schema';

commit;
