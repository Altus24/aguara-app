-- Aguará App — esquema inicial
-- Una clínica, sin autenticación.
-- Ejecutalo una vez en el SQL Editor de Supabase (Dashboard → SQL → New query).
--
-- TEMPORAL: las políticas dejan leer y escribir sin login porque esta fase
-- no tiene usuarios. La anon key es pública: cualquiera con la URL del proyecto
-- puede leer y modificar datos hasta que actives Supabase Auth y reemplaces
-- estas políticas por reglas atadas a auth.uid().

begin;

create extension if not exists pgcrypto;

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  dni text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  constraint owners_full_name_not_blank check (char_length(btrim(full_name)) >= 2)
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete restrict,
  name text not null,
  species text not null,
  breed text,
  sex text,
  birth_date date,
  weight_kg numeric(6, 2),
  photo_url text,
  qr_code text unique,
  created_at timestamptz not null default now(),
  constraint patients_name_not_blank check (char_length(btrim(name)) >= 1),
  constraint patients_weight_range check (
    weight_kg is null or (weight_kg > 0 and weight_kg <= 1500)
  ),
  constraint patients_birth_date_not_future check (
    birth_date is null or birth_date <= current_date
  ),
  constraint patients_qr_code_format check (
    qr_code is null
    or qr_code ~ '^[A-Za-z0-9_-]{4,64}$'
  )
);

-- Si ya corriste una versión anterior del esquema:
alter table public.patients add column if not exists qr_code text;

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  visit_date timestamptz not null default now(),
  reason text not null,
  diagnosis text,
  treatment text,
  weight_kg numeric(6, 2),
  created_at timestamptz not null default now(),
  constraint medical_records_reason_not_blank check (char_length(btrim(reason)) >= 2),
  constraint medical_records_weight_range check (
    weight_kg is null or (weight_kg > 0 and weight_kg <= 1500)
  )
);

create index if not exists owners_full_name_idx on public.owners (full_name);
create index if not exists owners_dni_idx on public.owners (dni);
create index if not exists patients_owner_id_idx on public.patients (owner_id);
create index if not exists patients_name_idx on public.patients (name);
create unique index if not exists patients_qr_code_uidx
  on public.patients (qr_code)
  where qr_code is not null;
create index if not exists medical_records_patient_visit_idx
  on public.medical_records (patient_id, visit_date desc);

-- La búsqueda del panel filtra esta vista por nombre de mascota, tutor o DNI.
-- security_invoker hace que sigan aplicando las políticas de las tablas base.
create or replace view public.patients_directory
with (security_invoker = true) as
select
  p.id,
  p.owner_id,
  p.name,
  p.species,
  p.breed,
  p.sex,
  p.birth_date,
  p.weight_kg,
  p.photo_url,
  p.qr_code,
  p.created_at,
  o.full_name as owner_name,
  o.dni as owner_dni,
  o.phone as owner_phone,
  o.email as owner_email
from public.patients as p
join public.owners as o on o.id = p.owner_id;

alter table public.owners enable row level security;
alter table public.patients enable row level security;
alter table public.medical_records enable row level security;

drop policy if exists "owners_public_all_temporary" on public.owners;
create policy "owners_public_all_temporary"
on public.owners
for all
to public
using (true)
with check (true);

drop policy if exists "patients_public_all_temporary" on public.patients;
create policy "patients_public_all_temporary"
on public.patients
for all
to public
using (true)
with check (true);

drop policy if exists "medical_records_public_all_temporary" on public.medical_records;
create policy "medical_records_public_all_temporary"
on public.medical_records
for all
to public
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.owners to anon, authenticated;
grant select, insert, update, delete on public.patients to anon, authenticated;
grant select, insert, update, delete on public.medical_records to anon, authenticated;
grant select on public.patients_directory to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-photos',
  'patient-photos',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "patient_photos_public_all_temporary" on storage.objects;
create policy "patient_photos_public_all_temporary"
on storage.objects
for all
to public
using (bucket_id = 'patient-photos')
with check (bucket_id = 'patient-photos');

commit;

notify pgrst, 'reload schema';
