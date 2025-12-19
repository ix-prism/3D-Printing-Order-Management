import "./style.css";

type OrderStatus = "新建" | "打印中" | "后处理" | "已完成" | "已取消";

type Order = {
  id: string;
  customerName: string;
  title: string;
  material: string;
  quantity: number;
  dueDate?: string;
  status: OrderStatus;
  note?: string;
  createdAt: string;
};

const STORAGE_KEY = "orders.v1";

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadOrders(): Order[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOrders(orders: Order[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

let orders: Order[] = loadOrders();

function render() {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  root.innerHTML = `
    <div class="container">
      <header>
        <h1>3D 打印订单管理</h1>
        <div class="muted">本地存储（可后续换 SQLite）</div>
      </header>

      <section class="card">
        <form id="createForm">
          <label class="row-6">
            客户
            <input name="customerName" placeholder="例如：张三" required />
          </label>
          <label class="row-6">
            订单标题
            <input name="title" placeholder="例如：无人机支架" required />
          </label>
          <label class="row-4">
            材料
            <input name="material" placeholder="例如：PLA / PETG / 树脂" required />
          </label>
          <label class="row-2">
            数量
            <input name="quantity" type="number" min="1" step="1" value="1" required />
          </label>
          <label class="row-3">
            交期（可选）
            <input name="dueDate" type="date" />
          </label>
          <label class="row-3">
            状态
            <select name="status">
              <option>新建</option>
              <option>打印中</option>
              <option>后处理</option>
              <option>已完成</option>
              <option>已取消</option>
            </select>
          </label>
          <label class="row-12">
            备注（可选）
            <textarea name="note" placeholder="例如：需要打磨上色 / 加急"></textarea>
          </label>
          <div class="row-12" style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" id="resetBtn">清空</button>
            <button class="primary" type="submit">添加订单</button>
          </div>
        </form>
      </section>

      <div class="toolbar">
        <div class="muted">共 ${orders.length} 条</div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button type="button" id="exportBtn">导出 JSON</button>
          <button type="button" id="clearAllBtn">清空全部</button>
        </div>
      </div>

      <section class="list" id="list"></section>
    </div>
  `;

  const list = root.querySelector<HTMLDivElement>("#list");
  if (!list) return;

  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  list.innerHTML =
    sorted
      .map(
        (o) => `
          <div class="item" data-id="${o.id}">
            <div>
              <h3>${escapeHtml(o.title)} <span class="pill">${escapeHtml(o.status)}</span></h3>
              <div class="meta">
                <span class="pill">客户：${escapeHtml(o.customerName)}</span>
                <span class="pill">材料：${escapeHtml(o.material)}</span>
                <span class="pill">数量：${o.quantity}</span>
                ${o.dueDate ? `<span class="pill">交期：${escapeHtml(o.dueDate)}</span>` : ""}
                <span class="pill">创建：${escapeHtml(formatDate(o.createdAt))}</span>
              </div>
              ${o.note ? `<div class="muted" style="margin-top:8px;">备注：${escapeHtml(o.note)}</div>` : ""}
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              <button type="button" data-action="next">下一状态</button>
              <button type="button" data-action="delete">删除</button>
            </div>
          </div>
        `
      )
      .join("") || `<div class="muted">还没有订单，先添加一条试试。</div>`;

  root.querySelector<HTMLFormElement>("#createForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);

    const quantity = Number(data.get("quantity"));
    if (!Number.isFinite(quantity) || quantity < 1) return;

    const order: Order = {
      id: uid(),
      customerName: String(data.get("customerName") ?? "").trim(),
      title: String(data.get("title") ?? "").trim(),
      material: String(data.get("material") ?? "").trim(),
      quantity,
      dueDate: String(data.get("dueDate") ?? "").trim() || undefined,
      status: (String(data.get("status") ?? "新建") as OrderStatus) ?? "新建",
      note: String(data.get("note") ?? "").trim() || undefined,
      createdAt: new Date().toISOString()
    };

    orders.unshift(order);
    saveOrders(orders);
    form.reset();
    (form.querySelector<HTMLInputElement>('input[name="quantity"]')!).value = "1";
    render();
  });

  root.querySelector<HTMLButtonElement>("#resetBtn")?.addEventListener("click", () => {
    root.querySelector<HTMLFormElement>("#createForm")?.reset();
    const q = root.querySelector<HTMLInputElement>('input[name="quantity"]');
    if (q) q.value = "1";
  });

  root.querySelector<HTMLButtonElement>("#exportBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(orders, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  root.querySelector<HTMLButtonElement>("#clearAllBtn")?.addEventListener("click", () => {
    if (!confirm("确定要清空全部订单吗？")) return;
    orders = [];
    saveOrders(orders);
    render();
  });

  list.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const action = target.getAttribute("data-action");
    if (!action) return;
    const item = target.closest<HTMLElement>("[data-id]");
    const id = item?.getAttribute("data-id");
    if (!id) return;

    if (action === "delete") {
      orders = orders.filter((o) => o.id !== id);
      saveOrders(orders);
      render();
      return;
    }
    if (action === "next") {
      const index = orders.findIndex((o) => o.id === id);
      if (index < 0) return;
      orders[index] = { ...orders[index], status: nextStatus(orders[index].status) };
      saveOrders(orders);
      render();
    }
  });
}

function nextStatus(s: OrderStatus): OrderStatus {
  const flow: OrderStatus[] = ["新建", "打印中", "后处理", "已完成"];
  if (s === "已取消") return "已取消";
  const i = flow.indexOf(s);
  if (i < 0) return "新建";
  return flow[Math.min(i + 1, flow.length - 1)];
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
