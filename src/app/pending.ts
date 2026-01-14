import { api } from "./api";
import {
  generatePreviewDataUrl,
  getExtension,
  isPreviewableFileName,
  isStepFileName,
  toArrayBuffer
} from "./preview-generator";
import { PendingFile, previewCache, state } from "./state";
import { basename, previewFileName, previewKey } from "./utils";

export function addPendingFiles(paths: string[]) {
  const existing = new Set(state.pendingFiles.map((f) => f.id));
  for (const p of paths) {
    const id = `path:${p}`;
    if (existing.has(id)) continue;
    state.pendingFiles.push({
      id,
      path: p,
      name: basename(p),
      note: "",
      printQty: 1
    });
  }
}

export async function addPendingFilesFromFileObjects(files: File[]) {
  const existing = new Set(state.pendingFiles.map((f) => f.id));
  for (const file of files) {
    const id = `file:${file.name}:${file.size}:${file.lastModified}`;
    if (existing.has(id)) continue;
    const data = await file.arrayBuffer();
    const pending: PendingFile = {
      id,
      name: file.name,
      note: "",
      printQty: 1,
      data,
      size: file.size,
      lastModified: file.lastModified
    };
    if (isPreviewableFileName(file.name)) {
      const preview = await generatePreviewDataUrl(file.name, data);
      if (preview) pending.previewDataUrl = preview;
    }
    state.pendingFiles.push(pending);
  }
}

export async function fillPendingPreviewsFromPaths(paths: string[], onUpdate: () => void) {
  for (const p of paths) {
    const existing = state.pendingFiles.find((f) => f.path === p);
    if (existing?.previewDataUrl) continue;
    const ext = getExtension(p);
    if (isStepFileName(p)) {
      const thumb = await api.getFileThumbnail(p, 256);
      if (!thumb) continue;
      const item = existing ?? state.pendingFiles.find((f) => f.path === p);
      if (!item) continue;
      item.previewDataUrl = thumb;
      onUpdate();
      continue;
    }
    if (!isPreviewableFileName(p)) continue;
    const data = await api.readFileBuffer(p);
    const arrayBuffer = toArrayBuffer(data ?? null);
    if (!arrayBuffer) continue;
    const preview = await generatePreviewDataUrl(p, arrayBuffer);
    if (!preview) continue;
    const item = existing ?? state.pendingFiles.find((f) => f.path === p);
    if (!item) continue;
    item.previewDataUrl = preview;
    onUpdate();
  }
}

export async function applyPendingPreviews(
  order: Order,
  pending: PendingFile[],
  fallbackFiles: OrderFile[] = []
) {
  const buckets = new Map<string, OrderFile[]>();
  for (const file of order.files || []) {
    if (!buckets.has(file.name)) buckets.set(file.name, []);
    buckets.get(file.name)!.push(file);
  }

  let latest = order;
  let fallbackIndex = 0;
  for (const p of pending) {
    const fallback = fallbackFiles[fallbackIndex];
    fallbackIndex += 1;
    if (!p.previewDataUrl) continue;
    const bucket = buckets.get(p.name);
    const entry = bucket?.shift() ?? fallback;
    if (!entry) continue;
    const updated = await api.savePreviewImage(order.dirName, entry.savedAs, p.previewDataUrl);
    latest = updated;
    previewCache.set(previewKey(order.dirName, previewFileName(entry.savedAs)), p.previewDataUrl);
  }
  return latest;
}
