import { getPreviewData } from "./preview";
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

function renderPendingFiles() {
  if (!state.pendingFiles.length) {
    return `<div class="muted">未添加文件。</div>`;
  }

  return state.pendingFiles
    .map((file, index) => {
      const isFileSelected =
        state.selectedTarget?.kind === "pending-file" && state.selectedTarget.index === index;
      const isPreviewSelected =
        state.selectedTarget?.kind === "pending-preview" && state.selectedTarget.index === index;
      return `
        <div class="file-row ${isFileSelected ? "is-selected" : ""}" data-pending-index="${index}">
          <div class="preview-box ${isPreviewSelected ? "is-selected" : ""}" tabindex="0" data-role="pending-preview" data-index="${index}">
            ${
              file.previewDataUrl
                ? `<img class="preview-img" src="${escapeAttribute(file.previewDataUrl)}" />`
                : "粘贴图片"
            }
          </div>
          <div class="file-name" draggable="true" title="${escapeAttribute(file.name)}">${escapeHtml(
            file.name
          )}</div>
          <input class="file-note" placeholder="文件备注（可选）" value="${escapeAttribute(
            file.note
          )}" />
          <div class="qty-group"></div>
          <div class="qty-group"></div>
          <div class="file-actions">
            <button type="button" data-action="remove-pending">移除</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderOrderFiles(order: Order) {
  if (!order.files || order.files.length === 0) {
    return `<div class="muted">暂无文件。</div>`;
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
      return `
        <div class="file-row ${isFileSelected ? "is-selected" : ""}" data-file="${escapeAttribute(
          file.savedAs
        )}" draggable="true" data-drag="file">
          <div class="preview-box ${isPreviewSelected ? "is-selected" : ""}" tabindex="0" data-role="order-preview" ${
            previewKeyValue ? `data-preview-key="${escapeAttribute(previewKeyValue)}"` : ""
          }>
            ${
              previewData
                ? `<img class="preview-img" src="${escapeAttribute(previewData)}" />`
                : "粘贴图片"
            }
          </div>
          <div class="file-name" draggable="true" data-drag="file" title="${escapeAttribute(
            file.savedAs
          )}">${escapeHtml(file.savedAs)}</div>
          <input class="file-note" placeholder="文件备注（可选）" value="${escapeAttribute(
            file.note ?? ""
          )}" />
          <div class="qty-group">
            <div>打印数量</div>
            <div class="qty-controls">
              <button type="button" class="qty-button" data-qty-action="dec" data-qty-field="print">-</button>
              <input class="qty-input" type="number" min="0" data-qty-field="print" value="${printQty}" />
              <button type="button" class="qty-button" data-qty-action="inc" data-qty-field="print">+</button>
            </div>
          </div>
          <div class="qty-group">
            <div>已打印</div>
            <div class="qty-controls">
              <button type="button" class="qty-button" data-qty-action="dec" data-qty-field="printed">-</button>
              <input class="qty-input" type="number" min="0" data-qty-field="printed" value="${printedQty}" />
              <button type="button" class="qty-button" data-qty-action="inc" data-qty-field="printed">+</button>
            </div>
          </div>
          <div class="file-actions">
            <select data-action="file-action">
              <option value="">文件操作</option>
              <option value="open">打开所在目录</option>
              <option value="replace">替换文件</option>
              <option value="delete">删除文件</option>
            </select>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderOrders() {
  if (!state.orders.length) {
    return `<div class="muted">还没有订单。</div>`;
  }

  return state.orders
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((order) => {
      const isCollapsed =
        state.collapsedOrders.has(order.dirName) && state.editingOrderId !== order.dirName;
      const statusClass = statusClassName(order.status);
      return `
        <div class="item" data-id="${order.dirName}">
          <div class="item-header">
            <h3>${escapeHtml(order.title)} <span class="pill status-pill ${statusClass}">${escapeHtml(
              order.status
            )}</span></h3>
            <button type="button" data-action="toggle-collapse">${isCollapsed ? "展开" : "折叠"}</button>
          </div>
          ${
            isCollapsed
              ? ""
              : `
          <div>
            <div class="meta">
              <span class="pill">客户：${escapeHtml(order.customerName)}</span>
              <span class="pill">材料：${escapeHtml(order.material)}</span>
              <span class="pill">数量：${order.quantity}</span>
              ${order.dueDate ? `<span class="pill">交期：${escapeHtml(order.dueDate)}</span>` : ""}
              <span class="pill">创建：${escapeHtml(formatDate(order.createdAt))}</span>
              <span class="pill">编号：${order.datePrefix}-${String(order.orderNo).padStart(4, "0")}</span>
            </div>
            ${
              order.note
                ? `<div class="muted" style="margin-top:8px;">备注：${escapeHtml(order.note)}</div>`
                : ""
            }
            <div class="item-actions">
              <label>
                状态
                <select data-action="status">
                  ${renderStatusOptions(order.status)}
                </select>
              </label>
              <button type="button" data-action="toggle-edit">编辑订单</button>
            </div>
            ${
              state.editingOrderId === order.dirName
                ? `
                  <div class="edit-grid">
                    <label>
                      客户
                      <input data-edit-field="customerName" value="${escapeAttribute(
                        order.customerName
                      )}" />
                    </label>
                    <label>
                      材料
                      <input data-edit-field="material" value="${escapeAttribute(
                        order.material
                      )}" />
                    </label>
                    <label>
                      数量
                      <input data-edit-field="quantity" type="number" min="1" step="1" value="${order.quantity}" />
                    </label>
                    <div class="edit-actions">
                      <button type="button" data-action="save-order-edit">保存信息</button>
                    </div>
                  </div>
                `
                : ""
            }
            ${
              state.editingOrderId === order.dirName
                ? `<div class="item-actions">
                    <button type="button" data-action="copy-order">复制订单</button>
                    <button type="button" data-action="delete-order">删除订单</button>
                  </div>`
                : ""
            }
            <div class="card" style="margin-top:12px;">
              <div class="dropzone" data-drop="order">拖拽文件到这里，或点击选择文件</div>
              <label class="stretch-field" style="display:block;margin-top:8px;">
                目录备注
                <textarea class="folder-note" placeholder="例如：整单特殊说明">${escapeHtml(
                  order.folderNote ?? ""
                )}</textarea>
              </label>
              <label class="stretch-field" style="display:block;margin-top:8px;">
                发货信息
                <textarea class="shipping-info" placeholder="快递公司/单号/备注">${escapeHtml(
                  order.shippingInfo ?? ""
                )}</textarea>
              </label>
              <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" data-action="save-folder-note">保存目录备注</button>
              </div>
              <div class="file-list">
                ${renderOrderFiles(order)}
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

export function renderApp() {
  const hasBaseDir = Boolean(state.settings.baseDir);

  return `
    <div class="container">
      <header>
        <h1>3D 打印订单管理</h1>
        <div class="muted">订单目录：${hasBaseDir ? escapeHtml(state.settings.baseDir!) : "未设置"}</div>
      </header>

      <div class="tabs">
        <button class="tab ${state.activeTab === "add" ? "active" : ""}" data-tab="add">添加订单</button>
        <button class="tab ${state.activeTab === "manage" ? "active" : ""}" data-tab="manage">订单管理</button>
        <button class="tab ${state.activeTab === "settings" ? "active" : ""}" data-tab="settings">设置</button>
      </div>

      <section class="card" style="${state.activeTab === "add" ? "" : "display:none;"}">
        <form id="createForm">
          <label class="row-6">
            客户
            <input name="customerName" placeholder="例如：张三" required ${hasBaseDir ? "" : "disabled"} value="${escapeAttribute(
              state.draftOrder.customerName
            )}" />
          </label>
          <label class="row-6">
            订单标题
            <input name="title" placeholder="例如：无人机支架" required ${hasBaseDir ? "" : "disabled"} value="${escapeAttribute(
              state.draftOrder.title
            )}" />
          </label>
          <label class="row-4">
            材料
            <input name="material" placeholder="例如：PLA / PETG / 树脂" required ${hasBaseDir ? "" : "disabled"} value="${escapeAttribute(
              state.draftOrder.material
            )}" />
          </label>
          <label class="row-2">
            数量
            <input name="quantity" type="number" min="1" step="1" value="${state.draftOrder.quantity}" required ${hasBaseDir ? "" : "disabled"} />
          </label>
          <label class="row-3">
            交期（可选）
            <input name="dueDate" type="date" ${hasBaseDir ? "" : "disabled"} value="${escapeAttribute(
              state.draftOrder.dueDate
            )}" />
          </label>
          <label class="row-3">
            状态
            <select name="status" ${hasBaseDir ? "" : "disabled"}>
              ${renderStatusOptions(state.draftOrder.status)}
            </select>
          </label>
          <label class="row-12">
            备注（可选）
            <textarea name="note" placeholder="例如：需要打磨上色 / 加急" ${hasBaseDir ? "" : "disabled"}>${escapeHtml(
              state.draftOrder.note
            )}</textarea>
          </label>
          <label class="row-12">
            目录备注
            <textarea name="folderNote" placeholder="例如：整单特殊说明" ${hasBaseDir ? "" : "disabled"}>${escapeHtml(
              state.draftOrder.folderNote
            )}</textarea>
          </label>
          <div class="row-12" style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" id="resetBtn" ${hasBaseDir ? "" : "disabled"}>清空</button>
            <button class="primary" type="submit" ${hasBaseDir ? "" : "disabled"}>创建订单</button>
          </div>
        </form>

        <div style="margin-top:16px;">
          <h3 class="section-title">订单文件</h3>
          <div class="dropzone" data-drop="pending">拖拽文件到这里，或点击选择文件</div>
          <div class="file-list">
            ${renderPendingFiles()}
          </div>
        </div>
      </section>

      <section class="card" style="${state.activeTab === "manage" ? "" : "display:none;"}">
        <div class="list">
          ${renderOrders()}
        </div>
      </section>

      <section class="card" style="${state.activeTab === "settings" ? "" : "display:none;"}">
        <div class="muted" style="margin-bottom:12px;">首次使用需要设置订单根目录。</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <button type="button" id="chooseDirBtn">选择目录</button>
          ${
            hasBaseDir
              ? `<span class="muted">当前：${escapeHtml(state.settings.baseDir!)}</span>`
              : `<span class="muted">未设置</span>`
          }
        </div>
        <div style="margin-top:12px;max-width:320px;">
          <label>
            拖拽模式
            <select id="dragModeSelect">
              <option value="native" ${state.dragMode === "native" ? "selected" : ""}>系统拖拽（推荐）</option>
              <option value="download" ${state.dragMode === "download" ? "selected" : ""}>DownloadURL（兼容）</option>
            </select>
          </label>
          <div class="muted" style="margin-top:6px;">
            系统拖拽适配资源管理器与大多数切片软件，若不可用可切换兼容模式测试。
          </div>
        </div>
      </section>
    </div>
  `;
}
