import { api } from "./api";
import { previewCache, previewLoading, state } from "./state";

export async function refreshOrders() {
  state.orders = await api.listOrders();
  previewCache.clear();
  previewLoading.clear();
}

export function applyOrderUpdate(updated: Order) {
  const index = state.orders.findIndex((o) => o.dirName === updated.dirName);
  if (index >= 0) {
    state.orders[index] = updated;
  } else {
    state.orders.unshift(updated);
  }
}
