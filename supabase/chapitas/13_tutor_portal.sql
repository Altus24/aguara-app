-- Portal de tutores: perfil, vínculo con clínica, citas pendientes y recordatorios.
-- Requiere 09_tutores.sql + 11_clinica_operativa.sql (+ 12 recomendado).

begin;

-- Perfil tutor ampliado
alter table public.tutores
  add column if not exists direccion text;

alter table public.tutores
  add column if not exists clinica_preferida_id uuid references public.clinicas (id) on delete set null;

-- Edad / nacimiento en chapitas
alter table public.mascotas
  add column if not exists fecha_nacimiento date;

-- Preferencias de la clínica
alter table public.clinicas
  add column if not exists permite_citas_tutor boolean not null default true;

-- Vínculo cliente clínico ↔ tutor Aguará
alter table public.clinica_clientes
  add column if not exists tutor_id uuid references public.tutores (id) on delete set null;

create index if not exists clinica_clientes_tutor_id_idx
  on public.clinica_clientes (tutor_id);

-- Vínculo paciente clínico ↔ chapita
alter table public.clinica_pacientes
  add column if not exists mascota_chapita_id text;

create index if not exists clinica_pacientes_chapita_idx
  on public.clinica_pacientes (mascota_chapita_id);

-- Estado pendiente para solicitudes del tutor
alter table public.clinica_citas drop constraint if exists clinica_citas_estado_check;
alter table public.clinica_citas
  add constraint clinica_citas_estado_check
  check (estado in (
    'pendiente',
    'confirmada',
    'en_espera',
    'en_atencion',
    'finalizada',
    'no_asistio',
    'cancelada',
    'lista_espera'
  ));

-- Recordatorios cargados por la clínica (medicación / controles / otros)
create table if not exists public.clinica_recordatorios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid references public.clinica_pacientes (id) on delete cascade,
  cliente_id uuid references public.clinica_clientes (id) on delete set null,
  tipo text not null default 'control'
    check (tipo in ('vacuna', 'control', 'medicacion', 'otro')),
  titulo text not null,
  detalle text,
  fecha_proxima date,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint clinica_recordatorios_titulo_not_blank check (char_length(btrim(titulo)) >= 2)
);

create index if not exists clinica_recordatorios_clinica_idx
  on public.clinica_recordatorios (clinica_id, fecha_proxima);

create index if not exists clinica_recordatorios_paciente_idx
  on public.clinica_recordatorios (paciente_id, fecha_proxima);

alter table public.clinica_recordatorios enable row level security;

drop policy if exists "clinica_recordatorios_all_public" on public.clinica_recordatorios;
create policy "clinica_recordatorios_all_public"
on public.clinica_recordatorios for all to public using (true) with check (true);

grant select, insert, update, delete on public.clinica_recordatorios to anon, authenticated;

-- Tutores pueden actualizar su propio perfil (RLS abierto temporal, como el resto del módulo)
drop policy if exists "tutores_update_admin" on public.tutores;
drop policy if exists "tutores_update_public" on public.tutores;
create policy "tutores_update_public"
on public.tutores
for update
to public
using (true)
with check (true);

grant update on public.tutores to anon, authenticated;

-- Backfill: vincula clientes clínicos con tutores por email
update public.clinica_clientes c
set tutor_id = t.id
from public.tutores t
where c.tutor_id is null
  and c.email is not null
  and lower(btrim(c.email)) = lower(btrim(t.email));

-- Backfill: vincula pacientes clínicos con chapitas por código
update public.clinica_pacientes p
set mascota_chapita_id = p.chapita_codigo
where p.mascota_chapita_id is null
  and p.chapita_codigo is not null
  and btrim(p.chapita_codigo) <> '';

notify pgrst, 'reload schema';

commit;
