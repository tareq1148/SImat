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

/** جداول المستخدم الأحدث — تُعرض له ليختار بالاسم بدل أن يُطالَب برابط */
export async function listSpreadsheets(
  userId: string,
  limit = 8
): Promise<DriveMatch[]> {
  const token = await getValidGoogleAccessToken(userId);
  if (!token.ok) return [];
  const url =
    `${DRIVE_FILES}?q=${encodeURIComponent(
      `mimeType = '${SPREADSHEET_MIME}' and trashed = false`
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
