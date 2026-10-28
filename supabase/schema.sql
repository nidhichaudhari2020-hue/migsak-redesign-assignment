-- Run once in Supabase SQL Editor. This application uses its own admin session;
-- browser clients and Supabase Auth users receive no direct table access.
begin;

create table public.enquiries (
  id uuid primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  project_details text not null check (char_length(trim(project_details)) between 20 and 5000),
  planner_choices jsonb not null check (
    jsonb_typeof(planner_choices) = 'object'
    and planner_choices ?& array['service', 'integrations', 'start']
    and (planner_choices - array['service', 'integrations', 'start']) = '{}'::jsonb
    and jsonb_typeof(planner_choices->'service') = 'string'
    and jsonb_typeof(planner_choices->'start') = 'string'
    and planner_choices->>'service' in ('website', 'web-app', 'mobile-app', 'automation', 'integration', 'unsure')
    and planner_choices->>'start' in ('asap', 'month', 'quarter', 'exploring')
    and jsonb_typeof(planner_choices->'integrations') = 'array'
    and jsonb_array_length(planner_choices->'integrations') <= 5
    and planner_choices->'integrations' <@ '["payments", "whatsapp", "crm", "erp", "accounting"]'::jsonb
  )
);

create index enquiries_newest_first on public.enquiries (created_at desc, id desc);
alter table public.enquiries enable row level security;
revoke all on table public.enquiries from public, anon, authenticated, service_role;
grant select, insert on table public.enquiries to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.rate_limit_buckets (
  bucket text primary key check (char_length(bucket) <= 160),
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index rate_limit_expiry on private.rate_limit_buckets (expires_at);
alter table private.rate_limit_buckets enable row level security;
revoke all on table private.rate_limit_buckets from public, anon, authenticated, service_role;

-- Security-definer grants only this bounded operation, never direct table access.
-- A single atomic upsert prevents parallel requests from racing past the limit.
create function public.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hits integer;
begin
  if p_bucket is null or char_length(p_bucket) not between 1 and 160
     or p_limit is null or p_limit not between 1 and 1000
     or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  -- Bound maintenance work per request; locks are skipped under concurrency.
  delete from private.rate_limit_buckets where bucket in (
    select bucket from private.rate_limit_buckets
    where expires_at < v_now - interval '1 day'
    order by expires_at limit 100 for update skip locked
  );

  insert into private.rate_limit_buckets as b (bucket, hits, expires_at)
  values (p_bucket, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update set
    hits = case when b.expires_at <= v_now then 1 else least(b.hits + 1, p_limit + 1) end,
    expires_at = case when b.expires_at <= v_now
      then v_now + make_interval(secs => p_window_seconds) else b.expires_at end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

commit;
