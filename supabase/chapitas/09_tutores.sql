-- Tutores reutilizables: varias mascotas pueden compartir el mismo tutor.
-- Ejecutar en Supabase → SQL Editor.

begin;

create extension if not exists pgcrypto;

create table if not exists public.tutores (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  email text not null,
  telefono text not null,
  telefono_secundario text,
  creado_en timestamptz not null default now(),
  constraint tutores_nombre_not_blank check (char_length(btrim(nombre_completo)) >= 2),
  constraint tutores_email_not_blank check (char_length(btrim(email)) >= 5),
  constraint tutores_telefono_not_blank check (char_length(btrim(telefono)) >= 6)
);

create unique index if not exists tutores_email_lower_uidx
  on public.tutores (lower(btrim(email)));

create index if not exists tutores_telefono_digits_idx
  on public.tutores (regexp_replace(telefono, '\D', '', 'g'));

alter table public.mascotas
  add column if not exists tutor_id uuid references public.tutores (id) on delete set null;

create index if not exists mascotas_tutor_id_idx on public.mascotas (tutor_id);

alter table public.tutores enable row level security;

drop policy if exists "tutores_select_public" on public.tutores;
create policy "tutores_select_public"
on public.tutores
for select
to public
using (true);

drop policy if exists "tutores_insert_public" on public.tutores;
create policy "tutores_insert_public"
on public.tutores
for insert
to public
with check (true);

drop policy if exists "tutores_update_admin" on public.tutores;
create policy "tutores_update_admin"
on public.tutores
for update
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

grant select, insert on public.tutores to anon, authenticated;
grant update on public.tutores to authenticated;

-- Busca tutor por email o teléfono y devuelve sus mascotas.
create or replace function public.buscar_tutor_por_contacto(
  p_email text default null,
  p_telefono text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tutores%rowtype;
  pets json;
  email_norm text := lower(btrim(coalesce(p_email, '')));
  phone_norm text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
begin
  if email_norm = '' and char_length(phone_norm) < 8 then
    return json_build_object('tutor', null, 'mascotas', '[]'::json);
  end if;

  select *
  into t
  from public.tutores
  where
    (email_norm <> '' and lower(btrim(email)) = email_norm)
    or (
      char_length(phone_norm) >= 8
      and regexp_replace(telefono, '\D', '', 'g') = phone_norm
    )
  order by creado_en asc
  limit 1;

  if not found then
    return json_build_object('tutor', null, 'mascotas', '[]'::json);
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'id', m.id,
        'nombre_mascota', m.nombre_mascota,
        'especie', m.especie,
        'foto_url', m.foto_url
      )
      order by m.creado_en desc
    ),
    '[]'::json
  )
  into pets
  from public.mascotas m
  where m.tutor_id = t.id;

  return json_build_object(
    'tutor', json_build_object(
      'id', t.id,
      'nombre_completo', t.nombre_completo,
      'email', t.email,
      'telefono', t.telefono,
      'telefono_secundario', t.telefono_secundario
    ),
    'mascotas', pets
  );
end;
$$;

grant execute on function public.buscar_tutor_por_contacto(text, text) to anon, authenticated;

-- Backfill suave: crea tutores a partir de fichas ya activadas sin tutor_id.
insert into public.tutores (nombre_completo, email, telefono, telefono_secundario)
select distinct on (lower(btrim(m.email_tutor)))
  m.nombre_dueno,
  lower(btrim(m.email_tutor)),
  m.telefono_contacto,
  m.telefono_secundario
from public.mascotas m
where m.email_tutor is not null
  and btrim(m.email_tutor) <> ''
  and m.tutor_id is null
order by lower(btrim(m.email_tutor)), m.creado_en asc
on conflict ((lower(btrim(email)))) do nothing;

update public.mascotas m
set tutor_id = t.id
from public.tutores t
where m.tutor_id is null
  and m.email_tutor is not null
  and lower(btrim(m.email_tutor)) = lower(btrim(t.email));

notify pgrst, 'reload schema';

commit;
