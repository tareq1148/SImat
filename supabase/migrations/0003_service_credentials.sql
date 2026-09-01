-- معرّفات اعتمادات n8n لخدمات جوجل الخمس (Drive, Sheets, Slides, Calendar, Docs).
--
-- تُخزَّن هنا لا في connections لأننا نحتاجها عند إعادة الربط لحذف الاعتماد
-- القديم قبل إنشاء بديله — وconnections قد يُلغى صفّها بينما التوكن باقٍ.
--
-- الشكل: { "drive": "abc123", "sheets": "def456", ... }
-- الملف قابل لإعادة التنفيذ بأمان (idempotent).

alter table public.oauth_tokens
  add column if not exists service_credentials jsonb not null default '{}'::jsonb;

comment on column public.oauth_tokens.service_credentials is
  'معرّفات اعتمادات n8n لكل خدمة جوجل — تُستبدل عند كل إعادة ربط';
