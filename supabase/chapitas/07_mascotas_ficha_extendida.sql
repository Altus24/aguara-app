-- Extiende la ficha de chapitas (tutor + animal).
-- Ejecutar en Supabase → SQL Editor sobre el mismo proyecto.

alter table public.mascotas
  add column if not exists email_tutor text,
  add column if not exists telefono_secundario text,
  add column if not exists foto_url text,
  add column if not exists sexo text,
  add column if not exists castrado boolean,
  add column if not exists nro_chip text,
  add column if not exists enfermedad text,
  add column if not exists medicacion text,
  add column if not exists datos_adicionales text;

alter table public.mascotas drop constraint if exists mascotas_sexo_check;
alter table public.mascotas
  add constraint mascotas_sexo_check
  check (sexo is null or sexo in ('Macho', 'Hembra'));

alter table public.mascotas drop constraint if exists mascotas_especie_perro_gato_check;
alter table public.mascotas
  add constraint mascotas_especie_perro_gato_check
  check (especie is null or especie in ('Perro', 'Gato', 'Otro'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mascotas-fotos',
  'mascotas-fotos',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mascotas_fotos_public_read" on storage.objects;
create policy "mascotas_fotos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'mascotas-fotos');

drop policy if exists "mascotas_fotos_public_insert" on storage.objects;
create policy "mascotas_fotos_public_insert"
on storage.objects
for insert
to public
with check (bucket_id = 'mascotas-fotos');

drop policy if exists "mascotas_fotos_admin_update" on storage.objects;
create policy "mascotas_fotos_admin_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'mascotas-fotos')
with check (bucket_id = 'mascotas-fotos');

notify pgrst, 'reload schema';
