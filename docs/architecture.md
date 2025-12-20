# 架构说明

本文档用于记录当前架构与关键实现点，后续功能更新请在此同步修改。

## 目标

本地单机桌面应用（Electron），面向个人小工作室，支持订单管理、文件管理、目录备注、文件备注与预览图。

## 技术选型

- 桌面端：Electron
- 前端：Vite + TypeScript（Vanilla）
- 数据持久化：文件系统（订单目录 + JSON）
- 开发脚本：`npm run electron:dev`

## 运行结构

- 主进程：`electron/main.cjs`
  - 负责窗口创建、文件系统读写、对话框、剪贴板读取
- 预加载：`electron/preload.cjs`
  - 通过 `contextBridge` 暴露安全 IPC API
- 渲染进程：`src/main.ts`
  - UI 渲染、交互、表单与拖拽逻辑

## 数据与目录结构

### 订单根目录
- 首次启动会弹窗选择根目录（持久化到 `settings.json`）
- 设置路径：`%APPDATA%/项目名/settings.json`（Electron `app.getPath("userData")`）

### 订单目录命名

格式：
```
YYMMDD_标题_客户_订单号
```

说明：
- `YYMMDD`：创建日期
- `订单号`：按时间顺序递增（4 位补零）
- 目录冲突会自动追加后缀

### 订单文件结构

```
订单目录/
  order.json
  模型文件1.stl
  模型文件2.step
  模型文件1.stl.preview.png
```

说明：
- `order.json`：订单主数据
- `*.preview.png`：文件预览图

## 主要数据结构（逻辑）

订单：
- `dirName`、`orderNo`、`datePrefix`
- 客户/标题/材料/数量/交期/状态/备注
- `folderNote`（目录备注）
- `files[]`（文件列表）

文件：
- `name` 原始文件名
- `savedAs` 复制到订单目录后的文件名
- `note` 文件备注
- `previewImage` 预览图文件名
- `addedAt` 添加时间

## IPC 交互（主进程能力）

渲染进程通过 `window.electronAPI` 调用：
- 设置/目录
  - `getSettings`
  - `chooseBaseDir`
  - `setBaseDir`
- 订单
  - `listOrders`
  - `createOrder`
  - `updateOrder`
  - `updateOrderNote`
- 文件
  - `selectFiles`
  - `addFiles`
  - `replaceFile`
  - `deleteFile`
  - `updateFileNote`
  - `savePreviewImage`
  - `getClipboardImage`

## 页面与交互

- 添加订单页
  - 表单录入 + 文件拖入
  - 创建订单时自动复制文件并写入 `order.json`
- 订单管理页
  - 文件拖入追加
  - 下拉操作：替换/删除
  - 目录备注与文件备注编辑
  - 文件可拖出到切片软件（拖出文件路径）
- 设置页
  - 修改订单根目录

## 拖拽策略

- `native`：调用 `startDrag` 启动系统拖拽
- `download`：使用 `DownloadURL` 兼容部分软件
- 可在设置页切换拖拽模式

## 关键约束

- 仅本地单机，不涉及网络服务
- 文件操作统一在主进程执行
- 预览图来源于剪贴板图片（粘贴到预览框）