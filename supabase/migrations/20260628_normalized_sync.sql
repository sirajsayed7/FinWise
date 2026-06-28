-- Apply after supabase/schema.sql on an existing FinWise project.
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
on public.transaction_tombstones for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own transaction tombstones" on public.transaction_tombstones;
create policy "Users can insert their own transaction tombstones"
on public.transaction_tombstones for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own transaction tombstones" on public.transaction_tombstones;
create policy "Users can update their own transaction tombstones"
on public.transaction_tombstones for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own transaction tombstones" on public.transaction_tombstones;
create policy "Users can delete their own transaction tombstones"
on public.transaction_tombstones for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own sync devices" on public.sync_devices;
create policy "Users can read their own sync devices"
on public.sync_devices for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own sync devices" on public.sync_devices;
create policy "Users can insert their own sync devices"
on public.sync_devices for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own sync devices" on public.sync_devices;
create policy "Users can update their own sync devices"
on public.sync_devices for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own sync devices" on public.sync_devices;
create policy "Users can delete their own sync devices"
on public.sync_devices for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists set_sync_devices_updated_at on public.sync_devices;
create trigger set_sync_devices_updated_at
before update on public.sync_devices
for each row execute function public.set_finwise_updated_at();
