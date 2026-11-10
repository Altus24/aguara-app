-- Fecha de última modificación en historias clínicas.
-- Requiere 11_clinica_operativa.sql.

begin;

alter table public.clinica_consultas
  add column if not exists actualizado_en timestamptz;

update public.clinica_consultas
set actualizado_en = coalesce(cerrado_en, creado_en, now())
where actualizado_en is null;

alter table public.clinica_consultas
  alter column actualizado_en set default now();

comment on column public.clinica_consultas.actualizado_en is
  'Última vez que se editó la historia clínica';

notify pgrst, 'reload schema';

commit;
