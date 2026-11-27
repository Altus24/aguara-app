-- Flag para incluir el diagnóstico en la receta JPEG.
-- Requiere 11_clinica_operativa.sql.

begin;

alter table public.clinica_consultas
  add column if not exists incluir_diagnostico_receta boolean not null default false;

commit;
