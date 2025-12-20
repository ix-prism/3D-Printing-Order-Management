const { app, BrowserWindow, ipcMain, dialog, clipboard, shell, nativeImage } = require("electron");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const appName = "PrintOrder";
app.setName(appName);
const userDataDir = path.join(app.getPath("appData"), appName);
app.setPath("userData", userDataDir);
app.commandLine.appendSwitch("disk-cache-dir", path.join(userDataDir, "cache"));
app.commandLine.appendSwitch("gpu-cache-dir", path.join(userDataDir, "gpu-cache"));

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const appId = "com.printstudio.printorder";
const appIconPath = path.join(__dirname, "app-icon.png");
const dragIconPath = path.join(__dirname, "drag-icon.png");
const dragIconDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAPUlEQVRYR+3OMQEAIAzAsANf+UeSgqJXyabWcgXBecNADQNSqZL0tVZr0s5V3q9f9+0iYAPWwQFbEOy0uAAAAAElFTkSuQmCC";
const appIconDataUrl = dragIconDataUrl;
let appIcon;
let dragIcon;

function getAppIcon() {
  if (appIcon) return appIcon;
  if (!nativeImage) return null;
  let icon;
  if (fs.existsSync(appIconPath)) {
    icon = nativeImage.createFromPath(appIconPath);
  }
  if (!icon || icon.isEmpty()) {
    if (typeof nativeImage.createFromDataURL !== "function") return null;
    icon = nativeImage.createFromDataURL(appIconDataUrl);
  }
  if (!icon || icon.isEmpty()) return null;
  appIcon = icon;
  return appIcon;
}

function getDragIcon() {
  if (dragIcon) return dragIcon;
  if (!nativeImage) return null;
  let icon;
  if (fs.existsSync(dragIconPath)) {
    icon = nativeImage.createFromPath(dragIconPath);
  }
  if (!icon || icon.isEmpty()) {
    if (typeof nativeImage.createFromDataURL !== "function") return null;
    icon = nativeImage.createFromDataURL(dragIconDataUrl);
  }
  if (!icon || icon.isEmpty()) return null;
  dragIcon = icon;
  return dragIcon;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    icon: getAppIcon() ?? undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  if (app.isPackaged || !devServerUrl) {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    win.loadURL(devServerUrl);
  }
}

