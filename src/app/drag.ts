import { api } from "./api";
import { state } from "./state";
import { basename, toFileUrl } from "./utils";

export function startFileDrag(event: DragEvent, filePath: string) {
  if (state.dragMode === "download") {
    if (event.dataTransfer) {
      const fileUrl = toFileUrl(filePath);
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", filePath);
      event.dataTransfer.setData("text/uri-list", fileUrl);
      event.dataTransfer.setData(
        "DownloadURL",
        `application/octet-stream:${basename(filePath)}:${fileUrl}`
      );
    }
    return;
  }

  event.preventDefault();
  const ok = api.startDragFile(filePath);
  if (!ok) {
    console.warn("Start drag failed, fallback to download url.");
  }
}
