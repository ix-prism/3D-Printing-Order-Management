import { getPreviewData } from "./preview";
import { renderNav } from "./nav";
import { THEME_OPTIONS } from "./theme";
import { state } from "./state";
import {
  escapeAttribute,
  escapeHtml,
  formatDate,
  normalizeQty,
  previewDomKey,
  renderStatusOptions,
  statusClassName
} from "./utils";

type SearchTracker = { targetSet: boolean };

function toAssetList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function renderAssetItems(
  items: string[],
  kind: "customer" | "material",
  options?: { showCheckbox?: boolean; selected?: Set<string>; showActions?: boolean }
) {
  const emptyLabel =
    kind === "customer" ? "\u6682\u65e0\u5ba2\u6237\u3002" : "\u6682\u65e0\u6750\u6599\u3002";
  if (!items.length) {
    return `<div class="muted">${emptyLabel}</div>`;
  }
  const showCheckbox = options?.showCheckbox ?? false;
  const selected = options?.selected ?? new Set<string>();
  const showActions = options?.showActions ?? true;
  return items
    .map(
      (item) => {
        const isSelected = selected.has(item);
        const checkbox = showCheckbox
          ? `<label class="asset-select"><input type="checkbox" data-asset-select data-asset-kind="${kind}" data-asset-value="${escapeAttribute(
              item
            )}" ${isSelected ? "checked" : ""} /></label>`
          : "";
        const actionButton = showActions
          ? `<button type="button" data-action="delete-${kind}" data-value="${escapeAttribute(
              item
            )}">\u5220\u9664</button>`
          : "";
        return `
        <div class="asset-item">
          <div class="asset-main">
            ${checkbox}
            <span>${escapeHtml(item)}</span>
          </div>
          ${actionButton}
        </div>
      `;
      }
    )
    .join("");
}

