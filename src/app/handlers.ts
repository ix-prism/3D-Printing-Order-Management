import { api } from "./api";
import { startFileDrag } from "./drag";
import { applyOrderUpdate, refreshOrders } from "./orders";
import {
  addPendingFiles,
  addPendingFilesFromFileObjects,
  applyPendingPreviews,
  fillPendingPreviewsFromPaths
} from "./pending";
import {
  generatePreviewDataUrl,
  getExtension,
  isPreviewableFileName,
  isStepFileName
} from "./preview-generator";
import { applyPreviewToDom, cachePreview, dropPreviewCache } from "./preview";
import { MonitorFile, PendingFile, resetDraftOrder, state } from "./state";
import { applyTheme, normalizeTheme } from "./theme";
import {
  basename,
  clampQuantities,
  dataTransferToFiles,
  dataTransferToPaths,
  isEditingElement,
  isInteractiveTarget,
  normalizeQty,
  orderFilePath,
  previewFileName
} from "./utils";

async function confirmDialog(message: string) {
  if (typeof api.confirmDialog === "function") {
    return api.confirmDialog({ message });
  }
  return window.confirm(message);
}

function toMonitorFile(
  file: { path: string; name?: string; size?: number; mtimeMs?: number },
  status: MonitorFile["status"]
): MonitorFile {
  const name = file.name ?? basename(file.path);
  return {
    path: file.path,
    name,
    ext: getExtension(name),
    size: Number(file.size ?? 0),
    mtimeMs: Number(file.mtimeMs ?? 0),
    status
  };
}

function upsertMonitorFile(
  file: { path: string; name?: string; size?: number; mtimeMs?: number },
  status: MonitorFile["status"]
) {
  const existing = state.monitorFiles.find((item) => item.path === file.path);
  if (!existing) {
    state.monitorFiles.push(toMonitorFile(file, status));
    return;
  }
  existing.name = file.name ?? existing.name;
  existing.ext = getExtension(existing.name);
  if (Number.isFinite(Number(file.size))) existing.size = Number(file.size);
  if (Number.isFinite(Number(file.mtimeMs))) existing.mtimeMs = Number(file.mtimeMs);
  if (existing.status === "added" || existing.status === "ignored") return;
  if (status === "new") {
    existing.status = "new";
    return;
  }
  if (existing.status === "new") return;
  existing.status = status;
}

function appendMonitorFiles(
  files: Array<{ path: string; name?: string; size?: number; mtimeMs?: number }>,
  status: MonitorFile["status"]
) {
  if (!files || files.length === 0) return;
  for (const file of files) {
    if (!file?.path) continue;
    upsertMonitorFile(file, status);
  }
}

function getMonitorCandidates() {
  return state.monitorFiles.filter((file) => {
    if (file.status === "added" || file.status === "ignored") return false;
    if (state.monitorFilter === "new") return file.status === "new";
    return true;
  });
}

function markMonitorFile(path: string, status: MonitorFile["status"]) {
  const target = state.monitorFiles.find((item) => item.path === path);
  if (!target) return;
  target.status = status;
}

