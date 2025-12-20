## 目标

给个人小工作室使用的本地订单管理工具（可离线），支持基础的订单录入、状态流转、导出备份，后续可扩展到 SQLite 持久化与文件管理。

## 架构

- 桌面端：Electron（Windows）
- 前端：Vite + TypeScript（Vanilla）
- 数据：先用文件系统 + JSON；

## 前置

1) Node.js LTS（建议 20+）
2) Visual Studio Build Tools（勾选 C++ 桌面开发 / MSVC / Windows SDK）

## 运行命令

在项目根目录打开 PowerShell：
- 安装依赖：`npm install`
- 启动开发：`npm run electron:dev`
- 直接运行：`npm run electron`
- 打包便携版：`npm run pack`