const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  chooseBaseDir: () => ipcRenderer.invoke("choose-base-dir"),
  setBaseDir: (baseDir) => ipcRenderer.invoke("set-base-dir", baseDir),
  listOrders: () => ipcRenderer.invoke("list-orders"),
  createOrder: (payload) => ipcRenderer.invoke("create-order", payload),
  updateOrder: (dirName, patch) => ipcRenderer.invoke("update-order", dirName, patch),
  selectFiles: () => ipcRenderer.invoke("select-files"),
  readFileBuffer: (filePath) => ipcRenderer.invoke("read-file-buffer", filePath),
  getClipboardImage: () => ipcRenderer.invoke("get-clipboard-image"),
  getPreviewDataUrl: (dirName, previewFile) =>
    ipcRenderer.invoke("get-preview-data-url", dirName, previewFile),
  showFileInFolder: (dirName, savedAs) =>
    ipcRenderer.invoke("show-file-in-folder", dirName, savedAs),
  startDragFile: (filePath) => ipcRenderer.sendSync("start-drag-file", filePath),
  addFiles: (dirName, files, folderNote) =>
    ipcRenderer.invoke("add-files", dirName, files, folderNote),
  replaceFile: (dirName, savedAs, newPath) =>
    ipcRenderer.invoke("replace-file", dirName, savedAs, newPath),
  deleteFile: (dirName, savedAs) => ipcRenderer.invoke("delete-file", dirName, savedAs),
  deletePreviewImage: (dirName, savedAs) =>
    ipcRenderer.invoke("delete-preview-image", dirName, savedAs),
  savePreviewImage: (dirName, savedAs, dataUrl) =>
    ipcRenderer.invoke("save-preview-image", dirName, savedAs, dataUrl),
  updateFileQuantities: (dirName, savedAs, printQty, printedQty) =>
    ipcRenderer.invoke("update-file-quantities", dirName, savedAs, printQty, printedQty),
  updateFileNote: (dirName, savedAs, note) =>
    ipcRenderer.invoke("update-file-note", dirName, savedAs, note),
  updateOrderNote: (dirName, note) => ipcRenderer.invoke("update-order-note", dirName, note),
  copyOrder: (dirName) => ipcRenderer.invoke("copy-order", dirName),
  deleteOrder: (dirName) => ipcRenderer.invoke("delete-order", dirName)
});
