-- Flag: incluir diagnóstico en la receta JPEG de la HC.
-- Requiere 11_clinica_operativa.sql.

begin;

alter table public.clinica_consultas
  add column if not exists diagnostico_en_receta boolean not null default false;

commit;
