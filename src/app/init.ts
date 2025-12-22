import { api } from "./api";
import { attachGlobalHandlers, bindHandlers } from "./handlers";
import { refreshOrders } from "./orders";
import { renderApp } from "./render";
import { state } from "./state";
import { applyTheme, normalizeTheme } from "./theme";
import { normalizeQty } from "./utils";

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
  const storedPrintStep = localStorage.getItem("qtyStepPrint");
  const storedPrintedStep = localStorage.getItem("qtyStepPrinted");
  state.qtyStep = {
    print: Math.max(1, normalizeQty(storedPrintStep ?? 1, 1)),
    printed: Math.max(1, normalizeQty(storedPrintedStep ?? 1, 1))
  };
  state.settings = await api.getSettings();
  state.theme = normalizeTheme(state.settings.theme);
  applyTheme(state.theme);

  if (!state.settings.baseDir) {
    state.onboarding = true;
  } else {
    await refreshOrders();
  }

  attachGlobalHandlers(paint);
  paint();
}
