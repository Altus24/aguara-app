-- Suscripciones Web Push (tutores y clínicas).
-- Requiere 09_tutores.sql y clinicas.

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('tutor', 'clinica')),
  audience_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists push_subscriptions_audience_idx
  on public.push_subscriptions (audience, audience_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_all_public" on public.push_subscriptions;
create policy "push_subscriptions_all_public"
on public.push_subscriptions for all to public using (true) with check (true);

grant select, insert, update, delete on public.push_subscriptions to anon, authenticated;

notify pgrst, 'reload schema';

commit;