async function readSettings() {
  try {
    const raw = await fsp.readFile(settingsPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeSettings(settings) {
  await fsp.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fsp.writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function formatDateYYMMDD(d = new Date()) {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function sanitizeSegment(value) {
  const cleaned = String(value ?? "")
    .replace(/[<>:"/\\|?*\\x00-\\x1F]/g, "")
    .replace(/\s+/g, "_")
    .trim();
  return cleaned || "\u672a\u547d\u540d";
}
function ensureBaseDir(baseDir) {
  return fsp.mkdir(baseDir, { recursive: true });
}

async function readOrder(baseDir, dirName) {
  const orderPath = path.join(baseDir, dirName, "order.json");
  const raw = await fsp.readFile(orderPath, "utf8");
  return JSON.parse(raw);
}

async function writeOrder(baseDir, dirName, order) {
  const orderPath = path.join(baseDir, dirName, "order.json");
  await fsp.writeFile(orderPath, JSON.stringify(order, null, 2), "utf8");
}

function uniquePath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const parsed = path.parse(targetPath);
  let counter = 1;
  while (true) {
    const candidate = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    counter += 1;
  }
}

function previewFileName(savedAs) {
  return `${savedAs}.preview.png`;
}

function decodeImageDataUrl(dataUrl) {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) {
    throw new Error("Invalid image data");
  }
  return Buffer.from(match[2], "base64");
}

function toBuffer(data) {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data?.type === "Buffer" && Array.isArray(data.data)) {
    return Buffer.from(data.data);
  }
  return null;
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId(appId);
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("get-settings", async () => readSettings());

ipcMain.handle("choose-base-dir", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const baseDir = result.filePaths[0];
  const settings = await readSettings();
  settings.baseDir = baseDir;
  settings.lastOrderNumber = settings.lastOrderNumber ?? 0;
  await writeSettings(settings);
  await ensureBaseDir(baseDir);
  return settings;
});

ipcMain.handle("select-files", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"]
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle("read-file-buffer", async (_event, filePath) => {
  if (!filePath || typeof filePath !== "string") return null;
  const normalized = path.normalize(filePath);
  if (!fs.existsSync(normalized)) return null;
  return await fsp.readFile(normalized);
});

ipcMain.handle("get-file-thumbnail", async (_event, filePath, size = 256) => {
  if (!filePath || typeof filePath !== "string") return null;
  const normalized = path.normalize(filePath);
  if (!fs.existsSync(normalized)) return null;
  try {
    const image = await nativeImage.createThumbnailFromPath(normalized, {
      width: size,
      height: size
    });
    if (!image || image.isEmpty()) return null;
    return image.toDataURL();
  } catch (error) {
    console.warn("Thumbnail failed:", error);
    return null;
  }
});

ipcMain.handle("show-file-in-folder", async (_event, dirName, savedAs) => {
  const settings = await readSettings();
  if (!settings.baseDir || !dirName || !savedAs) return false;
  const filePath = path.join(settings.baseDir, dirName, savedAs);
  if (!fs.existsSync(filePath)) return false;
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.on("start-drag-file", (event, filePath) => {
  if (!filePath) {
    event.returnValue = false;
    return;
  }
  const normalized = path.normalize(filePath);
  if (!fs.existsSync(normalized)) {
    console.warn("Drag file missing:", normalized);
    event.returnValue = false;
    return;
  }
  try {
    const icon = getDragIcon();
    if (!icon) {
      console.warn("Drag icon invalid");
      event.returnValue = false;
      return;
    }
    console.info("Start drag:", normalized);
    event.sender.startDrag({ file: normalized, icon });
    event.returnValue = true;
  } catch (error) {
    console.error("Failed to start drag:", error);
    event.returnValue = false;
  }
});

ipcMain.handle("get-clipboard-image", async () => {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;
  return image.toDataURL();
});

ipcMain.handle("get-preview-data-url", async (_event, dirName, previewFile) => {
  const settings = await readSettings();
  if (!settings.baseDir || !dirName || !previewFile) return null;
  const filePath = path.join(settings.baseDir, dirName, previewFile);
  if (!fs.existsSync(filePath)) return null;
  const buffer = await fsp.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
});

ipcMain.handle("set-base-dir", async (_event, baseDir) => {
  if (!baseDir || typeof baseDir !== "string") {
    throw new Error("Base directory is required.");
  }
  const settings = await readSettings();
  settings.baseDir = baseDir;
  settings.lastOrderNumber = settings.lastOrderNumber ?? 0;
  await writeSettings(settings);
  await ensureBaseDir(baseDir);
  return settings;
});

ipcMain.handle("list-orders", async () => {
  const settings = await readSettings();
  if (!settings.baseDir) return [];
  const baseDir = settings.baseDir;
  const entries = await fsp.readdir(baseDir, { withFileTypes: true });
  const orders = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const orderPath = path.join(baseDir, entry.name, "order.json");
    if (!fs.existsSync(orderPath)) continue;
    try {
      const raw = await fsp.readFile(orderPath, "utf8");
      const order = JSON.parse(raw);
      orders.push(order);
    } catch {
      // ignore invalid order
    }
  }

  return orders;
});

ipcMain.handle("create-order", async (_event, payload) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;

  const orderNo = (settings.lastOrderNumber ?? 0) + 1;
  const datePrefix = formatDateYYMMDD();
  const title = sanitizeSegment(payload?.title);
  const customer = sanitizeSegment(payload?.customerName);
  const folderBase = `${datePrefix}_${title}_${customer}_${String(orderNo).padStart(4, "0")}`;
  let dirName = folderBase;
  let candidatePath = path.join(baseDir, dirName);
  let suffix = 1;
  while (fs.existsSync(candidatePath)) {
    dirName = `${folderBase}_${suffix}`;
    candidatePath = path.join(baseDir, dirName);
    suffix += 1;
  }

  await ensureBaseDir(candidatePath);

  const order = {
    dirName,
    orderNo,
    datePrefix,
    customerName: payload?.customerName ?? "",
    title: payload?.title ?? "",
    material: payload?.material ?? "",
    quantity: Number(payload?.quantity ?? 1),
    dueDate: payload?.dueDate ?? "",
    status: payload?.status ?? "\u65b0\u5efa",
    note: payload?.note ?? "",
    folderNote: payload?.folderNote ?? "",
    shippingInfo: payload?.shippingInfo ?? "",
    createdAt: new Date().toISOString(),
    files: []
  };

  await writeOrder(baseDir, dirName, order);
  settings.lastOrderNumber = orderNo;
  await writeSettings(settings);
  return order;
});

ipcMain.handle("copy-order", async (_event, dirName) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const sourceDir = path.join(baseDir, dirName);
  if (!fs.existsSync(sourceDir)) throw new Error("Order not found.");
  const sourceOrder = await readOrder(baseDir, dirName);

  const orderNo = (settings.lastOrderNumber ?? 0) + 1;
  const datePrefix = formatDateYYMMDD();
  const title = sanitizeSegment(sourceOrder.title);
  const customer = sanitizeSegment(sourceOrder.customerName);
  const folderBase = `${datePrefix}_${title}_${customer}_${String(orderNo).padStart(4, "0")}`;
  let nextDirName = folderBase;
  let candidatePath = path.join(baseDir, nextDirName);
  let suffix = 1;
  while (fs.existsSync(candidatePath)) {
    nextDirName = `${folderBase}_${suffix}`;
    candidatePath = path.join(baseDir, nextDirName);
    suffix += 1;
  }

  await fsp.cp(sourceDir, candidatePath, { recursive: true });

  const copied = {
    ...sourceOrder,
    dirName: nextDirName,
    orderNo,
    datePrefix,
    status: "\u65b0\u5efa",
    shippingInfo: "",
    createdAt: new Date().toISOString(),
    files: (sourceOrder.files || []).map((file) => ({
      ...file,
      printedQty: 0
    }))
  };

  await writeOrder(baseDir, nextDirName, copied);
  settings.lastOrderNumber = orderNo;
  await writeSettings(settings);
  return copied;
});

ipcMain.handle("delete-order", async (_event, dirName) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const targetDir = path.join(baseDir, dirName);
  if (!fs.existsSync(targetDir)) return false;
  await fsp.rm(targetDir, { recursive: true, force: true });
  return true;
});

ipcMain.handle("update-order", async (_event, dirName, patch) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);
  const updated = { ...order, ...patch };
  await writeOrder(baseDir, dirName, updated);
  return updated;
});

ipcMain.handle("add-files", async (_event, dirName, files, folderNote) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);

  const orderDir = path.join(baseDir, dirName);
  const addedFiles = [];

  for (const file of files || []) {
    const hasPath = typeof file?.path === "string" && file.path.length > 0;
    const hasData = file?.data && file?.name;
    if (!hasPath && !hasData) continue;
    const originalName = hasPath ? path.basename(file.path) : path.basename(String(file.name));
    const targetPath = uniquePath(path.join(orderDir, originalName));
    if (hasPath) {
      await fsp.copyFile(file.path, targetPath);
    } else {
      const buffer = toBuffer(file.data);
      if (!buffer) continue;
      await fsp.writeFile(targetPath, buffer);
    }
    const printQty = Number.isFinite(Number(file.printQty)) ? Math.max(0, Number(file.printQty)) : 1;
    const printedQty = Number.isFinite(Number(file.printedQty)) ? Math.max(0, Number(file.printedQty)) : 0;
    addedFiles.push({
      name: originalName,
      savedAs: path.basename(targetPath),
      note: file.note ?? "",
      printQty,
      printedQty: Math.min(printedQty, printQty),
      addedAt: new Date().toISOString()
    });
  }

  order.files = [...(order.files || []), ...addedFiles];
  if (typeof folderNote === "string") {
    order.folderNote = folderNote;
  }
  await writeOrder(baseDir, dirName, order);
  return order;
});

