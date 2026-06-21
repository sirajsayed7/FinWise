create table if not exists public.finwise_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  transactions jsonb not null default '[]'::jsonb,
  latest_period jsonb,
  merchant_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finwise_user_data enable row level security;

drop policy if exists "Users can read their own FinWise data" on public.finwise_user_data;
create policy "Users can read their own FinWise data"
on public.finwise_user_data
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own FinWise data" on public.finwise_user_data;
create policy "Users can insert their own FinWise data"
on public.finwise_user_data
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own FinWise data" on public.finwise_user_data;
create policy "Users can update their own FinWise data"
on public.finwise_user_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_finwise_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_finwise_user_data_updated_at on public.finwise_user_data;
create trigger set_finwise_user_data_updated_at
before update on public.finwise_user_data
for each row
execute function public.set_finwise_updated_at();
