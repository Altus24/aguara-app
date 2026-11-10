-- Permite borrar clínicas (superadmin / panel).
-- Requiere 10_clinicas.sql.

begin;

drop policy if exists "clinicas_delete_public" on public.clinicas;
create policy "clinicas_delete_public"
on public.clinicas
for delete
to public
using (true);

grant delete on public.clinicas to anon, authenticated;

notify pgrst, 'reload schema';

commit;
