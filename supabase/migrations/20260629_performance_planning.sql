-- Performance analytics and financial planning.
create table if not exists public.financial_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.financial_goals enable row level security;
drop policy if exists "Users can read their own financial goals" on public.financial_goals;
create policy "Users can read their own financial goals" on public.financial_goals for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert their own financial goals" on public.financial_goals;
create policy "Users can insert their own financial goals" on public.financial_goals for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own financial goals" on public.financial_goals;
create policy "Users can update their own financial goals" on public.financial_goals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own financial goals" on public.financial_goals;
create policy "Users can delete their own financial goals" on public.financial_goals for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists set_financial_goals_updated_at on public.financial_goals;
create trigger set_financial_goals_updated_at before update on public.financial_goals for each row execute function public.set_finwise_updated_at();

create or replace function public.get_finwise_dashboard_metrics()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with base as (
  select * from public.transactions where user_id = auth.uid()
),
category_rows as (
  select to_char(date, 'YYYY-MM') as month, category, sum(amount)::numeric as amount
  from base where direction = 'expense' group by 1, 2
),
daily_rows as (
  select date::text as date, sum(amount)::numeric as amount from base where direction = 'expense' group by 1
),
monthly_rows as (
  select to_char(date, 'YYYY-MM') as month, sum(amount)::numeric as amount from base where direction = 'expense' group by 1
),
merchant_grouped as (
  select to_char(date, 'YYYY-MM') as month, merchant, sum(amount)::numeric as amount, count(*)::integer as count
  from base where direction = 'expense' group by 1, 2
),
merchant_ranked as (
  select *, row_number() over (partition by month order by amount desc) as rank from merchant_grouped
)
select jsonb_build_object(
  'transactionCount', (select count(*) from base),
  'statementCount', (select count(distinct statement_id) from base where statement_id is not null),
  'needsReview', (select count(*) from base where needs_review or confidence < 0.75),
  'totalIncome', coalesce((select sum(amount) from base where direction = 'income'), 0),
  'totalExpenses', coalesce((select sum(amount) from base where direction = 'expense'), 0),
  'latestDate', (select max(date)::text from base),
  'categoryTotals', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'category', category, 'amount', amount) order by month, amount desc) from category_rows), '[]'::jsonb),
  'dailyExpenses', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'amount', amount) order by date) from daily_rows), '[]'::jsonb),
  'monthlyExpenses', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'amount', amount) order by month) from monthly_rows), '[]'::jsonb),
  'merchantTotals', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'merchant', merchant, 'amount', amount, 'count', count) order by month, amount desc) from merchant_ranked where rank <= 10), '[]'::jsonb)
);
$$;

grant execute on function public.get_finwise_dashboard_metrics() to authenticated;
