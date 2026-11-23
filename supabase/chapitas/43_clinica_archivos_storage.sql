-- Bucket para archivos clínicos del paciente (estudios, lab, PDFs, etc.).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinica-archivos',
  'clinica-archivos',
  true,
  20971520,
  null
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clinica_archivos_public_read" on storage.objects;
create policy "clinica_archivos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'clinica-archivos');

drop policy if exists "clinica_archivos_public_insert" on storage.objects;
create policy "clinica_archivos_public_insert"
on storage.objects
for insert
to public
with check (bucket_id = 'clinica-archivos');

drop policy if exists "clinica_archivos_public_update" on storage.objects;
create policy "clinica_archivos_public_update"
on storage.objects
for update
to public
using (bucket_id = 'clinica-archivos')
with check (bucket_id = 'clinica-archivos');

drop policy if exists "clinica_archivos_public_delete" on storage.objects;
create policy "clinica_archivos_public_delete"
on storage.objects
for delete
to public
using (bucket_id = 'clinica-archivos');

notify pgrst, 'reload schema';
