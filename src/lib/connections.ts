import type { Provider } from "./types";

// المواقع التي تتطلب API/توكن من المستخدم — لا تُعتبر «متصلة» إلا باتصال مسجّل المصدر:
// source="user" (أدخل بياناته بنفسه) أو source="platform" (اختار اعتماد المنصة صراحة).
// الصفوف القديمة بلا مصدر = غير متصلة — فيظهر زر «اتصل» ويُطلب الـAPI.
export const TOKEN_PROVIDERS = new Set<Provider>(["telegram", "slack", "tiktok", "openai"]);

export interface ConnLike {
  provider: Provider | string;
  status?: string;
  metadata?: unknown;
}

export function isActiveConnection(c: ConnLike): boolean {
  if (c.status && c.status !== "connected") return false;
  if (!TOKEN_PROVIDERS.has(c.provider as Provider)) return true;
  const src = (c.metadata as { source?: string } | null | undefined)?.source;
  return src === "user" || src === "platform";
}

export function activeConnections<T extends ConnLike>(
  rows: T[] | null | undefined
): T[] {
  return (rows ?? []).filter(isActiveConnection);
}
