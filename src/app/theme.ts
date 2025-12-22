export const THEME_OPTIONS = [
  { id: "classic", label: "\u7cfb\u7edf\u9ed8\u8ba4" },
  { id: "glass-light", label: "\u8d28\u611f\uff08\u6d45\u8272\uff09" },
  { id: "glass-dark", label: "\u8d28\u611f\uff08\u6df1\u8272\uff09" }
] as const;

export type ThemeId = (typeof THEME_OPTIONS)[number]["id"];

export const DEFAULT_THEME: ThemeId = "classic";

export function normalizeTheme(value: unknown): ThemeId {
  const input = String(value ?? "").trim();
  const match = THEME_OPTIONS.find((option) => option.id === input);
  return match?.id ?? DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}
