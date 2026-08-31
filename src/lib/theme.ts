"use client";

// إدارة الثيم: داكن افتراضيًا، والفاتح عبر html.light — محفوظ في localStorage

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
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
