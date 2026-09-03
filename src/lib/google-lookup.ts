// البحث عن ملفات المستخدم في Drive باسمها.
//
// المستخدم يصف مهمته بأسماء بشرية («جدول منتجات»)، وواجهات جوجل لا تعرف إلا
// المعرّفات. وما دام قد ربط حسابه فلا معنى لمطالبته بلصق رابط: نبحث عنه بحسابه.

import { getValidGoogleAccessToken } from "./google-tokens";

const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";

export const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";
export const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveMatch {
  id: string;
  name: string;
}

/** يهرب علامات الاقتباس المفردة داخل استعلام Drive */
function escapeName(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * يبحث عن ملف بالاسم في Drive المستخدم. يرجع المطابقات مرتّبة بالأحدث.
 * لا يرمي: تعذّر البحث يعود كقائمة فارغة ليقرر المستدعي.
 */
export async function findDriveFilesByName(
  userId: string,
  name: string,
  mimeType?: string
): Promise<DriveMatch[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const token = await getValidGoogleAccessToken(userId);
  if (!token.ok) return [];

  // name= يطابق تمامًا، وcontains يلتقط «جدول منتجات» حين سُمّي «منتجات»
  const clauses = [
    `(name = '${escapeName(trimmed)}' or name contains '${escapeName(trimmed)}')`,
    "trashed = false",
  ];
  if (mimeType) clauses.push(`mimeType = '${mimeType}'`);

  const url =
    `${DRIVE_FILES}?q=${encodeURIComponent(clauses.join(" and "))}` +
    "&fields=files(id,name)&orderBy=modifiedTime desc&pageSize=10" +
    "&supportsAllDrives=true&includeItemsFromAllDrives=true";

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { files?: DriveMatch[] };
    return data.files ?? [];
  } catch {
    return [];
  }
}

/**
 * ينزع كلمة الوعاء من الاسم: المستخدم يقول «تيبل منتجات» و«جدول الطلبات»
 * و«شيت العملاء»، والملف في Drive اسمه «منتجات». وDrive يطابق بالاحتواء،
 * فالاسم كاملًا لا يجد شيئًا بينما جوهره يجده.
 */
const CONTAINER_WORDS =
  /^\s*(?:ال)?(?:تيبل|تابل|تبل|table|جدول|جداول|شيت|شيتس|sheets?|spreadsheet|ملف|ورقة)\s+/i;

export function bareSheetName(name: string): string {
  return name.replace(CONTAINER_WORDS, "").trim();
}

/** المطابقة الوحيدة أو الأدقّ اسمًا — وإلا null ليبقى النقص ظاهرًا للمستخدم */
export async function resolveSpreadsheetId(
  userId: string,
  name: string
): Promise<string | null> {
  // الاسم كما قيل أوّلًا، فإن خلا فبجوهره بعد نزع كلمة الوعاء
  const tries = [name.trim()];
  const bare = bareSheetName(name);
  if (bare && bare !== tries[0]) tries.push(bare);

  for (const candidate of tries) {
    const files = await findDriveFilesByName(userId, candidate, SPREADSHEET_MIME);
    if (files.length === 0) continue;
    if (files.length === 1) return files[0].id;

    // تطابق تامّ يفصل عند تعدّد المطابقات؛ وإلا لا نخمّن
    const exact = files.filter(
      (f) => f.name.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (exact.length === 1) return exact[0].id;
  }
  return null;
}

/** ملفّات المستخدم من نوعٍ بعينه، الأحدث أولًا — يختار منها بدل أن يكتب اسمًا */
export async function listDriveFilesByType(
  userId: string,
  mimeType: string,
  limit = 8
): Promise<DriveMatch[]> {
  const token = await getValidGoogleAccessToken(userId);
  if (!token.ok) return [];
  const url =
    `${DRIVE_FILES}?q=${encodeURIComponent(
      `mimeType = '${mimeType}' and trashed = false`
    )}` +
    `&fields=files(id,name)&orderBy=modifiedTime desc&pageSize=${limit}` +
    "&supportsAllDrives=true&includeItemsFromAllDrives=true";
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { files?: DriveMatch[] };
    return data.files ?? [];
  } catch {
    return [];
  }
}

