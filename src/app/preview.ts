import { api } from "./api";
import { previewCache, previewLoading } from "./state";
import { escapeAttribute, escapeSelector, previewDomKey, previewKey, previewFileName } from "./utils";

export async function ensurePreviewData(dirName: string, previewImage: string) {
  const key = previewKey(dirName, previewImage);
  if (previewCache.has(key) || previewLoading.has(key)) return;
  previewLoading.add(key);
  const dataUrl = await api.getPreviewDataUrl(dirName, previewImage);
  previewLoading.delete(key);
  if (dataUrl) {
    previewCache.set(key, dataUrl);
    applyPreviewToDom(dirName, previewImage, dataUrl);
  }
}

export function getPreviewData(dirName: string, previewImage?: string) {
  if (!previewImage) return "";
  const key = previewKey(dirName, previewImage);
  const cached = previewCache.get(key);
  if (!cached) {
    void ensurePreviewData(dirName, previewImage);
  }
  return cached ?? "";
}

export function applyPreviewToDom(dirName: string, previewImage: string, dataUrl: string) {
  const key = previewDomKey(dirName, previewImage);
  let node = document.querySelector<HTMLElement>(`[data-preview-key="${key}"]`);
  if (!node) {
    const savedAs = previewImage.endsWith(".preview.png")
      ? previewImage.slice(0, -".preview.png".length)
      : "";
    if (savedAs) {
      const row = document.querySelector<HTMLElement>(
        `[data-id="${escapeSelector(dirName)}"] [data-file="${escapeSelector(savedAs)}"]`
      );
      node = row?.querySelector<HTMLElement>(".preview-box") ?? null;
      if (node) {
        node.setAttribute("data-preview-key", key);
      }
    }
  }
  if (!node) return;
  node.innerHTML = `<img class="preview-img" src="${escapeAttribute(dataUrl)}" />`;
}

export function cachePreview(dirName: string, savedAs: string, dataUrl: string) {
  previewCache.set(previewKey(dirName, previewFileName(savedAs)), dataUrl);
}

export function dropPreviewCache(dirName: string, savedAs: string) {
  previewCache.delete(previewKey(dirName, previewFileName(savedAs)));
}
