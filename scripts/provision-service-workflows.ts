// يولّد مسارات n8n للخدمات الخمس: Webhook ← فحص النبضة ← عقدة جوجل.
//
// النبضة (payload.ping) ترد فورًا بلا أي أثر جانبي — فحص الاتصال لا يُنشئ ملفات.
// الطلب الحقيقي يمضي لعقدة الخدمة التي تُنفّذ باعتماد المستخدم في المحرّك.
//
// التشغيل:  node --experimental-strip-types scripts/provision-service-workflows.ts
//           أضف --dry لعرض ما سيُنشأ بلا إنشاء.

import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(line.trim());
  if (m && m[2]) process.env[m[1]] ??= m[2];
}

const BASE = process.env.N8N_BASE_URL ?? "";
const KEY = process.env.N8N_API_KEY ?? "";
const DRY = process.argv.includes("--dry");
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };

if (!BASE || !KEY) {
  console.error("N8N_BASE_URL أو N8N_API_KEY غير مضبوط");
  process.exit(1);
}

interface ServiceDef {
  id: string;
  label: string;
  credType: string;
  nodeType: string;
  typeVersion: number;
  /** معاملات عقدة الخدمة — التعبيرات تقرأ من حمولة الـWebhook */
  params: Record<string, unknown>;
}

const P = "$('المدخل').item.json.body.payload";

const SERVICES: ServiceDef[] = [
  {
    id: "drive",
    label: "Drive",
    credType: "googleDriveOAuth2Api",
    nodeType: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    params: {
      resource: "file",
      operation: "createFromText",
      content: `={{ ${P}.content || '' }}`,
      name: `={{ ${P}.name || 'muhawwil.txt' }}`,
      driveId: { __rl: true, mode: "list", value: "My Drive" },
      folderId: { __rl: true, mode: "list", value: "root", cachedResultName: "/ (Root folder)" },
      options: {},
    },
  },
  {
    id: "sheets",
    label: "Sheets",
    credType: "googleSheetsOAuth2Api",
    nodeType: "n8n-nodes-base.googleSheets",
    typeVersion: 4.7,
    params: {
      resource: "sheet",
      operation: "append",
      documentId: { __rl: true, mode: "url", value: `={{ ${P}.spreadsheet_id }}` },
      sheetName: { __rl: true, mode: "id", value: "0", cachedResultName: "الورقة الأولى" },
      columns: { mappingMode: "autoMapInputData", value: {}, schema: [] },
      options: { handlingExtraData: "insertInNewColumn" },
    },
  },
  {
    id: "slides",
    label: "Slides",
    credType: "googleSlidesOAuth2Api",
    nodeType: "n8n-nodes-base.googleSlides",
    typeVersion: 2,
    params: {
      resource: "presentation",
      operation: "create",
      title: `={{ ${P}.title || 'عرض من وَتيرة' }}`,
    },
  },
  {
    id: "calendar",
    label: "Calendar",
    credType: "googleCalendarOAuth2Api",
    nodeType: "n8n-nodes-base.googleCalendar",
    typeVersion: 1.3,
    params: {
      resource: "event",
      operation: "create",
      calendar: { __rl: true, mode: "list", value: "primary", cachedResultName: "primary" },
      start: `={{ ${P}.start }}`,
      end: `={{ ${P}.end }}`,
      additionalFields: { summary: `={{ ${P}.summary || 'موعد' }}` },
    },
  },
  {
    id: "docs",
    label: "Docs",
    credType: "googleDocsOAuth2Api",
    nodeType: "n8n-nodes-base.googleDocs",
    typeVersion: 2,
    params: {
      operation: "create",
      folderId: "default",
      title: `={{ ${P}.title || 'مستند من وَتيرة' }}`,
    },
  },
];

