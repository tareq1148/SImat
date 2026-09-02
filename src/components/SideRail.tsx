"use client";

// الشريط الجانبي (يمين) — أيقونات مطوية تتوسع بنقرة، بأسلوب Gemini
// يضم: محادثة جديدة، مساراتك، إنجازاتي، الإعدادات، وحسابك

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import Logo from "./Logo";
import { useLang } from "@/lib/i18n";
import SettingsDrawer from "./SettingsDrawer";
import type { FlowStatus } from "@/lib/types";

const DOTS: Partial<Record<FlowStatus, string>> = {
  Ready: "var(--ok)",
  Active: "var(--ok)",
  NeedsRepair: "var(--bad)",
  NotSuitable: "var(--bad)",
  NeedsInformation: "var(--warn)",
  NeedsConnections: "var(--warn)",
};

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    panel: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M15 4v16" />
      </>
    ),
    edit: <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 6.5l4 4" />,
    flows: (
      <>
        <circle cx="5" cy="6" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
        <circle cx="12" cy="18" r="2.2" />
        <path d="M6.5 7.8 10.6 16M17.5 7.8 13.4 16" />
      </>
    ),
    progress: <path d="M4 20v-6M10 20V6M16 20v-9M21 20H3" />,
    dots: (
      <>
        <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {paths[name]}
    </svg>
  );
}

interface FlowLite {
  id: string;
  name: string;
  status: FlowStatus;
}

