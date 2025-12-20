/// <reference types="vite/client" />

type OrderStatus =
  | "\u65b0\u5efa"
  | "\u6253\u5370\u4e2d"
  | "\u540e\u5904\u7406"
  | "\u5df2\u5b8c\u6210"
  | "\u5df2\u53d6\u6d88";

type OrderFile = {
  name: string;
  savedAs: string;
  note?: string;
  previewImage?: string;
  printQty?: number;
  printedQty?: number;
  addedAt: string;
};

type Order = {
  dirName: string;
  orderNo: number;
  datePrefix: string;
  customerName: string;
  title: string;
  material: string;
  quantity: number;
  dueDate?: string;
  status: OrderStatus;
  note?: string;
  folderNote?: string;
  shippingInfo?: string;
  createdAt: string;
  files: OrderFile[];
};

type Settings = {
  baseDir?: string;
  lastOrderNumber?: number;
};

interface Window {
  electronAPI: {
    getSettings: () => Promise<Settings>;
    chooseBaseDir: () => Promise<Settings | null>;
    setBaseDir: (baseDir: string) => Promise<Settings>;
    listOrders: () => Promise<Order[]>;
    createOrder: (payload: Partial<Order>) => Promise<Order>;
    updateOrder: (dirName: string, patch: Partial<Order>) => Promise<Order>;
    selectFiles: () => Promise<string[]>;
    getClipboardImage: () => Promise<string | null>;
    getPreviewDataUrl: (dirName: string, previewFile: string) => Promise<string | null>;
    showFileInFolder: (dirName: string, savedAs: string) => Promise<boolean>;
    startDragFile: (filePath: string) => boolean;
    addFiles: (
      dirName: string,
      files: Array<{
        path?: string;
        name?: string;
        data?: ArrayBuffer;
        note?: string;
        printQty?: number;
        printedQty?: number;
      }>,
      folderNote?: string
    ) => Promise<Order>;
    replaceFile: (dirName: string, savedAs: string, newPath: string) => Promise<Order>;
    deleteFile: (dirName: string, savedAs: string) => Promise<Order>;
    deletePreviewImage: (dirName: string, savedAs: string) => Promise<Order>;
    savePreviewImage: (dirName: string, savedAs: string, dataUrl: string) => Promise<Order>;
    updateFileQuantities: (
      dirName: string,
      savedAs: string,
      printQty: number,
      printedQty: number
    ) => Promise<Order>;
    updateFileNote: (dirName: string, savedAs: string, note: string) => Promise<Order>;
    updateOrderNote: (dirName: string, note: string) => Promise<Order>;
    copyOrder: (dirName: string) => Promise<Order>;
    deleteOrder: (dirName: string) => Promise<boolean>;
  };
}
