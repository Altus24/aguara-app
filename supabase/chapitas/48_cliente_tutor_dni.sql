-- DNI del tutor / cliente clínico (recetas y ficha).
-- Requiere 09_tutores.sql + 11_clinica_operativa.sql (+ 13 recomendado).

begin;

alter table public.tutores
  add column if not exists dni text;

alter table public.clinica_clientes
  add column if not exists dni text;

create index if not exists tutores_dni_idx
  on public.tutores (dni)
  where dni is not null and btrim(dni) <> '';

create index if not exists clinica_clientes_dni_idx
  on public.clinica_clientes (dni)
  where dni is not null and btrim(dni) <> '';

commit;
