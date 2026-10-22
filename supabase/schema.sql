-- Marketing Scholars: run once in Supabase > SQL Editor > New query > Run.
-- Safe to run again.

create table if not exists public.report_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  email         text not null,
  tier          text not null check (tier in ('free', 'pro')),
  inputs        jsonb not null,
  status        text not null check (status in ('awaiting_payment', 'awaiting_confirmation', 'building', 'sent', 'failed')),
  token_hash    text unique,
  confirmed_at  timestamptz,
  claimed_at    timestamptz,
  sent_at       timestamptz,
  order_id      text unique,
  payment_id    text,
  engine        text,
  error         text,
  ip            text,
  report        jsonb
);

create index if not exists report_requests_created_at_idx on public.report_requests (created_at desc);
create index if not exists report_requests_email_idx on public.report_requests (email);

-- Only the server (secret / service_role key) may touch this table.
-- RLS on with no policies means the public anon key can read and write nothing.
alter table public.report_requests enable row level security;
revoke all on table public.report_requests from anon, authenticated;
grant all on table public.report_requests to service_role;
