-- Horarios de atención por veterinario.
-- Requiere 10_clinicas.sql y 11_clinica_operativa.sql.

begin;

alter table public.clinica_horarios
  add column if not exists veterinario_id uuid
    references public.clinica_veterinarios (id) on delete cascade;

create index if not exists clinica_horarios_vet_idx
  on public.clinica_horarios (clinica_id, veterinario_id, dia_semana);

comment on column public.clinica_horarios.veterinario_id is
  'Si es null = horario general de la clínica (legado). Si tiene valor = horario del veterinario.';

notify pgrst, 'reload schema';

commit;
