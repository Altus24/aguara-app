-- Operativa clínica: veterinarios, clientes, pacientes, citas, HC, pagos.
-- Requiere 10_clinicas.sql. Ejecutar en Supabase → SQL Editor.

begin;

create extension if not exists pgcrypto;

create table if not exists public.clinica_veterinarios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nombre text not null,
  especialidad text,
  email text,
  matricula text,
  firma_digital text,
  color text not null default '#F37021',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint clinica_veterinarios_nombre_not_blank check (char_length(btrim(nombre)) >= 2)
);

create index if not exists clinica_veterinarios_clinica_id_idx
  on public.clinica_veterinarios (clinica_id);

create table if not exists public.clinica_clientes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nombre_completo text not null,
  email text,
  telefono text not null default '',
  telefono_secundario text,
  direccion text,
  notas text,
  creado_en timestamptz not null default now(),
  constraint clinica_clientes_nombre_not_blank check (char_length(btrim(nombre_completo)) >= 2)
);

create index if not exists clinica_clientes_clinica_id_idx
  on public.clinica_clientes (clinica_id);
create index if not exists clinica_clientes_email_idx
  on public.clinica_clientes (clinica_id, lower(btrim(coalesce(email, ''))));

create table if not exists public.clinica_pacientes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  cliente_id uuid not null references public.clinica_clientes (id) on delete restrict,
  nombre text not null,
  especie text not null default 'Canino',
  raza text,
  sexo text,
  fecha_nacimiento date,
  peso numeric(8, 2),
  color text,
  chip text,
  alergias text,
  notas text,
  foto_url text,
  chapita_codigo text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint clinica_pacientes_nombre_not_blank check (char_length(btrim(nombre)) >= 1)
);

create index if not exists clinica_pacientes_clinica_id_idx
  on public.clinica_pacientes (clinica_id);
create index if not exists clinica_pacientes_cliente_id_idx
  on public.clinica_pacientes (cliente_id);

create table if not exists public.clinica_citas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid references public.clinica_pacientes (id) on delete set null,
  cliente_id uuid references public.clinica_clientes (id) on delete set null,
  veterinario_id uuid references public.clinica_veterinarios (id) on delete set null,
  servicio_id uuid references public.clinica_servicios (id) on delete set null,
  inicio timestamptz,
  fin timestamptz,
  estado text not null default 'confirmada'
    check (estado in (
      'confirmada',
      'en_espera',
      'en_atencion',
      'finalizada',
      'no_asistio',
      'cancelada',
      'lista_espera'
    )),
  motivo text,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists clinica_citas_clinica_inicio_idx
  on public.clinica_citas (clinica_id, inicio);
create index if not exists clinica_citas_vet_inicio_idx
  on public.clinica_citas (veterinario_id, inicio);
create index if not exists clinica_citas_estado_idx
  on public.clinica_citas (clinica_id, estado);

create table if not exists public.clinica_consultas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid not null references public.clinica_pacientes (id) on delete cascade,
  cliente_id uuid references public.clinica_clientes (id) on delete set null,
  veterinario_id uuid references public.clinica_veterinarios (id) on delete set null,
  cita_id uuid references public.clinica_citas (id) on delete set null,
  fecha timestamptz not null default now(),
  motivo text,
  anamnesis text,
  examen_fisico text,
  diagnostico text,
  tratamiento text,
  medicacion text,
  peso numeric(8, 2),
  temperatura numeric(5, 2),
  observaciones text,
  cerrada boolean not null default false,
  firmado_por text,
  firma_imagen text,
  cerrado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists clinica_consultas_paciente_idx
  on public.clinica_consultas (paciente_id, fecha desc);
create index if not exists clinica_consultas_clinica_idx
  on public.clinica_consultas (clinica_id, fecha desc);

create table if not exists public.clinica_vacunas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid not null references public.clinica_pacientes (id) on delete cascade,
  nombre text not null,
  fecha date not null default current_date,
  proxima_fecha date,
  lote text,
  veterinario_id uuid references public.clinica_veterinarios (id) on delete set null,
  notas text,
  creado_en timestamptz not null default now()
);

create index if not exists clinica_vacunas_paciente_idx
  on public.clinica_vacunas (paciente_id, fecha desc);

create table if not exists public.clinica_desparasitaciones (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid not null references public.clinica_pacientes (id) on delete cascade,
  producto text not null,
  fecha date not null default current_date,
  proxima_fecha date,
  notas text,
  creado_en timestamptz not null default now()
);

create index if not exists clinica_desparasitaciones_paciente_idx
  on public.clinica_desparasitaciones (paciente_id, fecha desc);

create table if not exists public.clinica_archivos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid not null references public.clinica_pacientes (id) on delete cascade,
  consulta_id uuid references public.clinica_consultas (id) on delete set null,
  nombre text not null,
  tipo text not null default 'otro',
  url text not null,
  creado_en timestamptz not null default now()
);

create index if not exists clinica_archivos_paciente_idx
  on public.clinica_archivos (paciente_id, creado_en desc);

create table if not exists public.clinica_pagos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  cliente_id uuid not null references public.clinica_clientes (id) on delete cascade,
  paciente_id uuid references public.clinica_pacientes (id) on delete set null,
  consulta_id uuid references public.clinica_consultas (id) on delete set null,
  monto numeric(12, 2) not null check (monto >= 0),
  concepto text not null default 'Consulta',
  metodo text not null default 'efectivo',
  fecha date not null default current_date,
  creado_en timestamptz not null default now()
);

create index if not exists clinica_pagos_clinica_fecha_idx
  on public.clinica_pagos (clinica_id, fecha desc);
create index if not exists clinica_pagos_cliente_idx
  on public.clinica_pagos (cliente_id, fecha desc);

-- RLS temporal abierto (misma política que 10_clinicas).
do $$
declare
  t text;
begin
  foreach t in array array[
    'clinica_veterinarios',
    'clinica_clientes',
    'clinica_pacientes',
    'clinica_citas',
    'clinica_consultas',
    'clinica_vacunas',
    'clinica_desparasitaciones',
    'clinica_archivos',
    'clinica_pagos'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all_public', t);
    execute format(
      'create policy %I on public.%I for all to public using (true) with check (true)',
      t || '_all_public',
      t
    );
    execute format(
      'grant select, insert, update, delete on public.%I to anon, authenticated',
      t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
