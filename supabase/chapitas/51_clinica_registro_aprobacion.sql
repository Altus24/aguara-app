-- Registro de clínicas: aprobación Aguará + director técnico.
-- Requiere 10_clinicas.sql y 11_clinica_operativa.sql (clinica_veterinarios).
-- Clínicas existentes quedan como 'aprobada'.

begin;

alter table public.clinicas
  add column if not exists estado_registro text not null default 'aprobada';

alter table public.clinicas
  add column if not exists solicitado_en timestamptz;

alter table public.clinicas
  add column if not exists aprobado_en timestamptz;

alter table public.clinicas
  add column if not exists director_tecnico_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinicas_estado_registro_check'
  ) then
    alter table public.clinicas
      add constraint clinicas_estado_registro_check
      check (estado_registro in ('pendiente', 'aprobada', 'rechazada'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinicas_director_tecnico_fk'
  ) then
    alter table public.clinicas
      add constraint clinicas_director_tecnico_fk
      foreign key (director_tecnico_id)
      references public.clinica_veterinarios (id)
      on delete set null;
  end if;
end $$;

comment on column public.clinicas.estado_registro is
  'pendiente | aprobada | rechazada — alta pública requiere aprobación Aguará.';
comment on column public.clinicas.director_tecnico_id is
  'Veterinario matriculado designado como director técnico al crear el perfil.';

commit;