function buildWorkflow(s: ServiceDef, credentialId: string | null) {
  const node = {
    id: "svc",
    name: s.label,
    type: s.nodeType,
    typeVersion: s.typeVersion,
    position: [640, 400] as [number, number],
    parameters: s.params,
    ...(credentialId
      ? { credentials: { [s.credType]: { id: credentialId, name: `muhawwil-${s.id}` } } }
      : {}),
    onError: "continueRegularOutput",
  };

  return {
    name: `[وَتيرة] ${s.label}`,
    nodes: [
      {
        id: "hook",
        name: "المدخل",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2.1,
        position: [0, 400],
        parameters: {
          httpMethod: "POST",
          path: `muhawwil-${s.id}`,
          responseMode: "lastNode",
        },
      },
      {
        id: "isping",
        name: "نبضة فحص؟",
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: [280, 400],
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
            conditions: [
              {
                id: "c1",
                leftValue: "={{ $json.body.payload.ping }}",
                rightValue: "",
                operator: { type: "boolean", operation: "true", singleValue: true },
              },
            ],
            combinator: "and",
          },
        },
      },
      {
        // فرع النبضة: ردّ فوري بلا أي أثر جانبي
        id: "pong",
        name: "ردّ النبضة",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [640, 240],
        parameters: {
          mode: "manual",
          includeOtherFields: false,
          assignments: {
            assignments: [
              { id: "p1", name: "ok", value: "={{ true }}", type: "boolean" },
              { id: "p2", name: "pong", value: "={{ true }}", type: "boolean" },
              { id: "p3", name: "service", value: s.id, type: "string" },
            ],
          },
        },
      },
      node,
    ],
    connections: {
      المدخل: { main: [[{ node: "نبضة فحص؟", type: "main", index: 0 }]] },
      "نبضة فحص؟": {
        main: [
          [{ node: "ردّ النبضة", type: "main", index: 0 }], // true  → نبضة
          [{ node: s.label, type: "main", index: 0 }], // false → تنفيذ فعلي
        ],
      },
    },
    settings: { executionOrder: "v1" },
  };
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: H,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

/**
 * معرّفات الاعتمادات تُقرأ من Supabase (oauth_tokens.service_credentials).
 * لا يمكن تفعيل المسار بلا اعتماد — فالربط شرطٌ سابق لهذا السكربت.
 */
async function loadCredentials(): Promise<Record<string, string | null>> {
  const override = process.env.SERVICE_CREDENTIALS;
  if (override) return JSON.parse(override);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {};

  const res = await fetch(
    `${url}/rest/v1/oauth_tokens?provider=eq.google&select=service_credentials`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return {};
  const rows = (await res.json()) as { service_credentials?: Record<string, string> }[];
  // نأخذ أول صف يحمل اعتمادات فعلية
  for (const r of rows) {
    if (r.service_credentials && Object.keys(r.service_credentials).length)
      return r.service_credentials;
  }
  return {};
}

const creds = await loadCredentials();
const missing = SERVICES.filter((s) => !creds[s.id]).map((s) => s.id);
if (missing.length && !DRY) {
  console.error(
    `لا توجد اعتمادات لـ: ${missing.join("، ")}
` +
      "أعد ربط حساب جوجل من الإعدادات ← الاتصالات أولًا، فالتفعيل يتطلب اعتمادًا."
  );
  process.exit(1);
}

console.log(DRY ? "— عرض فقط، بلا إنشاء —\n" : "");

for (const s of SERVICES) {
  const wf = buildWorkflow(s, creds[s.id] ?? null);
  if (DRY) {
    console.log(
      `${s.label.padEnd(10)} path=muhawwil-${s.id.padEnd(10)} عقد=${wf.nodes.length} اعتماد=${creds[s.id] ?? "—"}`
    );
    continue;
  }

  const created = await api("POST", "/workflows", wf);
  if (!created.ok) {
    console.log(`${s.label.padEnd(10)} إنشاء ✗ ${created.status} ${created.text.slice(0, 110)}`);
    continue;
  }
  const id = JSON.parse(created.text).id as string;

  const act = await api("POST", `/workflows/${id}/activate`);
  console.log(
    `${s.label.padEnd(10)} إنشاء ✓ ${id.padEnd(18)} تفعيل ${act.ok ? "✓" : "✗ " + act.text.slice(0, 90)}`
  );
}
