-- تشخيص الأعطال (Dead-letter): نخزّن مع كل فشل قراءةً مفهومة للمستخدم
-- بدل كود الخطأ الخام، حتى لا يُعاد استدعاء النموذج على كل فتح للصفحة.
--
-- الشكل المخزَّن (jsonb):
--   { cause, message, message_en, action, action_label, severity, provider, at }
--
-- الملف قابل لإعادة التنفيذ بأمان (idempotent).

alter table public.runs
  add column if not exists diagnosis jsonb;

alter table public.test_runs
  add column if not exists diagnosis jsonb;

comment on column public.runs.diagnosis is
  'تشخيص مقروء للفشل — يُولَّد مرة واحدة عند وقوعه';
comment on column public.test_runs.diagnosis is
  'تشخيص مقروء لفشل التجربة — يُولَّد مرة واحدة عند وقوعه';
