import { api } from "./api";
import { startFileDrag } from "./drag";
import { applyOrderUpdate, refreshOrders } from "./orders";
import {
  addPendingFiles,
  addPendingFilesFromFileObjects,
  applyPendingPreviews,
  fillPendingPreviewsFromPaths
} from "./pending";
import { generatePreviewDataUrl, isPreviewableFileName, isStepFileName } from "./preview-generator";
import { applyPreviewToDom, cachePreview, dropPreviewCache } from "./preview";
import { PendingFile, resetDraftOrder, state } from "./state";
import {
  clampQuantities,
  dataTransferToFiles,
  dataTransferToPaths,
  isEditingElement,
  isInteractiveTarget,
  normalizeQty,
  orderFilePath,
  previewFileName
} from "./utils";

export function bindHandlers(root: HTMLElement, render: () => void) {
  const hasBaseDir = Boolean(state.settings.baseDir);

  root.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeTab = (tab.dataset.tab as "add" | "manage" | "settings") ?? "add";
      render();
    });
  });

  const createForm = root.querySelector<HTMLFormElement>("#createForm");
  createForm?.addEventListener("input", () => {
    if (!createForm) return;
    state.draftOrder = {
      customerName:
        (createForm.querySelector<HTMLInputElement>('input[name="customerName"]')?.value ?? "").trim(),
      title: (createForm.querySelector<HTMLInputElement>('input[name="title"]')?.value ?? "").trim(),
      material:
        (createForm.querySelector<HTMLInputElement>('input[name="material"]')?.value ?? "").trim(),
      quantity: Number(createForm.querySelector<HTMLInputElement>('input[name="quantity"]')?.value ?? 1),
      dueDate: createForm.querySelector<HTMLInputElement>('input[name="dueDate"]')?.value ?? "",
      status:
        (createForm.querySelector<HTMLSelectElement>('select[name="status"]')?.value as OrderStatus) ??
        "\u65b0\u5efa",
      note: createForm.querySelector<HTMLTextAreaElement>('textarea[name="note"]')?.value ?? "",
      folderNote: createForm.querySelector<HTMLTextAreaElement>('textarea[name="folderNote"]')?.value ?? ""
    };
  });

  createForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!hasBaseDir) return;

    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const quantity = Number(data.get("quantity"));
    if (!Number.isFinite(quantity) || quantity < 1) return;

    const payload = {
      customerName: String(data.get("customerName") ?? "").trim(),
      title: String(data.get("title") ?? "").trim(),
      material: String(data.get("material") ?? "").trim(),
      quantity,
      dueDate: String(data.get("dueDate") ?? "").trim(),
      status: (String(data.get("status") ?? "\u65b0\u5efa") as OrderStatus) ?? "\u65b0\u5efa",
      note: String(data.get("note") ?? "").trim(),
      folderNote: String(data.get("folderNote") ?? "").trim()
    };

    const order = await api.createOrder(payload);

    if (state.pendingFiles.length > 0) {
      const filesPayload = state.pendingFiles.map((f) => ({
        path: f.path,
        name: f.name,
        data: f.data,
        note: f.note
      }));
      const updated = await api.addFiles(order.dirName, filesPayload);
      await applyPendingPreviews(updated, state.pendingFiles);
    }

    state.pendingFiles = [];
    state.selectedTarget = null;
    resetDraftOrder();
    await refreshOrders();
    form.reset();
    (form.querySelector<HTMLInputElement>('input[name="quantity"]')!).value = "1";
    state.activeTab = "manage";
    render();
  });

  root.querySelector<HTMLButtonElement>("#resetBtn")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#createForm");
    form?.reset();
    const q = form?.querySelector<HTMLInputElement>('input[name="quantity"]');
    if (q) q.value = "1";
    state.pendingFiles = [];
    state.selectedTarget = null;
    resetDraftOrder();
    render();
  });

  root.querySelector<HTMLButtonElement>("#chooseDirBtn")?.addEventListener("click", async () => {
    const nextSettings = await api.chooseBaseDir();
    if (nextSettings?.baseDir) {
      state.settings = nextSettings;
      await refreshOrders();
      render();
    }
  });

  root.querySelector<HTMLSelectElement>("#dragModeSelect")?.addEventListener("change", (e) => {
    const nextMode = (e.currentTarget as HTMLSelectElement).value;
    state.dragMode = nextMode === "download" ? "download" : "native";
    localStorage.setItem("dragMode", state.dragMode);
    render();
  });

  root.querySelectorAll<HTMLElement>('[data-drop="pending"]').forEach((zone) => {
    if (!hasBaseDir) return;
    zone.addEventListener("click", async () => {
      const paths = await api.selectFiles();
      addPendingFiles(paths);
      render();
      if (paths.length > 0) {
        fillPendingPreviewsFromPaths(paths, render);
      }
    });
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const dt = e.dataTransfer;
      const paths = dataTransferToPaths(dt);
      if (paths.length > 0) {
        addPendingFiles(paths);
        render();
        fillPendingPreviewsFromPaths(paths, render);
        return;
      }
      const files = dataTransferToFiles(dt);
      if (files.length === 0) {
                alert("\u672a\u80fd\u8bfb\u53d6\u6587\u4ef6\u8def\u5f84\uff0c\u8bf7\u4ece\u8d44\u6e90\u7ba1\u7406\u5668\u62d6\u5165\uff0c\u6216\u70b9\u51fb\u9009\u62e9\u6587\u4ef6\u3002");
        return;
      }
      addPendingFilesFromFileObjects(files).then(() => render());
    });
  });

  root.querySelectorAll<HTMLInputElement>('[data-pending-index] .file-note').forEach((input) => {
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("change", () => {
      const row = input.closest<HTMLElement>("[data-pending-index]");
      const index = Number(row?.dataset.pendingIndex ?? -1);
      if (index < 0) return;
      state.pendingFiles[index].note = input.value.trim();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="remove-pending"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = btn.closest<HTMLElement>("[data-pending-index]");
      const index = Number(row?.dataset.pendingIndex ?? -1);
      if (index < 0) return;
      state.pendingFiles.splice(index, 1);
      state.selectedTarget = null;
      render();
    });
  });

  root.querySelectorAll<HTMLElement>('[data-role="pending-preview"]').forEach((box) => {
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = Number((box as HTMLElement).dataset.index ?? -1);
      if (index < 0) return;
      state.selectedTarget = { kind: "pending-preview", index };
      render();
    });
  });

  root.querySelectorAll<HTMLElement>(".file-row[data-pending-index]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (isInteractiveTarget(e.target)) return;
      const index = Number((row as HTMLElement).dataset.pendingIndex ?? -1);
      if (index < 0) return;
      state.selectedTarget = { kind: "pending-file", index };
      render();
    });
  });

  root.querySelectorAll<HTMLElement>('[data-drop="order"]').forEach((zone) => {
    if (!hasBaseDir) return;
    const item = zone.closest<HTMLElement>("[data-id]");
    const id = item?.getAttribute("data-id");
    if (!id) return;

    const handlePaths = async (paths: string[]) => {
      if (!paths || paths.length === 0) return;
      const files = paths.map((p) => ({ path: p }));
      const updated = await api.addFiles(id, files);
      applyOrderUpdate(updated);
      render();
    };
    const handleFileObjects = async (files: File[]) => {
      if (!files || files.length === 0) return;
      const previews: PendingFile[] = [];
      const payloads = await Promise.all(
        files.map(async (file) => {
          const data = await file.arrayBuffer();
          if (isStepFileName(file.name)) {
            // No path available for system thumbnails in this path.
          } else if (isPreviewableFileName(file.name)) {
            const preview = await generatePreviewDataUrl(file.name, data);
            if (preview) {
              previews.push({
                id: `preview:${file.name}:${file.size}:${file.lastModified}`,
                name: file.name,
                note: "",
                previewDataUrl: preview
              });
            }
          }
          return {
            name: file.name,
            data
          };
        })
      );
      const updated = await api.addFiles(id, payloads);
      const updatedWithPreviews =
        previews.length > 0 ? await applyPendingPreviews(updated, previews) : updated;
      applyOrderUpdate(updatedWithPreviews);
      render();
    };

    zone.addEventListener("click", async () => {
      const paths = await api.selectFiles();
      await handlePaths(paths);
    });
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const dt = e.dataTransfer;
      const paths = dataTransferToPaths(dt);
      if (paths.length > 0) {
        await handlePaths(paths);
        return;
      }
      const files = dataTransferToFiles(dt);
      if (files.length === 0) {
                alert("\u672a\u80fd\u8bfb\u53d6\u6587\u4ef6\u8def\u5f84\uff0c\u8bf7\u4ece\u8d44\u6e90\u7ba1\u7406\u5668\u62d6\u5165\uff0c\u6216\u70b9\u51fb\u9009\u62e9\u6587\u4ef6\u3002");
        return;
      }
      await handleFileObjects(files);
    });
  });

  root.querySelectorAll<HTMLTextAreaElement>(".folder-note").forEach((input) => {
    input.addEventListener("change", async () => {
      const item = input.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      if (!id) return;
      const updated = await api.updateOrderNote(id, input.value.trim());
      applyOrderUpdate(updated);
    });
  });

  root.querySelectorAll<HTMLTextAreaElement>(".shipping-info").forEach((input) => {
    input.addEventListener("change", async () => {
      const item = input.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      if (!id) return;
      const updated = await api.updateOrder(id, { shippingInfo: input.value.trim() });
      applyOrderUpdate(updated);
    });
  });

  root.querySelectorAll<HTMLSelectElement>('[data-action="status"]').forEach((select) => {
    select.addEventListener("change", async () => {
      const item = select.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      if (!id) return;
      const updated = await api.updateOrder(id, { status: select.value });
      applyOrderUpdate(updated);
      render();
    });
  });

  root.querySelectorAll<HTMLSelectElement>('[data-action="file-action"]').forEach((select) => {
    select.addEventListener("change", async () => {
      const row = select.closest<HTMLElement>("[data-file]");
      const item = select.closest<HTMLElement>("[data-id]");
      const dirName = item?.getAttribute("data-id");
      const savedAs = row?.getAttribute("data-file");
      if (!dirName || !savedAs) return;
      if (select.value === "open") {
        await api.showFileInFolder(dirName, savedAs);
        select.value = "";
        return;
      }
      if (select.value === "replace") {
        const paths = await api.selectFiles();
        if (!paths || paths.length === 0) {
          select.value = "";
          return;
        }
        const updated = await api.replaceFile(dirName, savedAs, paths[0]);
        applyOrderUpdate(updated);
      }
      if (select.value === "delete") {
        if (!confirm("\u786e\u5b9a\u8981\u5220\u9664\u5417\uff1f")) {
          select.value = "";
          return;
        }
        const updated = await api.deleteFile(dirName, savedAs);
        applyOrderUpdate(updated);
      }
      select.value = "";
      state.selectedTarget = null;
      render();
    });
  });

  root.querySelectorAll<HTMLInputElement>('[data-file] .file-note').forEach((input) => {
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("change", async () => {
      const row = input.closest<HTMLElement>("[data-file]");
      const item = input.closest<HTMLElement>("[data-id]");
      const dirName = item?.getAttribute("data-id");
      const savedAs = row?.getAttribute("data-file");
      if (!dirName || !savedAs) return;
      const updated = await api.updateFileNote(dirName, savedAs, input.value.trim());
      applyOrderUpdate(updated);
    });
  });

  root.querySelectorAll<HTMLButtonElement>(".qty-button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest<HTMLElement>("[data-file]");
      if (!row) return;
      const item = row.closest<HTMLElement>("[data-id]");
      const dirName = item?.getAttribute("data-id");
      const savedAs = row.getAttribute("data-file");
      if (!dirName || !savedAs) return;
      const field = btn.getAttribute("data-qty-field") as "print" | "printed";
      const action = btn.getAttribute("data-qty-action");
      if (!field || !action) return;
      const printInput = row.querySelector<HTMLInputElement>('.qty-input[data-qty-field="print"]');
      const printedInput = row.querySelector<HTMLInputElement>(
        '.qty-input[data-qty-field="printed"]'
      );
      const printQty = normalizeQty(printInput?.value ?? 0, 0);
      const printedQty = normalizeQty(printedInput?.value ?? 0, 0);
      const delta = action === "inc" ? 1 : -1;
      const nextPrint = field === "print" ? printQty + delta : printQty;
      const nextPrinted = field === "printed" ? printedQty + delta : printedQty;
      const next = clampQuantities(nextPrint, nextPrinted);
      if (printInput) printInput.value = String(next.printQty);
      if (printedInput) printedInput.value = String(next.printedQty);
      const updated = await api.updateFileQuantities(dirName, savedAs, next.printQty, next.printedQty);
      applyOrderUpdate(updated);
    });
  });

  root.querySelectorAll<HTMLInputElement>(".qty-input").forEach((input) => {
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("change", async () => {
      const row = input.closest<HTMLElement>("[data-file]");
      const item = row?.closest<HTMLElement>("[data-id]");
      const dirName = item?.getAttribute("data-id");
      const savedAs = row?.getAttribute("data-file");
      if (!dirName || !savedAs || !row) return;
      const printInput = row.querySelector<HTMLInputElement>('.qty-input[data-qty-field="print"]');
      const printedInput = row.querySelector<HTMLInputElement>(
        '.qty-input[data-qty-field="printed"]'
      );
      const next = clampQuantities(
        normalizeQty(printInput?.value ?? 0, 0),
        normalizeQty(printedInput?.value ?? 0, 0)
      );
      if (printInput) printInput.value = String(next.printQty);
      if (printedInput) printedInput.value = String(next.printedQty);
      const updated = await api.updateFileQuantities(dirName, savedAs, next.printQty, next.printedQty);
      applyOrderUpdate(updated);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="toggle-edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      if (!id) return;
      state.editingOrderId = state.editingOrderId === id ? null : id;
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="toggle-collapse"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      if (!id) return;
      if (state.collapsedOrders.has(id)) {
        state.collapsedOrders.delete(id);
      } else {
        state.collapsedOrders.add(id);
        if (state.selectedTarget?.kind === "order-file" && state.selectedTarget.dirName === id) {
          state.selectedTarget = null;
        }
        if (state.selectedTarget?.kind === "order-preview" && state.selectedTarget.dirName === id) {
          state.selectedTarget = null;
        }
      }
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="save-order-edit"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      if (!id) return;
      const customerInput = item?.querySelector<HTMLInputElement>('[data-edit-field="customerName"]');
      const materialInput = item?.querySelector<HTMLInputElement>('[data-edit-field="material"]');
      const quantityInput = item?.querySelector<HTMLInputElement>('[data-edit-field="quantity"]');
      const quantity = Math.max(1, normalizeQty(quantityInput?.value ?? 1, 1));
      const updated = await api.updateOrder(id, {
        customerName: customerInput?.value.trim() ?? "",
        material: materialInput?.value.trim() ?? "",
        quantity
      });
      applyOrderUpdate(updated);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="copy-order"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      if (!id) return;
      await api.copyOrder(id);
      state.editingOrderId = null;
      await refreshOrders();
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="delete-order"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      if (!id) return;
      if (!confirm("\u786e\u5b9a\u8981\u5220\u9664\u5417\uff1f")) return;
      await api.deleteOrder(id);
      state.editingOrderId = null;
      await refreshOrders();
      render();
    });
  });

  root.querySelectorAll<HTMLElement>('[data-role="order-preview"]').forEach((box) => {
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = box.closest<HTMLElement>("[data-file]");
      const item = box.closest<HTMLElement>("[data-id]");
      const dirName = item?.getAttribute("data-id");
      const savedAs = row?.getAttribute("data-file");
      if (!dirName || !savedAs) return;
      state.selectedTarget = { kind: "order-preview", dirName, savedAs };
      render();
    });
  });

  root.querySelectorAll<HTMLElement>(".file-row[data-file]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (isInteractiveTarget(e.target)) return;
      const item = row.closest<HTMLElement>("[data-id]");
      const dirName = item?.getAttribute("data-id");
      const savedAs = row.getAttribute("data-file");
      if (!dirName || !savedAs) return;
      state.selectedTarget = { kind: "order-file", dirName, savedAs };
      render();
    });
  });

  root.querySelectorAll<HTMLElement>('[data-drag="file"]').forEach((node) => {
    node.addEventListener("dragstart", (e) => {
      if (!state.settings.baseDir) return;
      const row = node.closest<HTMLElement>("[data-file]");
      const item = node.closest<HTMLElement>("[data-id]");
      const dirName = item?.getAttribute("data-id");
      const savedAs = row?.getAttribute("data-file");
      if (!dirName || !savedAs) return;
      const filePath = orderFilePath(state.settings.baseDir, dirName, savedAs);
      startFileDrag(e, filePath);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="save-folder-note"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest<HTMLElement>("[data-id]");
      const id = item?.getAttribute("data-id");
      const noteInput = item?.querySelector<HTMLTextAreaElement>(".folder-note");
      if (!id || !noteInput) return;
      const updated = await api.updateOrderNote(id, noteInput.value.trim());
      applyOrderUpdate(updated);
    });
  });
}

