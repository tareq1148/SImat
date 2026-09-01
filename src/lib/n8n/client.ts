// موزّع استدعاءات n8n — كل إجراء على خدمات جوجل يمر من هنا.
//
// المنصة لا تنادي واجهات جوجل مباشرة: تُرسل الإجراء إلى Webhook في المحرك
// ومعه توكن المستخدم، فينفّذه n8n. هذا يُبقي منطق التنفيذ في مكان واحد
// ويجعل الاعتمادات تحت إدارة المحرك لا التطبيق.

import { getValidGoogleAccessToken } from "@/lib/google-tokens";

// ===== الإجراءات المدعومة =====

export const WORKFLOW_ACTIONS = {
  "drive:create": "drive",
  "drive:list": "drive",
  "sheets:append": "sheets",
  "sheets:read": "sheets",
  "slides:create": "slides",
  "calendar:createEvent": "calendar",
  "calendar:list": "calendar",
  "docs:create": "docs",
} as const;

export type WorkflowAction = keyof typeof WORKFLOW_ACTIONS;
export type ServiceOf<A extends WorkflowAction> = (typeof WORKFLOW_ACTIONS)[A];

export function isWorkflowAction(v: string): v is WorkflowAction {
  return v in WORKFLOW_ACTIONS;
}

/** خدمة الإجراء — تُستخدم لاختيار مسار الـWebhook */
export function serviceOf(action: WorkflowAction): string {
  return WORKFLOW_ACTIONS[action];
}

// ===== الإعداد =====

interface N8nConfig {
  baseUrl: string;
  apiKey: string | null;
}

/**
 * قاعدة عنوان الـWebhook.
 * N8N_WEBHOOK_BASE_URL أولًا، ثم N8N_BASE_URL/webhook كي لا يتكرر الإعداد
 * على مَن ضبط المحرك أصلًا.
 */
function config(): { config: N8nConfig } | { error: string } {
  const explicit = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, "");
  const fallback = process.env.N8N_BASE_URL?.replace(/\/+$/, "");
  const baseUrl = explicit || (fallback ? `${fallback}/webhook` : "");
  if (!baseUrl)
    return {
      error:
        "N8N_WEBHOOK_BASE_URL غير مضبوط في .env.local (ولا N8N_BASE_URL كبديل)",
    };
  return { config: { baseUrl, apiKey: process.env.N8N_API_KEY ?? null } };
}

// ===== النتيجة =====

export interface N8nResult<T = unknown> {
  ok: boolean;
  status: number;
  action: WorkflowAction;
  service: string;
  /** جسم الرد من المحرك إن كان JSON */
  data?: T;
  /** رسالة عربية جاهزة للعرض عند الفشل */
  error?: string;
  /** زمن التنفيذ بالمللي — يغذّي عرض التقدّم في اللوحة */
  ms: number;
}

export interface TriggerOptions {
  /** يُرفق توكن جوجل الصالح للمستخدم في الحمولة (افتراضيًا نعم) */
  userId?: string;
  forwardToken?: boolean;
  timeoutMs?: number;
  /** مسار Webhook مخصّص بدل المشتقّ من الإجراء */
  path?: string;
}

function friendly(status: number, body: string): string {
  if (status === 404 && /not registered/i.test(body))
    return "مسار n8n غير مفعّل — فعّل سير العمل المقابل في المحرك أولًا.";
  if (status === 401 || status === 403)
    return "المحرك رفض الطلب — تحقّق من N8N_API_KEY.";
  if (status === 0) return "تعذّر الوصول لمحرك التنفيذ.";
  return `فشل التنفيذ في المحرك (${status}): ${body.slice(0, 160)}`;
}

/**
 * يشغّل إجراءً على المحرك.
 * لا يرمي: كل الحالات تعود في N8nResult ليقرّر المستدعي.
 */
export async function triggerN8nWorkflow<T = unknown>(
  workflowAction: WorkflowAction | string,
  payload: Record<string, unknown>,
  options: TriggerOptions = {}
): Promise<N8nResult<T>> {
  const started = Date.now();

  if (!isWorkflowAction(workflowAction)) {
    return {
      ok: false,
      status: 400,
      action: workflowAction as WorkflowAction,
      service: "unknown",
      error: `إجراء غير معروف: ${workflowAction}`,
      ms: 0,
    };
  }
  const service = serviceOf(workflowAction);

  const cfg = config();
  if ("error" in cfg)
    return { ok: false, status: 0, action: workflowAction, service, error: cfg.error, ms: 0 };

  // توكن المستخدم يُمرَّر للمحرك ليعمل باسمه لا باسم المنصة
  let accessToken: string | undefined;
  if (options.forwardToken !== false && options.userId) {
    const t = await getValidGoogleAccessToken(options.userId);
    if (!t.ok) {
      return {
        ok: false,
        status: 0,
        action: workflowAction,
        service,
        error:
          t.reason === "needs_reauth"
            ? "انتهت صلاحية ربط حساب جوجل — أعد الربط."
            : t.reason === "not_connected"
              ? "حساب جوجل غير مربوط."
              : (t.error ?? "تعذّر الحصول على توكن جوجل"),
        ms: Date.now() - started,
      };
    }
    accessToken = t.accessToken;
  }

  const path = options.path ?? `muhawwil-${service}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.config.apiKey) headers["X-N8N-API-KEY"] = cfg.config.apiKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const res = await fetch(`${cfg.config.baseUrl}/${path}`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        action: workflowAction,
        service,
        payload,
        // الاعتماد يصل هنا؛ لا يُخزَّن في المحرك ولا يظهر في الواجهة
        ...(accessToken ? { google: { access_token: accessToken } } : {}),
      }),
    });

    const text = await res.text();
    const ms = Date.now() - started;

    if (!res.ok)
      return {
        ok: false,
        status: res.status,
        action: workflowAction,
        service,
        error: friendly(res.status, text),
        ms,
      };

    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      data = text as unknown as T; // ردّ غير JSON — نمرّره كما هو
    }
    return { ok: true, status: res.status, action: workflowAction, service, data, ms };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      action: workflowAction,
      service,
      error: aborted ? "انتهت مهلة انتظار المحرك" : friendly(0, ""),
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** نبضة فحص لخدمة واحدة — تُستخدم في صفحة اختبار التكاملات */
export async function pingService(
  service: string,
  userId?: string
): Promise<N8nResult> {
  const action = (
    {
      drive: "drive:list",
      sheets: "sheets:read",
      slides: "slides:create",
      calendar: "calendar:list",
      docs: "docs:create",
    } as Record<string, WorkflowAction>
  )[service];

  if (!action)
    return {
      ok: false,
      status: 400,
      action: "drive:list",
      service,
      error: `خدمة غير معروفة: ${service}`,
      ms: 0,
    };

  return triggerN8nWorkflow(action, { ping: true }, { userId, timeoutMs: 12_000 });
}
