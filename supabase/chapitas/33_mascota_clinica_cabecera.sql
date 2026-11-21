-- Clínica de cabecera opcional por mascota (registro chapita / digital).
-- Requiere 10_clinicas.sql y tabla mascotas.

begin;

alter table public.mascotas
  add column if not exists clinica_cabecera_id uuid references public.clinicas (id) on delete set null;

create index if not exists mascotas_clinica_cabecera_idx
  on public.mascotas (clinica_cabecera_id)
  where clinica_cabecera_id is not null;

comment on column public.mascotas.clinica_cabecera_id is
  'Clínica de cabecera preferida de la mascota (opcional).';

notify pgrst, 'reload schema';

commit;