function renderThemeOptions(selected: ThemeId) {
  return THEME_OPTIONS.map((option) => {
    const isSelected = option.id === selected ? "selected" : "";
    return `<option value="${option.id}" ${isSelected}>${escapeHtml(option.label)}</option>`;
  }).join("");
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  if (!query) return escapeHtml(text);
  const regex = new RegExp(escapeRegex(query), "ig");
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    result += `<mark class="search-hit">${escapeHtml(match[0])}</mark>`;
    lastIndex = match.index + match[0].length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

function matchesQuery(value: string | undefined, queryLower: string) {
  if (!queryLower) return false;
  return String(value ?? "").toLowerCase().includes(queryLower);
}

function renderPendingFiles() {
  if (!state.pendingFiles.length) {
    return `<div class="muted">\u672a\u6dfb\u52a0\u6587\u4ef6\u3002</div>`;
  }

  return state.pendingFiles
    .map((file, index) => {
      const isFileSelected =
        state.selectedTarget?.kind === "pending-file" && state.selectedTarget.index === index;
      const isPreviewSelected =
        state.selectedTarget?.kind === "pending-preview" && state.selectedTarget.index === index;
      const printQty = normalizeQty(file.printQty, 1);
      return `
        <div class="file-row is-pending ${isFileSelected ? "is-selected" : ""}" data-pending-index="${index}">
          <div class="preview-box ${isPreviewSelected ? "is-selected" : ""}" tabindex="0" data-role="pending-preview" data-index="${index}">
            ${
              file.previewDataUrl
                ? `<img class="preview-img" src="${escapeAttribute(file.previewDataUrl)}" />`
                : "\u7c98\u8d34\u56fe\u7247"
            }
          </div>
          <div class="file-name" title="${escapeAttribute(file.name)}">${escapeHtml(file.name)}</div>
          <textarea class="file-note" rows="1" placeholder="\u6587\u4ef6\u5907\u6ce8\uff08\u53ef\u9009\uff09">${escapeHtml(
            file.note
          )}</textarea>
          <div class="qty-group">
            <div>\u6253\u5370\u6570\u91cf</div>
            <div class="qty-controls">
              <button type="button" class="qty-button pending-qty-button" data-qty-action="dec">-</button>
              <input class="qty-input pending-qty-input" type="number" min="1" value="${printQty}" />
              <button type="button" class="qty-button pending-qty-button" data-qty-action="inc">+</button>
            </div>
          </div>
          <div class="file-actions">
            <button type="button" data-action="remove-pending">\u79fb\u9664</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderOrderFiles(order: Order, query: string, queryLower: string, tracker: SearchTracker) {
  if (!order.files || order.files.length === 0) {
    return `<div class="muted">\u6682\u65e0\u6587\u4ef6\u3002</div>`;
  }

  return order.files
    .map((file) => {
      const isFileSelected =
        state.selectedTarget?.kind === "order-file" &&
        state.selectedTarget.dirName === order.dirName &&
        state.selectedTarget.savedAs === file.savedAs;
      const isPreviewSelected =
        state.selectedTarget?.kind === "order-preview" &&
        state.selectedTarget.dirName === order.dirName &&
        state.selectedTarget.savedAs === file.savedAs;
      const previewData = getPreviewData(order.dirName, file.previewImage);
      const previewKeyValue = file.previewImage
        ? previewDomKey(order.dirName, file.previewImage)
        : "";
      const printQty = normalizeQty(file.printQty, 1);
      const printedQty = normalizeQty(file.printedQty, 0);
      const nameMatch = queryLower ? matchesQuery(file.savedAs, queryLower) : false;
      const noteMatch = queryLower ? matchesQuery(file.note ?? "", queryLower) : false;
      const rowMatch = nameMatch || noteMatch;
      let searchTarget = "";
      if (rowMatch && !tracker.targetSet) {
        searchTarget = 'data-search-target="true"';
        tracker.targetSet = true;
      }
      const nameHtml = query ? highlightText(file.savedAs, query) : escapeHtml(file.savedAs);
      return `
        <div class="file-row ${rowMatch ? "search-hit-row" : ""} ${
          isFileSelected ? "is-selected" : ""
        }" data-file="${escapeAttribute(file.savedAs)}" draggable="true" data-drag="file" ${searchTarget}>
          <div class="preview-box ${isPreviewSelected ? "is-selected" : ""}" tabindex="0" data-role="order-preview" ${
            previewKeyValue ? `data-preview-key="${escapeAttribute(previewKeyValue)}"` : ""
          }>
            ${
              previewData
                ? `<img class="preview-img" src="${escapeAttribute(previewData)}" />`
                : "\u7c98\u8d34\u56fe\u7247"
            }
          </div>
          <div class="file-name ${nameMatch ? "search-hit-field" : ""}" draggable="true" data-drag="file" title="${escapeAttribute(
            file.savedAs
          )}">${nameHtml}</div>
          <textarea class="file-note ${noteMatch ? "search-hit-field" : ""}" rows="1" placeholder="\u6587\u4ef6\u5907\u6ce8\uff08\u53ef\u9009\uff09">${escapeHtml(
            file.note ?? ""
          )}</textarea>
          <div class="qty-stack">
            <div class="qty-row">
              <span class="qty-label">\u6253\u5370\u6570\u91cf</span>
              <div class="qty-controls">
                <button type="button" class="qty-button" data-qty-action="dec" data-qty-field="print">-</button>
                <input class="qty-input" type="number" min="0" data-qty-field="print" value="${printQty}" />
                <button type="button" class="qty-button" data-qty-action="inc" data-qty-field="print">+</button>
              <input class="qty-step" type="number" min="1" value="${state.qtyStep.print}" data-qty-step="print" title="\u6b65\u8fdb" />
              </div>
            </div>
            <div class="qty-row">
              <span class="qty-label">\u5df2\u6253\u5370</span>
              <div class="qty-controls">
                <button type="button" class="qty-button" data-qty-action="dec" data-qty-field="printed">-</button>
                <input class="qty-input" type="number" min="0" data-qty-field="printed" value="${printedQty}" />
                <button type="button" class="qty-button" data-qty-action="inc" data-qty-field="printed">+</button>
              <input class="qty-step" type="number" min="1" value="${state.qtyStep.printed}" data-qty-step="printed" title="\u6b65\u8fdb" />
              </div>
            </div>
          </div>
          <div class="file-actions">
            <select data-action="file-action">
              <option value="">\u6587\u4ef6\u64cd\u4f5c</option>
              <option value="open">\u6253\u5f00\u6240\u5728\u76ee\u5f55</option>
              <option value="bambu-connect">\u5bfc\u5165\u5230 Bambu Connect</option>
              <option value="replace">\u66ff\u6362\u6587\u4ef6</option>
              <option value="delete">\u5220\u9664\u6587\u4ef6</option>
            </select>
          </div>
        </div>
      `;
    })
    .join("");
}

function orderMatchesQuery(order: Order, queryLower: string) {
  if (!queryLower) return true;
  const orderNoLabel = `${order.datePrefix}-${String(order.orderNo).padStart(4, "0")}`;
  if (
    matchesQuery(order.title, queryLower) ||
    matchesQuery(order.customerName, queryLower) ||
    matchesQuery(order.material, queryLower) ||
    matchesQuery(String(order.quantity), queryLower) ||
    matchesQuery(order.status, queryLower) ||
    matchesQuery(order.note ?? "", queryLower) ||
    matchesQuery(order.folderNote ?? "", queryLower) ||
    matchesQuery(order.shippingInfo ?? "", queryLower) ||
    matchesQuery(order.dueDate ?? "", queryLower) ||
    matchesQuery(formatDate(order.createdAt), queryLower) ||
    matchesQuery(orderNoLabel, queryLower)
  ) {
    return true;
  }
  return (order.files ?? []).some(
    (file) => matchesQuery(file.savedAs, queryLower) || matchesQuery(file.note ?? "", queryLower)
  );
}

function renderOrders() {
  if (!state.orders.length) {
    return `<div class="muted">\u8fd8\u6ca1\u6709\u8ba2\u5355\u3002</div>`;
  }

  const query = state.searchQuery.trim();
  const queryLower = query.toLowerCase();
  const orders = [...state.orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((order) => (queryLower ? orderMatchesQuery(order, queryLower) : true));
  if (queryLower && orders.length === 0) {
    return `<div class="muted">\u672a\u627e\u5230\u5339\u914d\u7ed3\u679c\u3002</div>`;
  }

  const tracker: SearchTracker = { targetSet: false };

  return orders
    .map((order) => {
      const orderNoLabel = `${order.datePrefix}-${String(order.orderNo).padStart(4, "0")}`;
      const orderMetaMatch = queryLower
        ? matchesQuery(order.title, queryLower) ||
          matchesQuery(order.customerName, queryLower) ||
          matchesQuery(order.material, queryLower) ||
          matchesQuery(String(order.quantity), queryLower) ||
          matchesQuery(order.status, queryLower) ||
          matchesQuery(order.note ?? "", queryLower) ||
          matchesQuery(order.folderNote ?? "", queryLower) ||
          matchesQuery(order.shippingInfo ?? "", queryLower) ||
          matchesQuery(order.dueDate ?? "", queryLower) ||
          matchesQuery(formatDate(order.createdAt), queryLower) ||
          matchesQuery(orderNoLabel, queryLower)
        : false;
      const isCollapsed =
        !queryLower &&
        state.collapsedOrders.has(order.dirName) &&
        state.editingOrderId !== order.dirName;
      const statusClass = statusClassName(order.status);
      const isSelected = state.selectedOrderIds.has(order.dirName);
      const orderSelect = state.manageEditMode
        ? `<label class="item-select"><input type="checkbox" data-order-select="${escapeAttribute(
            order.dirName
          )}" ${isSelected ? "checked" : ""} /></label>`
        : "";
      let searchTarget = "";
      if (orderMetaMatch && !tracker.targetSet) {
        searchTarget = 'data-search-target="true"';
        tracker.targetSet = true;
      }
      const highlight = (value: string) =>
        query ? highlightText(value, query) : escapeHtml(value);
      const folderNoteMatch = queryLower
        ? matchesQuery(order.folderNote ?? "", queryLower)
        : false;
      const shippingMatch = queryLower
        ? matchesQuery(order.shippingInfo ?? "", queryLower)
        : false;
      const headerMeta = `
        <div class="meta meta-inline">
          <span class="pill">\u5ba2\u6237\uff1a${highlight(order.customerName)}</span>
          <span class="pill">\u6750\u6599\uff1a${highlight(order.material)}</span>
          <span class="pill">\u6570\u91cf\uff1a${highlight(String(order.quantity))}</span>
          ${
            order.dueDate
              ? `<span class="pill">\u4ea4\u671f\uff1a${highlight(order.dueDate)}</span>`
              : ""
          }
          <span class="pill">\u521b\u5efa\uff1a${highlight(formatDate(order.createdAt))}</span>
          <span class="pill">\u7f16\u53f7\uff1a${highlight(orderNoLabel)}</span>
        </div>
      `;
      return `
        <div class="item ${orderMetaMatch ? "search-hit-row" : ""}" data-id="${
          order.dirName
        }" ${searchTarget}>
          <div class="item-header">
            <div class="item-header-left">
              ${orderSelect}
              <div class="item-header-main">
                <h3>${highlight(order.title)} <span class="pill status-pill ${statusClass}">${highlight(
        order.status
      )}</span></h3>
                ${headerMeta}
              </div>
            </div>
            <button type="button" data-action="toggle-collapse">${
              isCollapsed ? "\u5c55\u5f00" : "\u6298\u53e0"
            }</button>
          </div>
          ${
            isCollapsed
              ? ""
              : `
          <div>
            ${
              order.note
                ? `<div class="muted" style="margin-top:8px;">\u5907\u6ce8\uff1a${highlight(
                    order.note
                  )}</div>`
                : ""
            }
            <div class="item-actions">
              <label>
                \u72b6\u6001
                <select data-action="status">
                  ${renderStatusOptions(order.status)}
                </select>
              </label>
              <button type="button" data-action="toggle-edit">\u7f16\u8f91\u8ba2\u5355</button>
            </div>
            ${
              state.editingOrderId === order.dirName
                ? `
                  <div class="edit-grid">
                    <label>
                      \u5ba2\u6237
                      <input data-edit-field="customerName" value="${escapeAttribute(
                        order.customerName
                      )}" />
                    </label>
                    <label>
                      \u6750\u6599
                      <input data-edit-field="material" value="${escapeAttribute(
                        order.material
                      )}" />
                    </label>
                    <label>
                      \u6570\u91cf
                      <input data-edit-field="quantity" type="number" min="1" step="1" value="${
                        order.quantity
                      }" />
                    </label>
                    <div class="edit-actions">
                      <button type="button" data-action="save-order-edit">\u4fdd\u5b58\u4fe1\u606f</button>
                    </div>
                  </div>
                `
                : ""
            }
            ${
              state.editingOrderId === order.dirName
                ? `<div class="item-actions">
                    <button type="button" data-action="copy-order">\u590d\u5236\u8ba2\u5355</button>
                    <button type="button" data-action="delete-order">\u5220\u9664\u8ba2\u5355</button>
                  </div>`
                : ""
            }
            <div class="card" style="margin-top:12px;">
              <div class="dropzone" data-drop="order">\u62d6\u62fd\u6587\u4ef6\u5230\u8fd9\u91cc\uff0c\u6216\u70b9\u51fb\u9009\u62e9\u6587\u4ef6</div>
              <label class="stretch-field" style="display:block;margin-top:8px;">
                \u76ee\u5f55\u5907\u6ce8
                <textarea class="folder-note ${folderNoteMatch ? "search-hit-field" : ""}" placeholder="\u4f8b\u5982\uff1a\u6574\u5355\u7279\u6b8a\u8bf4\u660e">${escapeHtml(
                  order.folderNote ?? ""
                )}</textarea>
              </label>
              <label class="stretch-field" style="display:block;margin-top:8px;">
                \u53d1\u8d27\u4fe1\u606f
                <textarea class="shipping-info ${shippingMatch ? "search-hit-field" : ""}" placeholder="\u5feb\u9012\u516c\u53f8\u5355\u53f7/\u5907\u6ce8">${escapeHtml(
                  order.shippingInfo ?? ""
                )}</textarea>
              </label>
              <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" data-action="save-folder-note">\u4fdd\u5b58\u76ee\u5f55\u5907\u6ce8</button>
              </div>
              <div class="file-list">
                ${renderOrderFiles(order, query, queryLower, tracker)}
              </div>
            </div>
          </div>
          `
          }
        </div>
      `;
    })
    .join("");
}

