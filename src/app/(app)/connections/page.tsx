"use client";

// شاشة الاتصالات — إدارة التكاملات الثمانية من مكان واحد

import { useCallback, useEffect, useState } from "react";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";
import { providerIcon } from "@/components/icons";

const PROVIDER_DESC: Record<Provider, string> = {
  gmail: "إرسال واستقبال البريد ضمن مساراتك — كل إرسال بموافقتك.",
  google_sheets: "قراءة الجداول وإضافة الصفوف تلقائيًا.",
  google_drive: "حفظ الملفات والمرفقات في مجلداتك.",
  openai: "خطوات الذكاء الاصطناعي: تلخيص، استخراج، صياغة.",
  telegram: "تنبيهات ورسائل فورية لك أو لعملائك.",
  slack: "رسائل لقنوات فريقك — تحتاج ربطًا في محرك التنفيذ.",
  instagram: "نشر المحتوى لصنّاع المحتوى — عبر حساب الأعمال.",
  tiktok: "نشر الفيديوهات — تحتاج ربطًا في محرك التنفيذ.",
};

interface ConnRow {
  id: string;
  provider: Provider;
  label: string;
  status: string;
}

export default function ConnectionsPage() {
  const [connected, setConnected] = useState<Map<Provider, ConnRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Provider, string>>>({});
  const [openaiKey, setOpenaiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/connections");
    if (res.ok) {
      const data = await res.json();
      setConnected(
        new Map(
          (data.connections as ConnRow[]).map((c) => [c.provider, c])
        )
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(provider: Provider, revoke: boolean) {
    setBusy(provider);
    setErrors((e) => ({ ...e, [provider]: undefined }));
    try {
      const body: Record<string, unknown> = { provider };
      if (revoke) body.revoke = true;
      if (provider === "openai" && !revoke && openaiKey.trim())
        body.openai_api_key = openaiKey.trim();
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "تعذر الربط");
      setOpenaiKey("");
      setShowKeyInput(false);
      await load();
    } catch (e) {
      setErrors((err) => ({
        ...err,
        [provider]: e instanceof Error ? e.message : "خطأ",
      }));
    } finally {
      setBusy(null);
    }
  }

  const providers = Object.keys(PROVIDER_LABELS) as Provider[];

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">الاتصالات</h1>
        <p className="text-sm text-slate-400">
          اربط مرة واحدة — تستخدمه كل مساراتك.
        </p>
      </div>

      {loading ? (
        <div className="card p-8 text-sm text-slate-400 animate-pulse">
          نجلب حالة اتصالاتك...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {providers.map((p) => {
            const isConnected = connected.has(p);
            return (
              <div
                key={p}
                className={`card p-5 ${isConnected ? "border-emerald-400/30" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-[var(--line)] flex items-center justify-center shrink-0">
                    {providerIcon(p, 22)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm">{PROVIDER_LABELS[p]}</h3>
                      {isConnected ? (
                        <span className="chip text-[0.65rem] border-emerald-400/40 text-emerald-300 bg-emerald-400/10">
                          ✓ متصل
                        </span>
                      ) : (
                        <span className="chip text-[0.65rem] border-slate-500/40 text-slate-400 bg-slate-500/5">
                          غير متصل
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                      {PROVIDER_DESC[p]}
                    </p>

                    {p === "openai" && !isConnected && showKeyInput && (
                      <input
                        className="input mb-2 text-xs"
                        dir="ltr"
                        type="password"
                        placeholder="sk-... (اختياري — أو استخدم اعتماد المنصة)"
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                      />
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {isConnected ? (
                        <button
                          className="btn btn-ghost text-xs py-1.5 hover:!text-red-300"
                          disabled={busy === p}
                          onClick={() => toggle(p, true)}
                        >
                          {busy === p ? "..." : "إلغاء الاتصال"}
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-primary text-xs py-1.5"
                            disabled={busy === p}
                            onClick={() => toggle(p, false)}
                          >
                            {busy === p ? "نربط..." : `+ اربط ${PROVIDER_LABELS[p]}`}
                          </button>
                          {p === "openai" && !showKeyInput && (
                            <button
                              className="text-[0.7rem] text-cyan-300 hover:underline"
                              onClick={() => setShowKeyInput(true)}
                            >
                              عندي مفتاحي الخاص
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {errors[p] && (
                      <p className="mt-2 text-xs text-amber-300 leading-relaxed">
                        {errors[p]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
