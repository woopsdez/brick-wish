-- Brick Wish: スキーマ
-- 認可方式: クライアントが送る HTTP ヘッダ x-family-code と行の family_id を RLS で突き合わせる。
-- ファミリーコードを知っている人は誰でもその家族の行を読める「ゆるい」保護（内容はレゴの欲しい物リスト）。
-- 本格運用なら Supabase Auth に置き換えること。

create extension if not exists pgcrypto;

create or replace function public.request_family_code() returns text
language sql stable as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-family-code', '')
$$;

create table if not exists public.families (
  code        text primary key check (code ~ '^[A-Z0-9]{6}$'),
  pin_hash    text,
  created_at  timestamptz not null default now()
);

create table if not exists public.requests (
  id           uuid primary key,
  family_id    text not null references public.families(code) on delete cascade,
  kid_name     text not null default '',
  note         text not null default '',
  items        jsonb not null default '[]'::jsonb,
  status       text not null default 'pending' check (status in ('pending','approved','rejected','ordered')),
  parent_note  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists requests_family_created on public.requests (family_id, created_at desc);

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  family_id   text not null references public.families(code) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_family on public.push_subscriptions (family_id);

alter table public.families enable row level security;
alter table public.requests enable row level security;
alter table public.push_subscriptions enable row level security;

-- families: 自分のコードの行だけ読める。作成は誰でも可（コードが衝突したら PK で失敗）。PIN 更新は自分のコードのみ。
drop policy if exists families_select on public.families;
create policy families_select on public.families for select
  using (code = public.request_family_code());
drop policy if exists families_insert on public.families;
create policy families_insert on public.families for insert
  with check (code = public.request_family_code());
drop policy if exists families_update on public.families;
create policy families_update on public.families for update
  using (code = public.request_family_code())
  with check (code = public.request_family_code());

-- requests
drop policy if exists requests_all on public.requests;
create policy requests_all on public.requests for all
  using (family_id = public.request_family_code())
  with check (family_id = public.request_family_code());

-- push_subscriptions: 書き込みは自分の家族のみ。読み出しは Edge Function（service role）だけに限定
drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions for insert
  with check (family_id = public.request_family_code());
drop policy if exists push_update on public.push_subscriptions;
create policy push_update on public.push_subscriptions for update
  using (family_id = public.request_family_code())
  with check (family_id = public.request_family_code());
drop policy if exists push_select on public.push_subscriptions;
create policy push_select on public.push_subscriptions for select
  using (family_id = public.request_family_code());

grant usage on schema public to anon;
grant select, insert, update on public.families to anon;
grant select, insert, update on public.requests to anon;
grant select, insert, update on public.push_subscriptions to anon;