function renderAddOrder() {
  const hasBaseDir = Boolean(state.settings.baseDir);
  const disabledAttr = hasBaseDir ? "" : "disabled";
  const customers = toAssetList(state.settings.customers);
  const materials = toAssetList(state.settings.materials);
  return `
      <section class="card" style="${state.activeTab === "add" ? "" : "display:none;"}">
        <form id="createForm">
          <label class="row-6">
            \u5ba2\u6237
            <input name="customerName" list="customerOptions" placeholder="\u4f8b\u5982\uff1a\u5f20\u4e09" required ${disabledAttr} value="${escapeAttribute(
    state.draftOrder.customerName
  )}" />
          </label>
          <label class="row-6">
            \u8ba2\u5355\u6807\u9898
            <input name="title" placeholder="\u4f8b\u5982\uff1a\u65e0\u4eba\u673a\u652f\u67b6" required ${disabledAttr} value="${escapeAttribute(
    state.draftOrder.title
  )}" />
          </label>
          <label class="row-4">
            \u6750\u6599
            <input name="material" list="materialOptions" placeholder="\u4f8b\u5982\uff1aPLA / PETG / \u6811\u8102" required ${disabledAttr} value="${escapeAttribute(
    state.draftOrder.material
  )}" />
          </label>
          <label class="row-2">
            \u6570\u91cf
            <input name="quantity" type="number" min="1" step="1" value="${
              state.draftOrder.quantity
            }" required ${disabledAttr} />
          </label>
          <label class="row-3">
            \u4ea4\u671f\uff08\u53ef\u9009\uff09
            <input name="dueDate" type="date" ${disabledAttr} value="${escapeAttribute(
    state.draftOrder.dueDate
  )}" />
          </label>
          <label class="row-3">
            \u72b6\u6001
            <select name="status" ${disabledAttr}>
              ${renderStatusOptions(state.draftOrder.status)}
            </select>
          </label>
          <label class="row-12">
            \u5907\u6ce8\uff08\u53ef\u9009\uff09
            <textarea name="note" placeholder="\u4f8b\u5982\uff1a\u9700\u8981\u6253\u78e8\u4e0a\u8272/\u52a0\u6025" ${disabledAttr}>${escapeHtml(
              state.draftOrder.note
            )}</textarea>
          </label>
          <label class="row-12">
            \u76ee\u5f55\u5907\u6ce8
            <textarea name="folderNote" placeholder="\u4f8b\u5982\uff1a\u6574\u5355\u7279\u6b8a\u8bf4\u660e" ${disabledAttr}>${escapeHtml(
              state.draftOrder.folderNote
            )}</textarea>
          </label>
          <div class="row-12" style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" id="resetBtn" ${disabledAttr}>\u6e05\u7a7a</button>
            <button class="primary" type="submit" ${disabledAttr}>\u521b\u5efa\u8ba2\u5355</button>
          </div>
        </form>
        <datalist id="customerOptions">
          ${customers.map((item) => `<option value="${escapeAttribute(item)}"></option>`).join("")}
        </datalist>
        <datalist id="materialOptions">
          ${materials.map((item) => `<option value="${escapeAttribute(item)}"></option>`).join("")}
        </datalist>

        <div style="margin-top:16px;">
          <h3 class="section-title">\u8ba2\u5355\u6587\u4ef6</h3>
          <div class="dropzone" data-drop="pending">\u62d6\u62fd\u6587\u4ef6\u5230\u8fd9\u91cc\uff0c\u6216\u70b9\u51fb\u9009\u62e9\u6587\u4ef6</div>
          <div class="file-list">
            ${renderPendingFiles()}
          </div>
        </div>
      </section>
  `;
}