export function attachGlobalHandlers(render: () => void) {
  if (state.handlersAttached) return;
  state.handlersAttached = true;

  window.addEventListener("keydown", async (e) => {
    if (e.key !== "Delete") return;
    if (!state.selectedTarget) return;
    if (isEditingElement(document.activeElement)) return;
    e.preventDefault();

    if (state.selectedTarget.kind === "pending-preview") {
      const file = state.pendingFiles[state.selectedTarget.index];
      if (!file) return;
      file.previewDataUrl = undefined;
      render();
      return;
    }
    if (state.selectedTarget.kind === "pending-file") {
      if (!state.pendingFiles[state.selectedTarget.index]) return;
      state.pendingFiles.splice(state.selectedTarget.index, 1);
      state.selectedTarget = null;
      render();
      return;
    }
    if (state.selectedTarget.kind === "order-preview") {
      const { dirName, savedAs } = state.selectedTarget;
      const updated = await api.deletePreviewImage(dirName, savedAs);
      applyOrderUpdate(updated);
      dropPreviewCache(dirName, savedAs);
      render();
      return;
    }
    if (state.selectedTarget.kind === "order-file") {
      if (!confirm("\u786e\u5b9a\u8981\u5220\u9664\u5417\uff1f")) return;
      const { dirName, savedAs } = state.selectedTarget;
      const updated = await api.deleteFile(dirName, savedAs);
      applyOrderUpdate(updated);
      state.selectedTarget = null;
      render();
    }
  });

  window.addEventListener("paste", async (e) => {
    if (!state.selectedTarget) return;
    if (isEditingElement(document.activeElement)) return;
    if (state.selectedTarget.kind !== "pending-preview" && state.selectedTarget.kind !== "order-preview")
      return;
    e.preventDefault();
    const dataUrl = await api.getClipboardImage();
    if (!dataUrl) {
              alert("\u672a\u80fd\u8bfb\u53d6\u6587\u4ef6\u8def\u5f84\uff0c\u8bf7\u4ece\u8d44\u6e90\u7ba1\u7406\u5668\u62d6\u5165\uff0c\u6216\u70b9\u51fb\u9009\u62e9\u6587\u4ef6\u3002");
      return;
    }
    if (state.selectedTarget.kind === "pending-preview") {
      const file = state.pendingFiles[state.selectedTarget.index];
      if (!file) return;
      file.previewDataUrl = dataUrl;
      render();
      return;
    }
    if (state.selectedTarget.kind === "order-preview") {
      const { dirName, savedAs } = state.selectedTarget;
      const updated = await api.savePreviewImage(dirName, savedAs, dataUrl);
      applyOrderUpdate(updated);
      cachePreview(dirName, savedAs, dataUrl);
      applyPreviewToDom(dirName, previewFileName(savedAs), dataUrl);
    }
  });
}
