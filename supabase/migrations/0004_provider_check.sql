-- توسيع قيد المزوّدين في connections.
--
-- كان يسمح بستة فقط، فيرفض google_slides وgoogle_calendar وgoogle_docs
-- بصمت أثناء upsert: الاعتماد يُنشأ في المحرّك ثم يفشل ربطه بالمستخدم.
-- (وinstagram وtiktok كانا مرفوضين أيضًا رغم وجودهما في الواجهة.)
--
-- الملف قابل لإعادة التنفيذ بأمان (idempotent).

alter table public.connections
  drop constraint if exists connections_provider_check;

alter table public.connections
  add constraint connections_provider_check check (
    provider = any (array[
      'gmail', 'google_sheets', 'google_drive',
      'google_slides', 'google_calendar', 'google_docs',
      'openai', 'telegram', 'slack', 'instagram', 'tiktok'
    ]::text[])
  );
