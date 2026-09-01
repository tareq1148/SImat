"use client";

// الشريط الجانبي (يمين) — أيقونات مطوية تتوسع بنقرة، بأسلوب Gemini
// يضم: محادثة جديدة، مساراتك، إنجازاتي، الإعدادات، وحسابك

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
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

export default function SideRail({ email }: { email: string | null }) {
  const pathname = usePathname();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [flows, setFlows] = useState<{ id: string; name: string; status: FlowStatus }[]>([]);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem("wt_rail") === "1");
    } catch {}
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
    {
      href: "/workflows",
      key: "tab.flows",
      icon: "flows",
      on: pathname.startsWith("/workflows") || pathname.startsWith("/flow"),
    },
    { href: "/progress", key: "nav.progress", icon: "progress", on: pathname.startsWith("/progress") },
  ];

  return (
    <>
      <aside
        className={`hidden md:flex flex-col shrink-0 gap-1.5 border-e border-[var(--line-soft)] bg-[var(--panel)] backdrop-blur sticky top-[74px] h-[calc(100vh-74px)] p-3 transition-[width] duration-200 ${
          open ? "w-[248px]" : "w-[68px]"
        }`}
      >
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
              <Link
                key={f.id}
                href={`/flow/${f.id}`}
                title={f.name}
                className="flex items-center gap-2 rounded-lg px-3 h-9 text-[0.78rem] text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--well)] transition-colors"
              >
                <span
                  className="status-dot shrink-0"
                  style={{ background: DOTS[f.status] ?? "var(--edge)" }}
                />
                <span className="truncate">{f.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* أسفل: الإعدادات والحساب */}
        <div className={`mt-auto flex flex-col gap-1.5 ${open ? "" : "items-center"}`}>
          <button onClick={() => setDrawer(true)} title={t("nav.settings")} className={item(false)}>
            <Icon name="gear" />
            {open && <span>{t("drawer.title")}</span>}
          </button>
          <div className={`flex items-center gap-3 h-11 ${open ? "px-3" : "justify-center"}`}>
            <span
              className="w-8 h-8 rounded-full text-white text-[0.8rem] font-bold flex items-center justify-center shrink-0"
              style={{ background: "var(--grad-accent)" }}
              title={email ?? ""}
            >
              {(email ?? "?").charAt(0).toUpperCase()}
            </span>
            {open && (
              <span dir="ltr" className="text-[0.68rem] text-[var(--text-soft)] truncate">
                {email}
              </span>
            )}
          </div>
        </div>
      </aside>

      {drawer && <SettingsDrawer onClose={() => setDrawer(false)} />}
    </>
  );
}