function renderManage() {
  const query = state.searchQuery.trim();
  const isEditMode = state.manageEditMode;
  const selectedCount = state.selectedOrderIds.size;
  return `
      <section class="card" style="${state.activeTab === "manage" ? "" : "display:none;"}">
        <div class="search-toolbar">
          <label class="search-field" for="orderSearch">
            <span class="search-icon" aria-hidden="true">&#128269;</span>
            <span class="sr-only">\u641c\u7d22</span>
            <input id="orderSearch" type="search" placeholder="\u641c\u7d22\u8ba2\u5355\u3001\u6587\u4ef6\u3001\u5907\u6ce8" value="${escapeAttribute(
              state.searchQuery
            )}" />
          </label>
          <div class="search-actions">
            ${query ? `<button type="button" id="clearSearch">\u6e05\u9664</button>` : ""}
            <button type="button" id="refreshOrders">\u5237\u65b0</button>
            <button type="button" id="toggleOrderEdit">${isEditMode ? "\u5b8c\u6210" : "\u7f16\u8f91"}</button>
            ${
              isEditMode
                ? `<button type="button" id="selectAllOrders">\u5168\u9009</button>
                   <button type="button" id="deleteSelectedOrders" ${
                     selectedCount > 0 ? "" : "disabled"
                   }>\u5220\u9664</button>`
                : ""
            }
          </div>
        </div>
        <div class="list">
          ${renderOrders()}
        </div>
      </section>
  `;
}

