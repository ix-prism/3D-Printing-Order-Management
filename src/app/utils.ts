import { ORDER_STATUSES } from "./constants";

export function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function basename(input: string) {
  const normalized = input.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || input;
}

export function toFileUrl(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  return encodeURI(`file:///${normalized}`);
}

export function orderFilePath(baseDir: string, dirName: string, savedAs: string) {
  const trimmed = baseDir.replace(/[\\/]+$/, "");
  return `${trimmed}\\${dirName}\\${savedAs}`;
}

export function previewKey(dirName: string, previewImage: string) {
  return `${dirName}::${previewImage}`;
}

export function previewDomKey(dirName: string, previewImage: string) {
  return encodeURIComponent(previewKey(dirName, previewImage));
}

export function previewFileName(savedAs: string) {
  return `${savedAs}.preview.png`;
}

export function normalizeQty(value: unknown, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.floor(num));
}

export function clampQuantities(printQty: number, printedQty: number) {
  const safePrint = Math.max(0, Math.floor(printQty));
  const safePrinted = Math.max(0, Math.floor(printedQty));
  return { printQty: safePrint, printedQty: Math.min(safePrinted, safePrint) };
}

export function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttribute(input: string) {
  return escapeHtml(input);
}

export function escapeSelector(input: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(input);
  }
  return input.replace(/["\\]/g, "\\$&");
}

export function dataTransferToPaths(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return [];
  const paths = new Set<string>();
  const files = Array.from(dataTransfer.files ?? []);
  for (const file of files) {
    const path = (file as unknown as { path?: string }).path;
    if (path) paths.add(path);
  }
  if (paths.size > 0) return Array.from(paths);
  const items = Array.from(dataTransfer.items ?? []);
  for (const item of items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    const path = (file as unknown as { path?: string } | null)?.path;
    if (path) paths.add(path);
  }
  return Array.from(paths);
}

export function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON";
}

export function isEditingElement(el: Element | null) {
  if (!el) return false;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function statusClassName(status: OrderStatus) {
  switch (status) {
    case "打印中":
      return "status-printing";
    case "后处理":
      return "status-post";
    case "已完成":
      return "status-done";
    case "已取消":
      return "status-canceled";
    default:
      return "status-new";
  }
}

export function renderStatusOptions(current: string) {
  return ORDER_STATUSES.map(
    (o) => `<option ${o === current ? "selected" : ""}>${escapeHtml(o)}</option>`
  ).join("");
}
