## 目标

给个人小工作室使用的本地订单管理工具（可离线），支持基础的订单录入/状态流转/导出备份，后续可扩展为 SQLite 持久化与文件管理。

## 技术选型（落地优先）

- 桌面端：Tauri（Windows）
- 前端：Vite + TypeScript（Vanilla）
- 数据：先用浏览器本地存储（localStorage）跑通流程；后续升级为 SQLite（更稳、易备份）

## 本地开发前置（需要你电脑安装）

1) Node.js LTS（建议 20+）
2) Rust（rustup 安装）
3) Visual Studio Build Tools（勾选 C++ 桌面开发 / MSVC / Windows SDK）
4) WebView2 Runtime（Win10/11 一般自带）

> 注意：Tauri/Rust 在“中文路径/网络盘/UNC 路径”下可能会踩坑；如果遇到编译问题，建议把项目复制到纯英文本地目录，例如 `C:\\dev\\3d-order-manager` 再试。

## 运行命令

在项目根目录打开 PowerShell：

- 安装依赖：`npm install`
- 启动开发：`npm run tauri:dev`
- 打包发布：`npm run tauri:build`
