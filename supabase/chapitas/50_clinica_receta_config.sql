-- Personalización del membrete / plantilla de receta JPEG.
-- Requiere 10_clinicas.sql.

begin;

alter table public.clinicas
  add column if not exists receta_config jsonb not null default '{}'::jsonb;

comment on column public.clinicas.receta_config is
  'Opciones visuales de la receta (color, logo, teléfono, dirección, pie, etc.).';

commit;