function renderAssets() {
  const customers = toAssetList(state.settings.customers);
  const materials = toAssetList(state.settings.materials);
  const isEditMode = state.assetEditMode;
  const selectedCount = state.selectedCustomers.size + state.selectedMaterials.size;
  return `
      <section class="card" style="${state.activeTab === "assets" ? "" : "display:none;"}">
        <div class="search-toolbar">
          <div class="section-title">\u8d44\u4ea7\u7ba1\u7406</div>
          <div class="search-actions">
            <button type="button" id="toggleAssetEdit">${isEditMode ? "\u5b8c\u6210" : "\u7f16\u8f91"}</button>
            ${
              isEditMode
                ? `<button type="button" id="selectAllAssets">\u5168\u9009</button>
                   <button type="button" id="deleteSelectedAssets" ${
                     selectedCount > 0 ? "" : "disabled"
                   }>\u5220\u9664</button>`
                : ""
            }
          </div>
        </div>
        <h3 class="section-title">\u5ba2\u6237\u7ba1\u7406</h3>
        <form class="asset-form" data-asset="customer">
          <input placeholder="\u6dfb\u52a0\u5ba2\u6237" />
          <button type="submit">\u6dfb\u52a0</button>
        </form>
        <div class="asset-list">
          ${renderAssetItems(customers, "customer", {
            showCheckbox: isEditMode,
            selected: state.selectedCustomers,
            showActions: !isEditMode
          })}
        </div>
        <div style="height:16px;"></div>
        <h3 class="section-title">\u6750\u6599\u7ba1\u7406</h3>
        <form class="asset-form" data-asset="material">
          <input placeholder="\u6dfb\u52a0\u6750\u6599" />
          <button type="submit">\u6dfb\u52a0</button>
        </form>
        <div class="asset-list">
          ${renderAssetItems(materials, "material", {
            showCheckbox: isEditMode,
            selected: state.selectedMaterials,
            showActions: !isEditMode
          })}
        </div>
      </section>
  `;
}