/** جداول المستخدم — الاستعمال الأشيع، يبقى باسمه لوضوح موضع النداء */
export function listSpreadsheets(userId: string, limit = 8): Promise<DriveMatch[]> {
  return listDriveFilesByType(userId, SPREADSHEET_MIME, limit);
}

// ===== الإنشاء عند الغياب =====
//
// المستخدم يسمّي ما يريد في كلامه: «جدول منتجات»، «ورقة جديدة»، «مجلّد
// الصور». وكان ما لا يوجد يوقف المسار ويطالبه بما لا يملك — فيخرج من
// الشاشة ليصنعه بيده ثم يعود. وما دام قد ربط حسابه فالمنصّة تصنعه عنه.

async function createDriveFile(
  userId: string,
  name: string,
  mimeType: string
): Promise<DriveMatch | null> {
  const token = await getValidGoogleAccessToken(userId);
  if (!token.ok) return null;
  try {
    const res = await fetch(`${DRIVE_FILES}?fields=id,name`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, mimeType }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as DriveMatch;
    return d.id ? d : null;
  } catch {
    return null;
  }
}

/**
 * الجدول باسمه، ويُنشأ إن لم يوجد.
 *
 * ولا يُنشأ عند الالتباس: resolveSpreadsheetId يردّ فراغًا حين يتعدّد
 * المتشابهون لأنه لا يخمّن، ولو بنينا الإنشاء على فراغه لصنعنا ثالثًا كلّما
 * وُجد اثنان — فيتكاثر ما نظنّ أننا نوفّره. فإن وُجد شيءٌ اختير الأحدث،
 * ولا يُنشأ إلا حين لا يوجد شيء البتّة.
 */
export async function ensureSpreadsheet(
  userId: string,
  name: string
): Promise<{ id: string; created: boolean } | null> {
  const bare = bareSheetName(name);
  const tries = [name.trim(), ...(bare && bare !== name.trim() ? [bare] : [])];

  for (const candidate of tries) {
    const files = await findDriveFilesByName(userId, candidate, SPREADSHEET_MIME);
    if (files.length === 0) continue;
    // القائمة مرتّبة بالأحدث تعديلًا: التطابق التامّ أولًا ثم أوّل ما وُجد
    const exact = files.find(
      (f) => f.name.trim().toLowerCase() === candidate.toLowerCase()
    );
    return { id: (exact ?? files[0]).id, created: false };
  }

  // يُنشأ بجوهر الاسم لا بوعائه: «تيبل منتجات» يصير ملفًّا اسمه «منتجات»
  const made = await createDriveFile(userId, bare || name.trim(), SPREADSHEET_MIME);
  return made ? { id: made.id, created: true } : null;
}

/** المجلّد باسمه، ويُنشأ إن لم يوجد */
export async function ensureFolder(
  userId: string,
  name: string
): Promise<{ id: string; created: boolean } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const files = await findDriveFilesByName(userId, trimmed, FOLDER_MIME);
  const exact = files.find(
    (f) => f.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return { id: exact.id, created: false };
  if (files.length === 1) return { id: files[0].id, created: false };

  const made = await createDriveFile(userId, trimmed, FOLDER_MIME);
  return made ? { id: made.id, created: true } : null;
}

/**
 * ورقةٌ داخل جدول — تُنشأ إن لم تكن فيه. الورقة ليست ملفًّا في درايف بل
 * لسانٌ داخل الجدول، فلا يجدها بحث الملفّات ولا تُصنع بواجهته.
 */
export async function ensureSheetTab(
  userId: string,
  spreadsheetId: string,
  tabName: string
): Promise<{ created: boolean } | null> {
  const title = tabName.trim();
  if (!title) return null;
  const token = await getValidGoogleAccessToken(userId);
  if (!token.ok) return null;

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  try {
    const res = await fetch(`${base}?fields=sheets(properties(title))`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      sheets?: { properties?: { title?: string } }[];
    };
    const exists = (d.sheets ?? []).some(
      (s) => (s.properties?.title ?? "").trim().toLowerCase() === title.toLowerCase()
    );
    if (exists) return { created: false };

    const add = await fetch(`${base}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    return add.ok ? { created: true } : null;
  } catch {
    return null;
  }
}
