import { api } from "./api";
import { attachGlobalHandlers, bindHandlers } from "./handlers";
import { refreshOrders } from "./orders";
import { renderApp } from "./render";
import { state } from "./state";

function paint() {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;
  root.innerHTML = renderApp();
  bindHandlers(root, paint);
}

export async function initApp() {
  const storedMode = localStorage.getItem("dragMode");
  if (storedMode === "download") {
    state.dragMode = "download";
  }
  state.settings = await api.getSettings();
  if (!state.settings.baseDir) {
    state.activeTab = "settings";
    const nextSettings = await api.chooseBaseDir();
    if (nextSettings?.baseDir) {
      state.settings = nextSettings;
    }
  }
  await refreshOrders();
  attachGlobalHandlers(paint);
  paint();
}
