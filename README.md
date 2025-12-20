# 3D打印订单管理

面向个人小工作室的本地订单管理工具，支持订单创建、文件管理与打印流程跟踪。数据仅保存在本机文件系统中，离线可用。

## 功能概览

- 订单创建与管理（状态、备注、交期等）
- 订单目录自动命名（含日期与编号）
- 文件拖入/拖出、文件备注、预览图粘贴
- 订单根目录与拖拽模式设置

## 技术栈

- Electron
- Vite + TypeScript（Vanilla）
- 本地文件系统 + JSON 持久化

## 目录结构

```
electron/     主进程与预加载
src/          渲染进程（UI 与交互）
docs/         需求与架构文档
```

## 开发运行

```bash
npm install
npm run electron:dev
```

直接运行（不启用 Vite Dev Server）：
```bash
npm run electron
```

## 文档

- `docs/requirements.md`：需求与范围
- `docs/architecture.md`：架构与关键实现

## 注意事项

- 打包产物位于 `release/`（建议保持在 `.gitignore` 中）
- 拖拽兼容性受系统与目标软件影响，可在设置页切换拖拽模式