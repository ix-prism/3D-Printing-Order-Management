import { DEFAULT_THEME, ThemeId } from "./theme";
export type PendingFile = {
  id: string;
  path?: string;
  name: string;
  note: string;
  printQty?: number;
  data?: ArrayBuffer;
  size?: number;
  lastModified?: number;
  previewDataUrl?: string;
};

export type MonitorFileStatus = "new" | "existing" | "added" | "ignored";

export type MonitorFile = {
  path: string;
  name: string;
  ext: string;
  size: number;
  mtimeMs: number;
  status: MonitorFileStatus;
};

export type SelectedTarget =
  | { kind: "pending-file"; index: number }
  | { kind: "pending-preview"; index: number }
  | { kind: "order-file"; dirName: string; savedAs: string }
  | { kind: "order-preview"; dirName: string; savedAs: string };

export type DraftOrder = {
  customerName: string;
  title: string;
  material: string;
  quantity: number;
  dueDate: string;
  status: OrderStatus;
  note: string;
  folderNote: string;
};

export const previewCache = new Map<string, string>();
export const previewLoading = new Set<string>();

export const state = {
  orders: [] as Order[],
  settings: {} as Settings,
  activeTab: "add" as "add" | "manage" | "assets" | "settings",
  pendingFiles: [] as PendingFile[],
  selectedTarget: null as SelectedTarget | null,
  handlersAttached: false,
  monitorFolder: null as string | null,
  monitorFiles: [] as MonitorFile[],
  monitorFilter: "new" as "new" | "all",
  onboarding: false,
  theme: DEFAULT_THEME as ThemeId,
  searchQuery: "",
  lastSearchQuery: "",
  manageEditMode: false,
  selectedOrderIds: new Set<string>(),
  assetEditMode: false,
  selectedCustomers: new Set<string>(),
  selectedMaterials: new Set<string>(),
  qtyStep: {
    print: 1,
    printed: 1
  },
  editingOrderId: null as string | null,
  collapsedOrders: new Set<string>(),
  dragMode: "native" as "native" | "download",
  draftOrder: {
    customerName: "",
    title: "",
    material: "",
    quantity: 1,
    dueDate: "",
    status: "\u65b0\u5efa" as OrderStatus,
    note: "",
    folderNote: ""
  } as DraftOrder
};

export function resetDraftOrder() {
  state.draftOrder = {
    customerName: "",
    title: "",
    material: "",
    quantity: 1,
    dueDate: "",
    status: "\u65b0\u5efa",
    note: "",
    folderNote: ""
  };
}


