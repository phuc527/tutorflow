-- =============================================================================
-- Minimal emulation of the pieces of a Supabase database that our migrations rely on,
-- so they can be tested in a plain Postgres (PGlite) without Docker or a hosted project.
-- NOT a migration: never run this against a real Supabase database.
-- =============================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema extensions;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Same definition Supabase uses: the `sub` claim of the request's JWT.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase's default grants on the public schema: API roles get ALL on new tables,
-- and RLS is what actually restricts them. Our migrations then tighten these.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
