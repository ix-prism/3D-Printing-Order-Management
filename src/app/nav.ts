import { escapeHtml } from "./utils";

type NavState = {
  activeTab: "add" | "manage" | "assets" | "settings";
  baseDir?: string;
};

export function renderNav({ activeTab, baseDir }: NavState) {
  const hasBaseDir = Boolean(baseDir);
  const baseLabel = hasBaseDir ? escapeHtml(baseDir ?? "") : "\u672a\u8bbe\u7f6e";
  return `
    <nav class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <div class="brand-mark">PO</div>
          <div class="brand-text">
            <div class="brand-title">PrintOrder</div>
            <div class="brand-sub">\u8ba2\u5355\u76ee\u5f55: ${baseLabel}</div>
          </div>
        </div>
        <div class="tabs nav-tabs">
          <button class="tab ${activeTab === "add" ? "active" : ""}" data-tab="add">\u6dfb\u52a0\u8ba2\u5355</button>
          <button class="tab ${activeTab === "manage" ? "active" : ""}" data-tab="manage">\u8ba2\u5355\u7ba1\u7406</button>
          <button class="tab ${activeTab === "assets" ? "active" : ""}" data-tab="assets">\u8d44\u4ea7\u7ba1\u7406</button>
          <button class="tab ${activeTab === "settings" ? "active" : ""}" data-tab="settings">\u8bbe\u7f6e</button>
        </div>
      </div>
    </nav>
  `;
}
