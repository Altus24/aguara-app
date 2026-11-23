-- Estado "mascota perdida" (activado por el tutor desde la ficha).
alter table public.mascotas
  add column if not exists perdida boolean not null default false;

alter table public.mascotas
  add column if not exists perdida_desde timestamptz;

create index if not exists mascotas_perdida_idx
  on public.mascotas (perdida)
  where perdida = true;

notify pgrst, 'reload schema';
