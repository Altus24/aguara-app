-- Perfil tutor: dirección detallada, Maps, notificaciones mobile y preferencias de recordatorio.
-- Requiere 09_tutores.sql (+ 13_tutor_portal.sql para direccion).

begin;

alter table public.tutores
  add column if not exists calle text,
  add column if not exists numeracion text,
  add column if not exists tipo_vivienda text
    check (tipo_vivienda is null or tipo_vivienda in ('casa', 'edificio')),
  add column if not exists piso_depto text,
  add column if not exists localidad text,
  add column if not exists provincia text,
  add column if not exists maps_url text,
  add column if not exists notif_push_mobile boolean not null default false,
  add column if not exists recordatorio_anticipacion text[] not null default '{}',
  add column if not exists recordatorio_canales text[] not null default '{app}';

comment on column public.tutores.maps_url is
  'Link de Google Maps pegado por el tutor.';
comment on column public.tutores.recordatorio_anticipacion is
  'Cuánto antes avisar: 15m, 1h, 3h, 1d, 2d, 1w (multiselección).';
comment on column public.tutores.recordatorio_canales is
  'Canales: app, whatsapp, email (multiselección).';

notify pgrst, 'reload schema';

commit;
