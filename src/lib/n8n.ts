// عميل محرك التنفيذ — n8n REST API (يبقى مخفيًا عن المستخدم تمامًا)

const BASE = process.env.N8N_BASE_URL ?? "https://tariq-1148.app.n8n.cloud";
const API = `${BASE}/api/v1`;

export class N8nError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function headers(): Record<string, string> {
  const key = process.env.N8N_API_KEY;
  if (!key) {
    throw new N8nError(
      0,
      "N8N_API_KEY غير مضبوط — أضف مفتاح n8n API في .env.local"
    );
  }
  return {
    "X-N8N-API-KEY": key,
    "Content-Type": "application/json",
  };
}

async function api<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new N8nError(res.status, `n8n API ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export interface N8nWorkflowPayload {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings: { executionOrder: string; errorWorkflow?: string };
}

export async function createWorkflow(
  payload: N8nWorkflowPayload
): Promise<{ id: string }> {
  return api("POST", "/workflows", payload);
}

export async function updateWorkflow(
  id: string,
  payload: N8nWorkflowPayload
): Promise<{ id: string }> {
  return api("PUT", `/workflows/${id}`, payload);
}

export async function activateWorkflow(id: string): Promise<void> {
  await api("POST", `/workflows/${id}/activate`);
}

export async function deactivateWorkflow(id: string): Promise<void> {
  await api("POST", `/workflows/${id}/deactivate`);
}

export async function createN8nCredential(
  name: string,
  type: string,
  data: Record<string, string>
): Promise<{ id: string }> {
  return api("POST", "/credentials", { name, type, data });
}

// استدعاء Webhook الإنتاجي لسير عمل مفعّل
export async function callFlowWebhook(
  path: string,
  body: unknown
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`${BASE}/webhook/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

// استئناف عقدة الانتظار بعد قرار الموافقة
export async function resumeExecution(
  resumeUrl: string,
  body: unknown
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(resumeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

export function hasN8nKey(): boolean {
  return Boolean(process.env.N8N_API_KEY);
}

export interface N8nExecutionInfo {
  id: string;
  status: string;
  finished: boolean;
  errorNode: string | null;
  errorMessage: string | null;
}

export async function getExecution(id: string): Promise<N8nExecutionInfo> {
  const e = await api<{
    status: string;
    finished: boolean;
    data?: {
      resultData?: {
        error?: { message?: string; node?: { name?: string } };
        lastNodeExecuted?: string;
      };
    };
  }>("GET", `/executions/${id}?includeData=true`);
  const err = e.data?.resultData?.error;
  return {
    id,
    status: e.status,
    finished: e.finished,
    errorNode: err?.node?.name ?? e.data?.resultData?.lastNodeExecuted ?? null,
    errorMessage: err?.message ?? null,
  };
}
