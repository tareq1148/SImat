-- توكنات OAuth لكل مستخدم (Gmail وما يليه).
--
-- ملاحظة أمنية: هذا الجدول لا يحمل أي سياسة RLS عمدًا.
-- تفعيل RLS بلا سياسات = لا وصول لأي عميل بمفتاح anon أو authenticated،
-- والوصول الوحيد عبر service_role الذي يتجاوز RLS من الخادم.
-- لهذا لا تُخزَّن التوكنات في جدول connections: الواجهة تقرأ منه مباشرة
-- بمفتاح المتصفح، فكان أي refresh_token فيه مكشوفًا للعميل.

create table if not exists public.oauth_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  provider      text not null,
  access_token  text,
  refresh_token text,
  scope         text,
  token_type    text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint oauth_tokens_user_provider_key unique (user_id, provider)
);

alter table public.oauth_tokens enable row level security;

-- لا CREATE POLICY هنا. أي إضافة سياسة لاحقًا تفتح التوكنات للعميل.

create index if not exists oauth_tokens_user_idx on public.oauth_tokens (user_id);

comment on table public.oauth_tokens is
  'توكنات OAuth للمستخدمين — وصول service_role فقط، لا سياسات RLS عمدًا';