ipcMain.handle("replace-file", async (_event, dirName, savedAs, newPath) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  if (!newPath) throw new Error("Missing file path.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);
  const orderDir = path.join(baseDir, dirName);
  const files = order.files || [];
  const index = files.findIndex((file) => file.savedAs === savedAs);
  if (index < 0) return order;

  const targetPath = path.join(orderDir, savedAs);
  await fsp.copyFile(newPath, targetPath);

  const prevPreview = files[index].previewImage;
  if (prevPreview) {
    const previewPath = path.join(orderDir, prevPreview);
    if (fs.existsSync(previewPath)) {
      await fsp.unlink(previewPath);
    }
  }

  files[index] = {
    ...files[index],
    name: path.basename(newPath),
    previewImage: ""
  };

  order.files = files;
  await writeOrder(baseDir, dirName, order);
  return order;
});

ipcMain.handle("delete-file", async (_event, dirName, savedAs) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);
  const orderDir = path.join(baseDir, dirName);
  const files = order.files || [];
  const index = files.findIndex((file) => file.savedAs === savedAs);
  if (index < 0) return order;

  const filePath = path.join(orderDir, savedAs);
  if (fs.existsSync(filePath)) {
    await fsp.unlink(filePath);
  }
  const previewImage = files[index].previewImage;
  if (previewImage) {
    const previewPath = path.join(orderDir, previewImage);
    if (fs.existsSync(previewPath)) {
      await fsp.unlink(previewPath);
    }
  }

  files.splice(index, 1);
  order.files = files;
  await writeOrder(baseDir, dirName, order);
  return order;
});

