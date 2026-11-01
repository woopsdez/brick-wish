-- 月予算による自動承認と、リクエストの見積もり合計
alter table public.families
  add column if not exists monthly_budget_yen integer not null default 1000,
  add column if not exists auto_approve boolean not null default true;

alter table public.requests
  add column if not exists total_yen integer,
  add column if not exists approved_by text check (approved_by in ('auto', 'parent')),
  add column if not exists cart_url text;
