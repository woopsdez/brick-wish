-- 月の枠を単位にする。pay_month はそのリクエストを払う月（YYYY-MM）。子どもが「来月に回す」と未来の月が入る
alter table public.requests
  add column if not exists pay_month text check (pay_month ~ '^[0-9]{4}-[0-9]{2}$');