function renderSettings() {
  const hasBaseDir = Boolean(state.settings.baseDir);
  const baseDirLabel = hasBaseDir
    ? escapeHtml(state.settings.baseDir ?? "")
    : "\u672a\u8bbe\u7f6e";
  return `
      <section class="card" style="${state.activeTab === "settings" ? "" : "display:none;"}">
        <div class="muted" style="margin-bottom:12px;">\u9996\u6b21\u4f7f\u7528\u9700\u8981\u8bbe\u7f6e\u8ba2\u5355\u6839\u76ee\u5f55\u3002</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <button type="button" id="chooseDirBtn">\u9009\u62e9\u76ee\u5f55</button>
          <span class="muted">\u5f53\u524d\uff1a${baseDirLabel}</span>
        </div>
        <div style="margin-top:12px;max-width:360px;">
          <label>
            \u62d6\u62fd\u6a21\u5f0f
            <select id="dragModeSelect">
              <option value="native" ${
                state.dragMode === "native" ? "selected" : ""
              }>\u7cfb\u7edf\u62d6\u62fd\uff08\u63a8\u8350\uff09</option>
              <option value="download" ${
                state.dragMode === "download" ? "selected" : ""
              }>DownloadURL\uff08\u517c\u5bb9\uff09</option>
            </select>
          </label>
          <div class="muted" style="margin-top:6px;">
            \u7cfb\u7edf\u62d6\u62fd\u9002\u914d\u8d44\u6e90\u7ba1\u7406\u5668\u4e0e\u5927\u591a\u6570\u5207\u7247\u8f6f\u4ef6\uff0c\u82e5\u4e0d\u53ef\u7528\u53ef\u5207\u6362\u517c\u5bb9\u6a21\u5f0f\u6d4b\u8bd5\u3002
          </div>
        </div>
        <div style="margin-top:16px;max-width:360px;">
          <label>
            \u4e3b\u9898
            <select id="themeSelect">
              ${renderThemeOptions(state.theme)}
            </select>
          </label>
          <div class="muted" style="margin-top:6px;">
            \u7cfb\u7edf\u9ed8\u8ba4\u66f4\u7701\u8d44\u6e90\uff0c\u8d28\u611f\u4e3b\u9898\u66f4\u6709\u5c42\u6b21\u3002
          </div>
        </div>
      </section>
  `;
}

