-- Vincula notificaciones del tutor con la cita (para archivar avisos de turnos pasados).
-- Requiere 11_clinica_operativa.sql + 18_tutor_cambio_perfil.sql.

begin;

alter table public.tutor_notificaciones
  add column if not exists cita_id uuid references public.clinica_citas (id) on delete set null;

create index if not exists tutor_notificaciones_cita_idx
  on public.tutor_notificaciones (cita_id)
  where cita_id is not null;

notify pgrst, 'reload schema';

commit;
