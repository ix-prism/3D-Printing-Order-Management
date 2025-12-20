import { api } from "./api";
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
      note: ""
    });
  }
}

export async function addPendingFilesFromFileObjects(files: File[]) {
  const existing = new Set(state.pendingFiles.map((f) => f.id));
  for (const file of files) {
    const id = `file:${file.name}:${file.size}:${file.lastModified}`;
    if (existing.has(id)) continue;
    const data = await file.arrayBuffer();
    state.pendingFiles.push({
      id,
      name: file.name,
      note: "",
      data,
      size: file.size,
      lastModified: file.lastModified
    });
  }
}

export async function applyPendingPreviews(order: Order, pending: PendingFile[]) {
  const buckets = new Map<string, OrderFile[]>();
  for (const file of order.files || []) {
    if (!buckets.has(file.name)) buckets.set(file.name, []);
    buckets.get(file.name)!.push(file);
  }

  for (const p of pending) {
    if (!p.previewDataUrl) continue;
    const bucket = buckets.get(p.name);
    if (!bucket || bucket.length === 0) continue;
    const entry = bucket.shift();
    if (!entry) continue;
    await api.savePreviewImage(order.dirName, entry.savedAs, p.previewDataUrl);
    previewCache.set(previewKey(order.dirName, previewFileName(entry.savedAs)), p.previewDataUrl);
  }
}
