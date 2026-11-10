-- Matrícula y firma digital de veterinarios.
-- Requiere 11_clinica_operativa.sql. Ejecutar en Supabase → SQL Editor.

begin;

alter table public.clinica_veterinarios
  add column if not exists matricula text;

alter table public.clinica_veterinarios
  add column if not exists firma_digital text;

alter table public.clinica_consultas
  add column if not exists firma_imagen text;

comment on column public.clinica_veterinarios.matricula is 'Matrícula profesional del veterinario';
comment on column public.clinica_veterinarios.firma_digital is 'Firma digital en data URL (PNG base64)';
comment on column public.clinica_consultas.firma_imagen is 'Snapshot de firma al cerrar la consulta';

notify pgrst, 'reload schema';

commit;