export function bindHandlers(root: HTMLElement, render: () => void) {
  const hasBaseDir = Boolean(state.settings.baseDir);

  root.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabValue = tab.dataset.tab;
      if (
        tabValue === "add" ||
        tabValue === "manage" ||
        tabValue === "assets" ||
        tabValue === "settings"
      ) {
        state.activeTab = tabValue;
        render();
      }
    });
  });

  const normalizeAssetValue = (value: string) => value.trim();

  const normalizeAssetList = (list: unknown) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => normalizeAssetValue(String(item ?? "")))
      .filter((item) => item.length > 0);
  };

  const getAssetLists = () => {
    const customers = normalizeAssetList(state.settings.customers);
    const materials = normalizeAssetList(state.settings.materials);
    return { customers, materials };
  };

  const addAssetValue = (list: string[], value: string) => {
    const normalized = normalizeAssetValue(value);
    if (!normalized) return list;
    const key = normalized.toLowerCase();
    if (list.some((item) => item.toLowerCase() === key)) return list;
    return [...list, normalized];
  };

  const removeAssetValue = (list: string[], value: string) => {
    const key = normalizeAssetValue(value).toLowerCase();
    if (!key) return list;
    return list.filter((item) => item.toLowerCase() !== key);
  };

  const saveAssets = async (customers: string[], materials: string[]) => {
    const updated = await api.saveAssets(customers, materials);
    state.settings = updated;
    const nextCustomers = normalizeAssetList(updated.customers);
    const nextMaterials = normalizeAssetList(updated.materials);
    state.selectedCustomers = new Set(
      Array.from(state.selectedCustomers).filter((item) => nextCustomers.includes(item))
    );
    state.selectedMaterials = new Set(
      Array.from(state.selectedMaterials).filter((item) => nextMaterials.includes(item))
    );
    render();
  };
  const resetInteractionState = () => {
    state.selectedTarget = null;
    state.editingOrderId = null;
    state.manageEditMode = false;
    state.assetEditMode = false;
    state.selectedOrderIds.clear();
    state.selectedCustomers.clear();
    state.selectedMaterials.clear();
    state.searchQuery = "";
    state.lastSearchQuery = "";
  };
  const restoreFocus = () => {
    window.requestAnimationFrame(() => {
      window.focus();
      const input = document.querySelector<HTMLInputElement>(
        "input:not([type=\"checkbox\"]):not([disabled]), textarea:not([disabled])"
      );
      input?.focus();
    });
  };
  const syncOrderSelection = () => {
    if (!state.manageEditMode) {
      state.selectedOrderIds.clear();
      return;
    }
    const existing = new Set(state.orders.map((order) => order.dirName));
    state.selectedOrderIds = new Set(
      Array.from(state.selectedOrderIds).filter((id) => existing.has(id))
    );
  };
  const applySettings = async (nextSettings: Settings | null) => {
    if (!nextSettings) return;
    state.settings = nextSettings;
    state.theme = normalizeTheme(nextSettings.theme ?? state.theme);
    applyTheme(state.theme);
    if (nextSettings.baseDir) {
      await refreshOrders();
    }
    render();
  };

  const handleChooseDir = async () => {
    const nextSettings = await api.chooseBaseDir();
    await applySettings(nextSettings);
  };

  const handleMonitorChoose = async () => {
    const folder = await api.selectWatchFolder();
    if (!folder) return;
    const ok = await api.watchFolder(folder);
    if (!ok) {
      alert("\u65e0\u6cd5\u76d1\u63a7\u8be5\u76ee\u5f55\uff0c\u8bf7\u68c0\u67e5\u8def\u5f84\u548c\u6743\u9650\u3002");
      return;
    }
    state.monitorFolder = folder;
    state.monitorFiles = [];
    if (state.monitorFilter === "all") {
      const files = await api.listWatchFolderFiles();
      appendMonitorFiles(files, "existing");
    }
    render();
  };

  const handleMonitorRefresh = async () => {
    if (!state.monitorFolder) return;
    const added = await api.refreshWatchFolder();
    if (added.length === 0) return;
    appendMonitorFiles(added, "new");
    render();
  };

  const handleMonitorFilterChange = async (value: string) => {
    state.monitorFilter = value === "all" ? "all" : "new";
    if (state.monitorFilter === "all" && state.monitorFolder) {
      const files = await api.listWatchFolderFiles();
      appendMonitorFiles(files, "existing");
    }
    render();
  };

  const handleMonitorResetHistory = () => {
    state.monitorFiles = state.monitorFiles.map((file) => {
      if (file.status === "added" || file.status === "ignored") {
        return { ...file, status: "new" };
      }
      return file;
    });
    render();
  };

  const handleMonitorAddAll = async () => {
    const targets = getMonitorCandidates();
    if (targets.length === 0) return;
    const paths = targets.map((file) => file.path);
    addPendingFiles(paths);
    for (const file of targets) {
      file.status = "added";
    }
    render();
    await fillPendingPreviewsFromPaths(paths, render);
  };

  const handleMonitorAddOne = async (path: string) => {
    if (!path) return;
    const target = state.monitorFiles.find((file) => file.path === path);
    if (!target || target.status === "added") return;
    addPendingFiles([path]);
    markMonitorFile(path, "added");
    render();
    await fillPendingPreviewsFromPaths([path], render);
  };

  const handleMonitorIgnoreOne = (path: string) => {
    if (!path) return;
    const target = state.monitorFiles.find((file) => file.path === path);
    if (!target || target.status === "ignored" || target.status === "added") return;
    markMonitorFile(path, "ignored");
    render();
  };

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
        printQty: f.printQty,
        note: f.note
      }));
      const updated = await api.addFiles(order.dirName, filesPayload);
      await applyPendingPreviews(updated, state.pendingFiles, updated.files);
    }

    state.pendingFiles = [];
    state.selectedTarget = null;
    resetDraftOrder();
    await refreshOrders();
    state.searchQuery = "";
    state.lastSearchQuery = "";
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
  root.querySelector<HTMLButtonElement>("#monitorChooseBtn")?.addEventListener(
    "click",
    handleMonitorChoose
  );
  root.querySelector<HTMLSelectElement>("#monitorFilterSelect")?.addEventListener(
    "change",
    (e) => handleMonitorFilterChange((e.currentTarget as HTMLSelectElement).value)
  );
  root.querySelector<HTMLButtonElement>("#monitorRefreshBtn")?.addEventListener(
    "click",
    handleMonitorRefresh
  );
  root.querySelector<HTMLButtonElement>("#monitorResetBtn")?.addEventListener(
    "click",
    handleMonitorResetHistory
  );
  root.querySelector<HTMLButtonElement>("#monitorAddAllBtn")?.addEventListener(
    "click",
    handleMonitorAddAll
  );
  root.querySelectorAll<HTMLButtonElement>("[data-monitor-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.monitorAction;
      const path = btn.dataset.monitorPath;
      if (!action || !path) return;
      if (action === "add") {
        await handleMonitorAddOne(path);
        return;
      }
      if (action === "ignore") {
        handleMonitorIgnoreOne(path);
      }
    });
  });
  root.querySelector<HTMLButtonElement>("#chooseDirBtn")?.addEventListener("click", handleChooseDir);
  root.querySelector<HTMLButtonElement>("#initChooseDirBtn")?.addEventListener("click", handleChooseDir);

  root.querySelector<HTMLButtonElement>("#initContinueBtn")?.addEventListener("click", async () => {
    if (!state.settings.baseDir) return;
    state.onboarding = false;
    state.activeTab = "add";
    await refreshOrders();
    render();
  });

  root.querySelector<HTMLSelectElement>("#themeSelect")?.addEventListener("change", async (e) => {
    const nextTheme = normalizeTheme((e.currentTarget as HTMLSelectElement).value);
    state.theme = nextTheme;
    applyTheme(nextTheme);
    const updated = await api.saveTheme(nextTheme);
    state.settings = updated;
    render();
  });

  root.querySelector<HTMLSelectElement>("#dragModeSelect")?.addEventListener("change", (e) => {
    const nextMode = (e.currentTarget as HTMLSelectElement).value;
    state.dragMode = nextMode === "download" ? "download" : "native";
    localStorage.setItem("dragMode", state.dragMode);
    render();
  });

  const searchInput = root.querySelector<HTMLInputElement>("#orderSearch");
  if (searchInput) {
    let isComposing = false;
    const updateSearch = (
      value: string,
      selectionStart: number | null,
      selectionEnd: number | null,
      preserveFocus: boolean
    ) => {
      state.searchQuery = value;
      state.lastSearchQuery = "";
      render();
      if (!preserveFocus) return;
      window.requestAnimationFrame(() => {
        const nextInput = document.querySelector<HTMLInputElement>("#orderSearch");
        if (!nextInput) return;
        nextInput.focus();
        if (selectionStart !== null && selectionEnd !== null) {
          nextInput.setSelectionRange(selectionStart, selectionEnd);
        }
      });
    };

    searchInput.addEventListener("compositionstart", () => {
      isComposing = true;
    });
    searchInput.addEventListener("compositionend", () => {
      isComposing = false;
      updateSearch(
        searchInput.value,
        searchInput.selectionStart,
        searchInput.selectionEnd,
        true
      );
    });
    searchInput.addEventListener("input", () => {
      if (isComposing) return;
      const preserveFocus = document.activeElement === searchInput;
      updateSearch(
        searchInput.value,
        searchInput.selectionStart,
        searchInput.selectionEnd,
        preserveFocus
      );
    });
  }
  root.querySelector<HTMLButtonElement>("#clearSearch")?.addEventListener("click", () => {
    state.searchQuery = "";
    state.lastSearchQuery = "";
    render();
  });
  root.querySelector<HTMLButtonElement>("#refreshOrders")?.addEventListener("click", async () => {
    await refreshOrders();
    syncOrderSelection();
    state.lastSearchQuery = "";
    render();
  });
  root.querySelector<HTMLButtonElement>("#toggleOrderEdit")?.addEventListener("click", () => {
    state.manageEditMode = !state.manageEditMode;
    if (!state.manageEditMode) {
      state.selectedOrderIds.clear();
    }
    render();
  });
  root.querySelector<HTMLButtonElement>("#selectAllOrders")?.addEventListener("click", () => {
    const ids = Array.from(root.querySelectorAll<HTMLInputElement>("[data-order-select]"))
      .map((input) => input.dataset.orderSelect)
      .filter((id): id is string => Boolean(id));
    state.selectedOrderIds = new Set(ids);
    render();
  });
  root.querySelector<HTMLButtonElement>("#deleteSelectedOrders")?.addEventListener("click", async () => {
    if (state.selectedOrderIds.size === 0) return;
    if (!(await confirmDialog("\u786e\u5b9a\u8981\u5220\u9664\u9009\u4e2d\u8ba2\u5355\u5417\uff1f")))
      return;
    const ids = Array.from(state.selectedOrderIds);
    try {
      await Promise.all(ids.map((id) => api.deleteOrder(id)));
    } finally {
      resetInteractionState();
      await refreshOrders().catch((error) => console.error("Refresh orders failed:", error));
      syncOrderSelection();
      render();
      restoreFocus();
    }
  });
  root.querySelectorAll<HTMLInputElement>("[data-order-select]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.orderSelect;
      if (!id) return;
      if (input.checked) {
        state.selectedOrderIds.add(id);
      } else {
        state.selectedOrderIds.delete(id);
      }
      render();
    });
  });

  root.querySelectorAll<HTMLFormElement>(".asset-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const kind = form.dataset.asset;
      const input = form.querySelector<HTMLInputElement>("input");
      if (!input) return;
      const value = normalizeAssetValue(input.value);
      if (!value) return;
      const { customers, materials } = getAssetLists();
      if (kind === "customer") {
        const nextCustomers = addAssetValue(customers, value);
        await saveAssets(nextCustomers, materials);
      } else if (kind === "material") {
        const nextMaterials = addAssetValue(materials, value);
        await saveAssets(customers, nextMaterials);
      }
      input.value = "";
    });
  });
  root.querySelector<HTMLButtonElement>("#toggleAssetEdit")?.addEventListener("click", () => {
    state.assetEditMode = !state.assetEditMode;
    if (!state.assetEditMode) {
      state.selectedCustomers.clear();
      state.selectedMaterials.clear();
    }
    render();
  });
  root.querySelector<HTMLButtonElement>("#selectAllAssets")?.addEventListener("click", () => {
    const customers = normalizeAssetList(state.settings.customers);
    const materials = normalizeAssetList(state.settings.materials);
    state.selectedCustomers = new Set(customers);
    state.selectedMaterials = new Set(materials);
    render();
  });
  root.querySelector<HTMLButtonElement>("#deleteSelectedAssets")?.addEventListener("click", async () => {
    const hasSelection =
      state.selectedCustomers.size > 0 || state.selectedMaterials.size > 0;
    if (!hasSelection) return;
    if (!(await confirmDialog("\u786e\u5b9a\u8981\u5220\u9664\u9009\u4e2d\u8d44\u4ea7\u5417\uff1f")))
      return;
    const customers = normalizeAssetList(state.settings.customers).filter(
      (item) => !state.selectedCustomers.has(item)
    );
    const materials = normalizeAssetList(state.settings.materials).filter(
      (item) => !state.selectedMaterials.has(item)
    );
    state.selectedCustomers.clear();
    state.selectedMaterials.clear();
    await saveAssets(customers, materials);
  });
  root.querySelectorAll<HTMLInputElement>("[data-asset-select]").forEach((input) => {
    input.addEventListener("change", () => {
      const kind = input.dataset.assetKind;
      const value = input.dataset.assetValue;
      if (!kind || !value) return;
      const target = kind === "customer" ? state.selectedCustomers : state.selectedMaterials;
      if (input.checked) {
        target.add(value);
      } else {
        target.delete(value);
      }
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-action=\"delete-customer\"]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.value ?? "";
      const { customers, materials } = getAssetLists();
      const nextCustomers = removeAssetValue(customers, value);
      await saveAssets(nextCustomers, materials);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-action=\"delete-material\"]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.value ?? "";
      const { customers, materials } = getAssetLists();
      const nextMaterials = removeAssetValue(materials, value);
      await saveAssets(customers, nextMaterials);
    });
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

  root.querySelectorAll<HTMLTextAreaElement>('[data-pending-index] .file-note').forEach((input) => {
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("change", () => {
      const row = input.closest<HTMLElement>("[data-pending-index]");
      const index = Number(row?.dataset.pendingIndex ?? -1);
      if (index < 0) return;
      state.pendingFiles[index].note = input.value.trim();
    });
  });

  root.querySelectorAll<HTMLButtonElement>(".pending-qty-button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = btn.closest<HTMLElement>("[data-pending-index]");
      const index = Number(row?.dataset.pendingIndex ?? -1);
      if (index < 0) return;
      const file = state.pendingFiles[index];
      if (!file) return;
      const action = btn.getAttribute("data-qty-action");
      const delta = action === "inc" ? 1 : -1;
      const next = Math.max(1, normalizeQty((file.printQty ?? 1) + delta, 1));
      file.printQty = next;
      const input = row?.querySelector<HTMLInputElement>(".pending-qty-input");
      if (input) input.value = String(next);
    });
  });

  root.querySelectorAll<HTMLInputElement>(".pending-qty-input").forEach((input) => {
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("change", () => {
      const row = input.closest<HTMLElement>("[data-pending-index]");
      const index = Number(row?.dataset.pendingIndex ?? -1);
      if (index < 0) return;
      const file = state.pendingFiles[index];
      if (!file) return;
      const next = Math.max(1, normalizeQty(input.value ?? 1, 1));
      file.printQty = next;
      input.value = String(next);
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
        previews.length > 0
          ? await applyPendingPreviews(updated, previews, updated.files.slice(-previews.length))
          : updated;
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
      if (select.value === "bambu-connect") {
        const ok = await api.importBambuConnect(dirName, savedAs);
        if (!ok) {
          alert("\u53ea\u652f\u6301 3mf \u6587\u4ef6\u5bfc\u5165\u3002");
        }
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
        if (!(await confirmDialog("\u786e\u5b9a\u8981\u5220\u9664\u5417\uff1f"))) {
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

  root.querySelectorAll<HTMLTextAreaElement>('[data-file] .file-note').forEach((input) => {
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
      const stepInput = row.querySelector<HTMLInputElement>(
        `.qty-step[data-qty-step="${field}"]`
      );
      const stepValue = Math.max(1, normalizeQty(stepInput?.value ?? 1, 1));
      const printInput = row.querySelector<HTMLInputElement>('.qty-input[data-qty-field="print"]');
      const printedInput = row.querySelector<HTMLInputElement>(
        '.qty-input[data-qty-field="printed"]'
      );
      const printQty = normalizeQty(printInput?.value ?? 0, 0);
      const printedQty = normalizeQty(printedInput?.value ?? 0, 0);
      const delta = action === "inc" ? stepValue : -stepValue;
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
      if (!(await confirmDialog("\u786e\u5b9a\u8981\u5220\u9664\u5417\uff1f"))) return;
      try {
        await api.deleteOrder(id);
      } finally {
        resetInteractionState();
        await refreshOrders().catch((error) => console.error("Refresh orders failed:", error));
        syncOrderSelection();
        render();
        restoreFocus();
      }
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

  root.querySelectorAll<HTMLInputElement>(".qty-step").forEach((input) => {
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("change", () => {
      const field = input.getAttribute("data-qty-step") as "print" | "printed";
      if (!field) return;
      const next = Math.max(1, normalizeQty(input.value ?? 1, 1));
      input.value = String(next);
      state.qtyStep[field] = next;
      localStorage.setItem(field === "print" ? "qtyStepPrint" : "qtyStepPrinted", String(next));
      render();
    });
  });

  const query = state.searchQuery.trim();
  if (!query) {
    state.lastSearchQuery = "";
  } else if (query !== state.lastSearchQuery) {
    const target = root.querySelector<HTMLElement>('[data-search-target="true"]');
    if (target) {
      target.classList.add("search-jump");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => target.classList.remove("search-jump"), 1200);
    }
    state.lastSearchQuery = query;
  }
}

export function attachGlobalHandlers(render: () => void) {
  if (state.handlersAttached) return;
  state.handlersAttached = true;

  if (typeof api.onWatchFolderAdded === "function") {
    api.onWatchFolderAdded((payload) => {
      if (!payload || payload.folder !== state.monitorFolder) return;
      appendMonitorFiles(payload.files ?? [], "new");
      render();
    });
  }

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
      if (!(await confirmDialog("\u786e\u5b9a\u8981\u5220\u9664\u5417\uff1f"))) return;
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







