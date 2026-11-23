-- Escaneos de ficha pública (QR) con ubicación aproximada por IP.
-- Requiere 01_schema.sql + 09_tutores.sql + 18_tutor_cambio_perfil.sql.

begin;

create table if not exists public.chapita_escaneos (
  id uuid primary key default gen_random_uuid(),
  mascota_id text not null references public.mascotas (id) on delete cascade,
  tutor_id uuid references public.tutores (id) on delete set null,
  ip text,
  ciudad text,
  region text,
  pais text,
  latitud double precision,
  longitud double precision,
  ubicacion_label text,
  maps_url text,
  user_agent text,
  fuente_geo text,
  creado_en timestamptz not null default now()
);

create index if not exists chapita_escaneos_mascota_creado_idx
  on public.chapita_escaneos (mascota_id, creado_en desc);

create index if not exists chapita_escaneos_tutor_creado_idx
  on public.chapita_escaneos (tutor_id, creado_en desc);

create index if not exists chapita_escaneos_mascota_ip_creado_idx
  on public.chapita_escaneos (mascota_id, ip, creado_en desc);

alter table public.chapita_escaneos enable row level security;

drop policy if exists "chapita_escaneos_all_public" on public.chapita_escaneos;
create policy "chapita_escaneos_all_public"
on public.chapita_escaneos for all to public using (true) with check (true);

grant select, insert, update, delete on public.chapita_escaneos to anon, authenticated;

notify pgrst, 'reload schema';

commit;
