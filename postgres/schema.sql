-- Run once as the schema owner in a fresh, ordinary PostgreSQL database.
-- Keep Supabase deployments on supabase/schema.sql instead.
-- Provision a separate LOGIN role with a generated password, grant migsak_app
-- to it, and use that login's connection string as the server-only DATABASE_URL.
-- The application's login must not own these tables or have BYPASSRLS.
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'migsak_app') then
    create role migsak_app nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end;
$$;

revoke all on schema public from public;
grant usage on schema public to migsak_app;

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
revoke all on table public.enquiries from public, migsak_app;
grant select, insert on table public.enquiries to migsak_app;
create policy app_read_enquiries on public.enquiries for select to migsak_app using (true);
create policy app_insert_enquiries on public.enquiries for insert to migsak_app with check (true);

create schema if not exists private;
revoke all on schema private from public, migsak_app;

create table private.rate_limit_buckets (
  bucket text primary key check (char_length(bucket) <= 160),
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index rate_limit_expiry on private.rate_limit_buckets (expires_at);
alter table private.rate_limit_buckets enable row level security;
revoke all on table private.rate_limit_buckets from public, migsak_app;

-- The app can perform this bounded operation but cannot read or edit the
-- private counters directly. The schema owner executes the function.
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

revoke all on function public.consume_rate_limit(text, integer, integer) from public, migsak_app;
grant execute on function public.consume_rate_limit(text, integer, integer) to migsak_app;

commit;
