"use client";

// إدارة الثيم: فاتح افتراضيًا عبر html.light المصيَّر على العنصر،
// والداكن اختيارٌ يرفع الصنف — محفوظ في localStorage

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem("simat_theme", theme);
  } catch {}
  window.dispatchEvent(new CustomEvent("simat-theme", { detail: theme }));
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
