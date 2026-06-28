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

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'QAR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.statements (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  file_name text not null,
  bank text not null default 'Unknown Bank',
  currency text not null default 'QAR',
  status text not null default 'processed' check (status in ('processed', 'failed', 'review')),
  transaction_count integer not null default 0,
  total_income numeric(14, 2) not null default 0,
  total_expenses numeric(14, 2) not null default 0,
  period_start date,
  period_end date,
  period_days integer not null default 0,
  period_label text not null default '',
  file_hash text,
  blob_url text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, file_hash)
);

create table if not exists public.transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  statement_id text,
  date date not null,
  bank text not null default 'Unknown Bank',
  description_raw text not null,
  merchant text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  direction text not null check (direction in ('income', 'expense')),
  currency text not null default 'QAR',
  category text not null,
  subcategory text not null default '',
  confidence numeric(4, 2) not null default 0,
  reason text not null default '',
  needs_review boolean not null default false,
  category_source text not null default 'fallback' check (category_source in ('user_rule', 'default_rule', 'ai', 'fallback')),
  duplicate_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, duplicate_hash),
  foreign key (user_id, statement_id) references public.statements(user_id, id) on delete cascade
);

create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null,
  merchant text not null default '',
  category text not null,
  subcategory text not null default '',
  confidence numeric(4, 2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pattern)
);

create table if not exists public.merchant_logos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  merchant_name text not null,
  logo_url text not null,
  source text not null default 'fallback' check (source in ('known_domain', 'favicon', 'manual', 'fallback')),
  confidence numeric(4, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_key)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'QAR',
  period text not null default 'monthly' check (period in ('weekly', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, period)
);

create index if not exists statements_user_uploaded_at_idx on public.statements(user_id, uploaded_at desc);
create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_user_category_idx on public.transactions(user_id, category);
create index if not exists transactions_user_merchant_idx on public.transactions(user_id, merchant);
create index if not exists merchant_rules_user_pattern_idx on public.merchant_rules(user_id, pattern);
create index if not exists merchant_logos_user_key_idx on public.merchant_logos(user_id, merchant_key);

alter table public.profiles enable row level security;
alter table public.statements enable row level security;
alter table public.transactions enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.merchant_logos enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can read their own statements" on public.statements;
create policy "Users can read their own statements" on public.statements for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own statements" on public.statements;
create policy "Users can insert their own statements" on public.statements for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own statements" on public.statements;
create policy "Users can update their own statements" on public.statements for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own statements" on public.statements;
create policy "Users can delete their own statements" on public.statements for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own transactions" on public.transactions;
create policy "Users can read their own transactions" on public.transactions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own transactions" on public.transactions;
create policy "Users can insert their own transactions" on public.transactions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own transactions" on public.transactions;
create policy "Users can update their own transactions" on public.transactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own transactions" on public.transactions;
create policy "Users can delete their own transactions" on public.transactions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own merchant rules" on public.merchant_rules;
create policy "Users can read their own merchant rules" on public.merchant_rules for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own merchant rules" on public.merchant_rules;
create policy "Users can insert their own merchant rules" on public.merchant_rules for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own merchant rules" on public.merchant_rules;
create policy "Users can update their own merchant rules" on public.merchant_rules for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own merchant rules" on public.merchant_rules;
create policy "Users can delete their own merchant rules" on public.merchant_rules for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own merchant logos" on public.merchant_logos;
create policy "Users can read their own merchant logos" on public.merchant_logos for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own merchant logos" on public.merchant_logos;
create policy "Users can insert their own merchant logos" on public.merchant_logos for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own merchant logos" on public.merchant_logos;
create policy "Users can update their own merchant logos" on public.merchant_logos for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own merchant logos" on public.merchant_logos;
create policy "Users can delete their own merchant logos" on public.merchant_logos for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own budgets" on public.budgets;
create policy "Users can read their own budgets" on public.budgets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own budgets" on public.budgets;
create policy "Users can insert their own budgets" on public.budgets for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own budgets" on public.budgets;
create policy "Users can update their own budgets" on public.budgets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own budgets" on public.budgets;
create policy "Users can delete their own budgets" on public.budgets for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_finwise_updated_at();
drop trigger if exists set_statements_updated_at on public.statements;
create trigger set_statements_updated_at before update on public.statements for each row execute function public.set_finwise_updated_at();
drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at before update on public.transactions for each row execute function public.set_finwise_updated_at();
drop trigger if exists set_merchant_rules_updated_at on public.merchant_rules;
create trigger set_merchant_rules_updated_at before update on public.merchant_rules for each row execute function public.set_finwise_updated_at();
drop trigger if exists set_merchant_logos_updated_at on public.merchant_logos;
create trigger set_merchant_logos_updated_at before update on public.merchant_logos for each row execute function public.set_finwise_updated_at();
drop trigger if exists set_budgets_updated_at on public.budgets;
create trigger set_budgets_updated_at before update on public.budgets for each row execute function public.set_finwise_updated_at();


-- Conflict-safe offline synchronization.
alter table public.transactions
  add column if not exists client_updated_at timestamptz not null default now(),
  add column if not exists device_id text;

alter table public.statements
  add column if not exists client_updated_at timestamptz not null default now(),
  add column if not exists device_id text;

create table if not exists public.transaction_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null,
  statement_id text,
  deleted_at timestamptz not null default now(),
  device_id text,
  primary key (user_id, transaction_id)
);

create table if not exists public.sync_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists transactions_user_client_updated_idx
  on public.transactions(user_id, client_updated_at desc);
create index if not exists transaction_tombstones_user_deleted_idx
  on public.transaction_tombstones(user_id, deleted_at desc);
create index if not exists sync_devices_user_updated_idx
  on public.sync_devices(user_id, updated_at desc);

alter table public.transaction_tombstones enable row level security;
alter table public.sync_devices enable row level security;

drop policy if exists "Users can read their own transaction tombstones" on public.transaction_tombstones;
create policy "Users can read their own transaction tombstones"
on public.transaction_tombstones for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own transaction tombstones" on public.transaction_tombstones;
create policy "Users can insert their own transaction tombstones"
on public.transaction_tombstones for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own transaction tombstones" on public.transaction_tombstones;
create policy "Users can update their own transaction tombstones"
on public.transaction_tombstones for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own transaction tombstones" on public.transaction_tombstones;
create policy "Users can delete their own transaction tombstones"
on public.transaction_tombstones for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own sync devices" on public.sync_devices;
create policy "Users can read their own sync devices"
on public.sync_devices for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own sync devices" on public.sync_devices;
create policy "Users can insert their own sync devices"
on public.sync_devices for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own sync devices" on public.sync_devices;
create policy "Users can update their own sync devices"
on public.sync_devices for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own sync devices" on public.sync_devices;
create policy "Users can delete their own sync devices"
on public.sync_devices for delete to authenticated
using (auth.uid() = user_id);

drop trigger if exists set_sync_devices_updated_at on public.sync_devices;
create trigger set_sync_devices_updated_at
before update on public.sync_devices
for each row execute function public.set_finwise_updated_at();
