-- توكنات OAuth لكل مستخدم (Gmail وما يليه).
--
-- ملاحظة أمنية: هذا الجدول لا يحمل أي سياسة RLS عمدًا.
-- تفعيل RLS بلا سياسات = لا وصول لأي عميل بمفتاح anon أو authenticated،
-- والوصول الوحيد عبر service_role الذي يتجاوز RLS من الخادم.
-- لهذا لا تُخزَّن التوكنات في جدول connections: الواجهة تقرأ منه مباشرة
-- بمفتاح المتصفح، فكان أي refresh_token فيه مكشوفًا للعميل.
--
-- الملف قابل لإعادة التنفيذ بأمان (idempotent).

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

-- حالة انتهاء صلاحية refresh_token (جوجل يرجع invalid_grant):
-- يحدث بعد ٧ أيام ما دامت شاشة الموافقة في وضع Testing، أو عند سحب المستخدم للإذن.
alter table public.oauth_tokens
  add column if not exists needs_reauth boolean not null default false;
alter table public.oauth_tokens
  add column if not exists last_error text;

-- معرّف اعتماد n8n المُنشأ من هذه التوكنات — نحتاجه لحذفه أو استبداله عند إعادة الربط
alter table public.oauth_tokens
  add column if not exists n8n_credential_id text;

alter table public.oauth_tokens enable row level security;

-- لا CREATE POLICY هنا. أي إضافة سياسة لاحقًا تفتح التوكنات للعميل.

create index if not exists oauth_tokens_user_idx on public.oauth_tokens (user_id);

comment on table public.oauth_tokens is
  'توكنات OAuth للمستخدمين — وصول service_role فقط، لا سياسات RLS عمدًا';
