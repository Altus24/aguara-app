-- Reset completo de tiradas / inventario.
-- Ejecutar en Supabase → SQL Editor.
-- Borra mascotas + chapitas y deja el contador en tirada 1 (T1-001…T1-100).

begin;

delete from public.mascotas;
delete from public.chapitas;

insert into public.chapita_inventario (id, max_id_numerico, tirada_actual)
values (1, 100, 1)
on conflict (id) do update
set max_id_numerico = 100,
    tirada_actual = 1;

-- RPC opcional para futuros resets desde el panel (superadmin).
create or replace function public.reset_todas_las_tiradas()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  delete from public.mascotas;
  delete from public.chapitas;

  insert into public.chapita_inventario (id, max_id_numerico, tirada_actual)
  values (1, 100, 1)
  on conflict (id) do update
  set max_id_numerico = 100,
      tirada_actual = 1;

  return json_build_object(
    'ok', true,
    'tirada_actual', 1,
    'max_id_numerico', 100
  );
end;
$$;

grant execute on function public.reset_todas_las_tiradas() to authenticated;

commit;

select * from public.chapita_inventario where id = 1;