function renderOnboarding() {
  const hasBaseDir = Boolean(state.settings.baseDir);
  const baseDirLabel = hasBaseDir
    ? escapeHtml(state.settings.baseDir ?? "")
    : "\u672a\u8bbe\u7f6e";
  return `
    <div class="init-screen">
      <div class="card init-panel">
        <div class="init-header">
          <div class="brand-mark">PO</div>
          <div>
            <h1>\u6b22\u8fce\u4f7f\u7528 PrintOrder</h1>
            <p class="muted">\u8bf7\u5148\u9009\u62e9\u8ba2\u5355\u6839\u76ee\u5f55\uff0c\u4e4b\u540e\u53ef\u5728\u8bbe\u7f6e\u4e2d\u4fee\u6539\u3002</p>
          </div>
        </div>
        <div class="init-body">
          <label>
            \u8ba2\u5355\u76ee\u5f55
            <div class="init-dir-row">
              <button type="button" id="initChooseDirBtn">\u9009\u62e9\u76ee\u5f55</button>
              <span class="muted">\u5f53\u524d\uff1a${baseDirLabel}</span>
            </div>
          </label>
          <div class="init-actions">
            <button type="button" id="initContinueBtn" ${hasBaseDir ? "" : "disabled"}>\u8fdb\u5165\u5e94\u7528</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderApp() {
  if (state.onboarding) {
    return `<div class="app-shell">${renderOnboarding()}</div>`;
  }
  return `
    <div class="app-shell">
      ${renderNav({ activeTab: state.activeTab, baseDir: state.settings.baseDir })}
      <main class="container">
        ${renderAddOrder()}
        ${renderManage()}
        ${renderAssets()}
        ${renderSettings()}
      </main>
    </div>
  `;
}
