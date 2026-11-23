-- Logo de clínica (visible para tutores).
alter table public.clinicas
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinica-logos',
  'clinica-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clinica_logos_public_read" on storage.objects;
create policy "clinica_logos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'clinica-logos');

drop policy if exists "clinica_logos_public_insert" on storage.objects;
create policy "clinica_logos_public_insert"
on storage.objects
for insert
to public
with check (bucket_id = 'clinica-logos');

drop policy if exists "clinica_logos_public_update" on storage.objects;
create policy "clinica_logos_public_update"
on storage.objects
for update
to public
using (bucket_id = 'clinica-logos')
with check (bucket_id = 'clinica-logos');

drop policy if exists "clinica_logos_public_delete" on storage.objects;
create policy "clinica_logos_public_delete"
on storage.objects
for delete
to public
using (bucket_id = 'clinica-logos');

notify pgrst, 'reload schema';
