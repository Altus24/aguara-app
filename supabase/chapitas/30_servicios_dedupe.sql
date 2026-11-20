-- Limpia servicios duplicados (legacy sin codigo + copia del catálogo).
-- Requiere 29_servicios_generales.sql.

begin;

-- Quitar variantes que no son el servicio general (ej. vacunación antirrábica).
delete from public.clinica_veterinario_servicios cvs
using public.clinica_servicios s
where cvs.servicio_id = s.id
  and (
    lower(btrim(s.nombre)) in ('vacunacion antirrabica', 'vacunación antirrábica', 'vacuna antirrabica')
    or lower(btrim(s.nombre)) like '%antirrab%'
  );

delete from public.clinica_servicios s
where lower(btrim(s.nombre)) in ('vacunacion antirrabica', 'vacunación antirrábica', 'vacuna antirrabica')
   or lower(btrim(s.nombre)) like '%antirrab%';

-- Si quedó etiquetado como general pero el nombre no coincide con el catálogo, sacar codigo.
update public.clinica_servicios s
set codigo = null
from public.servicios_generales g
where s.codigo = g.codigo
  and lower(btrim(s.nombre)) <> lower(btrim(g.nombre))
  and lower(btrim(s.nombre)) <> g.codigo
  and not (
    g.codigo = 'vacunacion'
    and lower(btrim(s.nombre)) in ('vacunacion', 'vacunación', 'vacuna', 'vacunas')
  );

-- Vincular por nombre normalizado al código del catálogo (solo si no tiene codigo).
update public.clinica_servicios s
set codigo = g.codigo,
    nombre = g.nombre
from public.servicios_generales g
where s.codigo is null
  and lower(regexp_replace(
        translate(btrim(s.nombre), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN'),
        '[^a-zA-Z0-9 ]',
        '',
        'g'
      )) in (
        lower(regexp_replace(
          translate(btrim(g.nombre), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN'),
          '[^a-zA-Z0-9 ]',
          '',
          'g'
        )),
        g.codigo,
        case g.codigo
          when 'consulta' then 'consulta general'
          when 'control' then 'control seguimiento'
          when 'vacunacion' then 'vacunacion'
          when 'desparasitacion' then 'desparasitacion'
          when 'castracion' then 'castracion esterilizacion'
          when 'laboratorio' then 'analisis clinicos'
          when 'domicilio' then 'atencion a domicilio'
          when 'microchip' then 'microchip identificacion'
          when 'certificado' then 'certificados'
          else g.codigo
        end
      );

-- Vacunación / vacunas sueltas.
update public.clinica_servicios
set codigo = 'vacunacion',
    nombre = 'Vacunación'
where codigo is null
  and lower(btrim(nombre)) similar to '%vacun%';

-- Reasignar vínculos de vet a la fila "keeper" (más vieja) por (clinica, codigo).
with ranked as (
  select
    s.id,
    s.clinica_id,
    s.codigo,
    row_number() over (
      partition by s.clinica_id, s.codigo
      order by
        case when s.activo then 0 else 1 end,
        case when s.precio is null then 1 else 0 end,
        s.creado_en nulls last,
        s.id
    ) as rn
  from public.clinica_servicios s
  where s.codigo is not null
),
keepers as (
  select id, clinica_id, codigo from ranked where rn = 1
),
dupes as (
  select r.id as dupe_id, k.id as keeper_id
  from ranked r
  join keepers k
    on k.clinica_id = r.clinica_id
   and k.codigo = r.codigo
  where r.rn > 1
)
update public.clinica_veterinario_servicios cvs
set servicio_id = d.keeper_id
from dupes d
where cvs.servicio_id = d.dupe_id
  and not exists (
    select 1
    from public.clinica_veterinario_servicios x
    where x.veterinario_id = cvs.veterinario_id
      and x.servicio_id = d.keeper_id
  );

-- Borrar vínculos que quedaron apuntando a duplicados (ya cubiertos por el keeper).
delete from public.clinica_veterinario_servicios cvs
using (
  select
    s.id
  from public.clinica_servicios s
  where s.codigo is not null
    and exists (
      select 1
      from public.clinica_servicios k
      where k.clinica_id = s.clinica_id
        and k.codigo = s.codigo
        and k.id <> s.id
        and (
          (k.activo and not coalesce(s.activo, false))
          or (k.activo = s.activo and k.creado_en <= s.creado_en and k.id < s.id)
          or (k.activo = s.activo and k.creado_en < s.creado_en)
        )
    )
) d
where cvs.servicio_id = d.id;

-- Eliminar filas duplicadas (dejar una por clinica_id + codigo).
delete from public.clinica_servicios s
where s.codigo is not null
  and s.id not in (
    select distinct on (clinica_id, codigo) id
    from public.clinica_servicios
    where codigo is not null
    order by
      clinica_id,
      codigo,
      case when activo then 0 else 1 end,
      case when precio is null then 1 else 0 end,
      creado_en nulls last,
      id
  );

-- Evitar futuros duplicados del catálogo.
create unique index if not exists clinica_servicios_clinica_codigo_uidx
  on public.clinica_servicios (clinica_id, codigo)
  where codigo is not null;

notify pgrst, 'reload schema';

commit;
