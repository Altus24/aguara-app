-- Tratamientos cargados manualmente por el tutor (además de los de clínica).
-- Requiere 09_tutores.sql + 14_mascota_perfil_clinico.sql (+ 11 clínica opcional).

begin;

create table if not exists public.tutor_tratamientos (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutores (id) on delete cascade,
  mascota_id text references public.mascotas (id) on delete cascade,
  paciente_id uuid references public.clinica_pacientes (id) on delete set null,
  titulo text not null,
  detalle text,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  de_por_vida boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint tutor_tratamientos_titulo_not_blank check (char_length(btrim(titulo)) >= 2),
  constraint tutor_tratamientos_vinculo check (mascota_id is not null or paciente_id is not null),
  constraint tutor_tratamientos_fin_ok check (
    de_por_vida = true
    or fecha_fin is null
    or fecha_fin >= fecha_inicio
  )
);

create index if not exists tutor_tratamientos_tutor_idx
  on public.tutor_tratamientos (tutor_id, activo, fecha_inicio desc);

create index if not exists tutor_tratamientos_mascota_idx
  on public.tutor_tratamientos (mascota_id, activo);

create index if not exists tutor_tratamientos_paciente_idx
  on public.tutor_tratamientos (paciente_id, activo);

alter table public.tutor_tratamientos enable row level security;

drop policy if exists "tutor_tratamientos_all_public" on public.tutor_tratamientos;
create policy "tutor_tratamientos_all_public"
on public.tutor_tratamientos for all to public using (true) with check (true);

grant select, insert, update, delete on public.tutor_tratamientos to anon, authenticated;

comment on table public.tutor_tratamientos is
  'Tratamientos activos cargados por el tutor (paralelo a clinica_tratamientos).';

-- Al vincular chapita digital → física, migrar mascota_id (si existe el RPC).
do $$
begin
  if to_regclass('public.vincular_chapita_a_mascota_digital') is null then
    return;
  end if;
  -- El RPC de 31/32 ya migra tutor_vacunas; se refuerza en apps nuevas vía update puntual
  -- cuando se vincule (ver mascotasTutor / RPC). Acá dejamos el índice listo.
end $$;

notify pgrst, 'reload schema';

commit;