ipcMain.handle("delete-preview-image", async (_event, dirName, savedAs) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);
  const orderDir = path.join(baseDir, dirName);
  const files = order.files || [];
  const index = files.findIndex((file) => file.savedAs === savedAs);
  if (index < 0) return order;

  const previewImage = files[index].previewImage;
  if (previewImage) {
    const previewPath = path.join(orderDir, previewImage);
    if (fs.existsSync(previewPath)) {
      await fsp.unlink(previewPath);
    }
  }

  files[index] = { ...files[index], previewImage: "" };
  order.files = files;
  await writeOrder(baseDir, dirName, order);
  return order;
});

ipcMain.handle("save-preview-image", async (_event, dirName, savedAs, dataUrl) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);
  const orderDir = path.join(baseDir, dirName);
  const files = order.files || [];
  const index = files.findIndex((file) => file.savedAs === savedAs);
  if (index < 0) return order;

  const buffer = decodeImageDataUrl(dataUrl);
  const filename = previewFileName(savedAs);
  const previewPath = path.join(orderDir, filename);
  await fsp.writeFile(previewPath, buffer);

  files[index] = { ...files[index], previewImage: filename };
  order.files = files;
  await writeOrder(baseDir, dirName, order);
  return order;
});

ipcMain.handle("update-file-note", async (_event, dirName, savedAs, note) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);
  const files = order.files || [];
  const index = files.findIndex((file) => file.savedAs === savedAs);
  if (index >= 0) {
    files[index] = { ...files[index], note: note ?? "" };
    order.files = files;
    await writeOrder(baseDir, dirName, order);
  }
  return order;
});

ipcMain.handle("update-file-quantities", async (_event, dirName, savedAs, printQty, printedQty) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);
  const files = order.files || [];
  const index = files.findIndex((file) => file.savedAs === savedAs);
  if (index < 0) return order;

  const current = files[index];
  const nextPrint = Number.isFinite(Number(printQty))
    ? Math.max(0, Number(printQty))
    : Number(current.printQty ?? 1);
  const nextPrinted = Number.isFinite(Number(printedQty))
    ? Math.max(0, Number(printedQty))
    : Number(current.printedQty ?? 0);

  files[index] = {
    ...current,
    printQty: nextPrint,
    printedQty: Math.min(nextPrinted, nextPrint)
  };
  order.files = files;
  await writeOrder(baseDir, dirName, order);
  return order;
});

ipcMain.handle("update-order-note", async (_event, dirName, note) => {
  const settings = await readSettings();
  if (!settings.baseDir) throw new Error("Base directory not set.");
  const baseDir = settings.baseDir;
  const order = await readOrder(baseDir, dirName);
  order.folderNote = note ?? "";
  await writeOrder(baseDir, dirName, order);
  return order;
});
