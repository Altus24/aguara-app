-- Vaciado completo de datos de la app (tutores, clínicas, QR/chapitas, mascotas).
-- Conserva: admin_users, servicios_generales (catálogo).
-- Reset: chapita_inventario → tirada 1.
-- Ejecutar en Supabase → SQL Editor (como postgres). IRREVERSIBLE.

begin;

-- Helper: borra si la tabla existe.
create or replace function public._wipe_delete(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('delete from %s', p_table);
exception
  when undefined_table then
    null;
  when undefined_object then
    null;
end;
$$;

-- Soltar FKs que pueden bloquear.
do $$
begin
  update public.mascotas
  set tutor_id = null,
      clinica_cabecera_id = null
  where true;
exception when undefined_table then null;
end $$;

do $$
begin
  update public.tutores
  set clinica_preferida_id = null
  where true;
exception when undefined_table then null;
end $$;

-- Push / escaneos / tutor
select public._wipe_delete('public.push_subscriptions');
select public._wipe_delete('public.chapita_escaneos');
select public._wipe_delete('public.tutor_notificaciones');
select public._wipe_delete('public.tutor_perfil_solicitudes');
select public._wipe_delete('public.tutor_vacunas');
select public._wipe_delete('public.tutor_tratamientos');
select public._wipe_delete('public.tutor_recordatorios');
select public._wipe_delete('public.tutor_compartir_clinica');

-- Operativa clínica
select public._wipe_delete('public.clinica_notificaciones');
select public._wipe_delete('public.clinica_archivos');
select public._wipe_delete('public.clinica_pagos');
select public._wipe_delete('public.clinica_vacunas');
select public._wipe_delete('public.clinica_desparasitaciones');
select public._wipe_delete('public.clinica_tratamientos');
select public._wipe_delete('public.clinica_consultas');
select public._wipe_delete('public.clinica_citas');
select public._wipe_delete('public.clinica_recordatorios');
select public._wipe_delete('public.clinica_veterinario_servicios');
select public._wipe_delete('public.clinica_pacientes');
select public._wipe_delete('public.clinica_clientes');
select public._wipe_delete('public.clinica_veterinarios');
select public._wipe_delete('public.clinica_servicios');
select public._wipe_delete('public.clinica_horarios');
select public._wipe_delete('public.clinica_productos');

-- Núcleo
select public._wipe_delete('public.mascotas');
select public._wipe_delete('public.chapitas');
select public._wipe_delete('public.clinicas');
select public._wipe_delete('public.tutores');

-- Legacy MVP (si existe)
select public._wipe_delete('public.patients');
select public._wipe_delete('public.owners');

-- Inventario de tiradas → T1
insert into public.chapita_inventario (id, max_id_numerico, tirada_actual)
values (1, 100, 1)
on conflict (id) do update
set max_id_numerico = 100,
    tirada_actual = 1;

-- Fotos en Storage
do $$
begin
  delete from storage.objects where bucket_id = 'mascotas-fotos';
exception when others then
  raise notice 'storage wipe skipped: %', sqlerrm;
end $$;

drop function if exists public._wipe_delete(text);

notify pgrst, 'reload schema';

commit;

-- Verificación
select 'mascotas' as tabla, count(*)::int as filas from public.mascotas
union all select 'chapitas', count(*)::int from public.chapitas
union all select 'tutores', count(*)::int from public.tutores
union all select 'clinicas', count(*)::int from public.clinicas
union all select 'chapita_escaneos', count(*)::int from public.chapita_escaneos
union all select 'inventario_tirada', tirada_actual from public.chapita_inventario where id = 1;
