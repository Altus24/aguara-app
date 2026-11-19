-- Al aceptar compartir, el tutor elige qué mascota autoriza además de las que ya son pacientes.
-- Sin esto / sin mascota_id: la clínica solo ve nombres de las demás mascotas.
-- Requiere 21_tutor_compartir_clinica.sql.

begin;

alter table public.tutor_compartir_clinica
  add column if not exists mascota_id text references public.mascotas (id) on delete set null;

create index if not exists tutor_compartir_clinica_mascota_idx
  on public.tutor_compartir_clinica (mascota_id)
  where mascota_id is not null;

comment on column public.tutor_compartir_clinica.mascota_id is
  'Mascota cuya ficha completa autorizó el tutor (además de pacientes de la clínica).';

notify pgrst, 'reload schema';

commit;