// صف مسار + قائمة النقاط الثلاث: إعادة تسمية وحذف.
// القائمة بموضع fixed لأن حاويتها تُمرَّر (overflow-y) فتقصّ أي قائمة مطلقة داخلها.
function FlowRow({
  flow,
  onRenamed,
  onDeleted,
}: {
  flow: FlowLite;
  onRenamed: (id: string, name: string) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(flow.name);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setConfirming(false);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-flow-menu]")) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, closeMenu]);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenu({ top: r.bottom + 6, right: window.innerWidth - r.right });
  }

  async function rename() {
    const name = draft.trim();
    if (!name || name === flow.name) {
      setRenaming(false);
      setDraft(flow.name);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/flows/${flow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "تعذّرت إعادة التسمية");
      onRenamed(flow.id, data.name ?? name);
      router.refresh();
    } catch {
      setDraft(flow.name);
    } finally {
      setRenaming(false);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/flows/${flow.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      closeMenu();
      onDeleted(flow.id);
      // إن كنّا واقفين على المسار المحذوف، لا نترك المستخدم في صفحة ميتة
      if (pathname.startsWith(`/flow/${flow.id}`)) router.push("/workflows");
      else router.refresh();
    } catch {
      setBusy(false);
    }
  }

  if (renaming) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 h-9">
        <span
          className="status-dot shrink-0"
          style={{ background: DOTS[flow.status] ?? "var(--edge)" }}
        />
        <input
          autoFocus
          disabled={busy}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => {
            if (e.key === "Enter") rename();
            if (e.key === "Escape") {
              setDraft(flow.name);
              setRenaming(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent border-b border-[var(--accent-bg)] outline-none text-[0.78rem] text-[var(--text)]"
        />
      </div>
    );
  }

  return (
    <div className="group relative flex items-center rounded-lg hover:bg-[var(--well)] transition-colors">
      <Link
        href={`/flow/${flow.id}`}
        title={flow.name}
        className="flex min-w-0 flex-1 items-center gap-2 ps-3 h-9 text-[0.78rem] text-[var(--text-soft)] group-hover:text-[var(--text)] transition-colors"
      >
        <span
          className="status-dot shrink-0"
          style={{ background: DOTS[flow.status] ?? "var(--edge)" }}
        />
        <span className="truncate">{flow.name}</span>
      </Link>

      <button
        ref={btnRef}
        data-flow-menu
        aria-label={t("rail.menu")}
        aria-expanded={!!menu}
        title={t("rail.menu")}
        onClick={(e) => {
          e.preventDefault();
          if (menu) closeMenu();
          else openMenu();
        }}
        className={`shrink-0 me-1 w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-opacity ${
          menu ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
      >
        <Icon name="dots" size={15} />
      </button>

      {mounted && menu &&
        createPortal(
          <div
            data-flow-menu
          role="menu"
          style={{ position: "fixed", top: menu.top, right: menu.right }}
          className="z-50 w-44 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] p-1 shadow-lg"
        >
          {confirming ? (
            <>
              <p className="px-3 py-2 text-[0.72rem] leading-snug text-[var(--text-soft)]">
                {t("rail.confirmDelete")}
              </p>
              <button
                role="menuitem"
                disabled={busy}
                onClick={remove}
                className="w-full text-start rounded-lg px-3 h-8 text-[0.76rem] font-semibold text-[var(--bad)] hover:bg-[var(--well)] disabled:opacity-50"
              >
                {busy ? "…" : t("rail.deleteYes")}
              </button>
              <button
                role="menuitem"
                onClick={() => setConfirming(false)}
                className="w-full text-start rounded-lg px-3 h-8 text-[0.76rem] text-[var(--text-soft)] hover:bg-[var(--well)]"
              >
                {t("rail.cancel")}
              </button>
            </>
          ) : (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setDraft(flow.name);
                  setRenaming(true);
                }}
                className="w-full text-start rounded-lg px-3 h-8 text-[0.76rem] text-[var(--text)] hover:bg-[var(--well)]"
              >
                {t("rail.rename")}
              </button>
              <button
                role="menuitem"
                onClick={() => setConfirming(true)}
                className="w-full text-start rounded-lg px-3 h-8 text-[0.76rem] text-[var(--bad)] hover:bg-[var(--well)]"
              >
                {t("rail.delete")}
              </button>
            </>
          )}
          </div>,
          document.body
        )}
    </div>
  );
}

export default function SideRail() {
  const pathname = usePathname();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [flows, setFlows] = useState<FlowLite[]>([]);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem("wt_rail") === "1");
    } catch {}
  }, []);

  // رسوّ مساحة العمل تُبلّغ عنه شاشة المحادثة: عندها يُطوى الشريط ويعلو
  // فوق المحادثة عند فتحه بدل أن يدفعها. التفضيل المحفوظ لا يُمَس.
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    const onDock = (e: Event) => {
      const on = !!(e as CustomEvent<{ docked: boolean }>).detail?.docked;
      setDocked(on);
      if (on) setOpen(false);
      else
        try {
          setOpen(localStorage.getItem("wt_rail") === "1");
        } catch {}
    };
    window.addEventListener("wt:workspace", onDock);
    return () => window.removeEventListener("wt:workspace", onDock);
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      try {
        localStorage.setItem("wt_rail", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }, []);

  useEffect(() => {
    supabaseBrowser()
      .from("flows")
      .select("id, name, status")
      .order("updated_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setFlows((data as never) ?? []));
  }, []);

  const item = (active: boolean) =>
    `flex items-center gap-3 rounded-xl h-11 px-3 text-[0.85rem] whitespace-nowrap overflow-hidden transition-colors ${
      active
        ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold"
        : "text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--well)]"
    } ${open ? "" : "justify-center px-0 w-11"}`;

  const NAV = [
    { href: "/chat", key: "rail.new", icon: "edit", on: pathname.startsWith("/chat") },
    { href: "/progress", key: "nav.progress", icon: "progress", on: pathname.startsWith("/progress") },
  ];

  return (
    <>
      {/* حاجز يحجز عرض الشريط المطويّ وحده — فيبقى المحتوى ثابتًا مهما اتّسع الشريط */}
      {docked && <div className="hidden md:block shrink-0 w-[68px]" aria-hidden />}
      <aside
        className={`hidden md:flex flex-col shrink-0 gap-1.5 border-e border-[var(--line-soft)] backdrop-blur h-screen p-3 transition-[width] duration-200 ${
          docked
            ? "fixed top-0 start-0 z-40 bg-[var(--panel-solid)]"
            : "sticky top-0 bg-[var(--panel)]"
        } ${open ? "w-[248px]" : "w-[68px]"} ${docked && open ? "shadow-2xl" : ""}`}
      >
        {/* الشعار في رأس الشريط بلا إطار — علامةٌ وحدها كما في الشرائط المشابهة */}
        <Link
          href="/"
          title={t("brand")}
          className={`flex items-center gap-2.5 h-11 mb-2 shrink-0 ${
            open ? "px-2" : "justify-center"
          }`}
        >
          <Logo size={28} id="wLogoRail" />
          {open && (
            <span className="text-[1.05rem] font-bold whitespace-nowrap">
              {t("brand")}
            </span>
          )}
        </Link>

        <button
          onClick={toggle}
          title={open ? t("rail.collapse") : t("rail.expand")}
          className={`${item(false)} mb-1`}
        >
          <Icon name="panel" />
          {open && <span>{t("rail.collapse")}</span>}
        </button>

        {NAV.map((n) => (
          <Link key={n.href} href={n.href} title={t(n.key)} className={item(n.on)}>
            <Icon name={n.icon} />
            {open && <span>{t(n.key)}</span>}
          </Link>
        ))}

        {/* مساراتك — تظهر عند التوسعة */}
        {open && flows.length > 0 && (
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <p className="text-[0.7rem] font-semibold text-[var(--text-soft)] px-3 mb-1.5">
              {t("wf.yours")}
            </p>
            {flows.map((f) => (
              <FlowRow
                key={f.id}
                flow={f}
                onRenamed={(id, name) =>
                  setFlows((list) => list.map((x) => (x.id === id ? { ...x, name } : x)))
                }
                onDeleted={(id) => setFlows((list) => list.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}

        {/* أسفل: الإعدادات والحساب */}
        <div className={`mt-auto flex flex-col gap-1.5 ${open ? "" : "items-center"}`}>
          <button onClick={() => setDrawer(true)} title={t("nav.settings")} className={item(false)}>
            <Icon name="gear" />
            {open && <span>{t("drawer.title")}</span>}
          </button>
          {/* موضع الحساب: تشغله قائمة AccountMenu العائمة (تحمل السمة والخروج).
              نترك فراغه فقط كي لا يتراكب أفاتاران في المكان نفسه. */}
          <div className="h-11" aria-hidden />
        </div>
      </aside>

      {drawer && <SettingsDrawer onClose={() => setDrawer(false)} />}
    </>
  );
}
