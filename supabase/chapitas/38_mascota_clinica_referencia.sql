-- Clínica de cabecera como referencia libre (aunque no esté en el sistema).
-- Complementa clinica_cabecera_id (33) para clínicas registradas.

begin;

alter table public.mascotas
  add column if not exists clinica_ref_nombre text,
  add column if not exists clinica_ref_direccion text,
  add column if not exists clinica_ref_telefono text;

comment on column public.mascotas.clinica_ref_nombre is
  'Nombre de clínica de cabecera de referencia (puede no estar en Aguará).';
comment on column public.mascotas.clinica_ref_direccion is
  'Dirección de la clínica de referencia.';
comment on column public.mascotas.clinica_ref_telefono is
  'Teléfono de contacto de la clínica de referencia.';

notify pgrst, 'reload schema';

commit;
