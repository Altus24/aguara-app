-- Separar enfermedad de alergias en pacientes de clínica.
-- Antes el formulario de mascota guardaba "enfermedad" en la columna alergias.

begin;

alter table public.clinica_pacientes
  add column if not exists enfermedad text;

comment on column public.clinica_pacientes.enfermedad is
  'Enfermedad/condición declarada (distinta de alergias).';
comment on column public.clinica_pacientes.alergias is
  'Alergias del paciente.';

-- Recupera filas ya cargadas con enfermedad en alergias (sin alergias reales).
-- Solo si enfermedad está vacío y alergias tiene texto: se mueve a enfermedad.
update public.clinica_pacientes
set
  enfermedad = alergias,
  alergias = null
where (enfermedad is null or btrim(enfermedad) = '')
  and alergias is not null
  and btrim(alergias) <> '';

notify pgrst, 'reload schema';

commit;
