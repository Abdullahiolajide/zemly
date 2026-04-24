create table if not exists public.user_subscriptions (
    email text primary key,
    user_id uuid null references auth.users(id) on delete set null,
    customer_id text,
    tier text not null default 'free',
    status text,
    current_period_end timestamptz,
    updated_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can read their subscription" on public.user_subscriptions;
create policy "Users can read their subscription"
on public.user_subscriptions
for select
using ((auth.uid() = user_id) or ((auth.jwt() ->> 'email') = email));
