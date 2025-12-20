export type PendingFile = {
  id: string;
  path?: string;
  name: string;
  note: string;
  data?: ArrayBuffer;
  size?: number;
  lastModified?: number;
  previewDataUrl?: string;
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
  activeTab: "add" as "add" | "manage" | "settings",
  pendingFiles: [] as PendingFile[],
  selectedTarget: null as SelectedTarget | null,
  handlersAttached: false,
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
