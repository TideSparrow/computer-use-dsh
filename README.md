<div align="center">

# 🖥 Computer Use for DSH

**类似 OpenAI Codex computer use 的桌面自动化插件 · DeepSeek Harness Desktop Automation Agent Plugin**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-black?logo=apple)](https://github.com/TideSparrow/computer-use-dsh)
[![Platform: Linux](https://img.shields.io/badge/platform-Linux-yellow?logo=linux)](https://github.com/TideSparrow/computer-use-dsh)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows)](https://github.com/TideSparrow/computer-use-dsh)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-plugin-8A2BE2)](https://github.com/deepseek-ai/DeepSeek-Harness)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/TideSparrow/computer-use-dsh/pulls)

</div>

一个类似 **OpenAI Codex computer use** 的桌面自动化插件，让运行在
[DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)（DSH）中的 AI Agent / LLM Agent
能够**截屏看屏幕 → 移动鼠标 / 点击 / 滚动 → 键入文本 / 按键 → 打开应用**，
在 **macOS / Linux / Windows** 三端实现真正的 "computer use" 循环。

> **Keywords**: computer use · computer-use agent · deepseek harness · dsh · cordis · desktop automation · gui automation · screenshot · mouse control · xdotool · CGEvent · PowerShell · cross-platform

- **零第三方运行时依赖（Windows / macOS）**：Windows 用系统自带 PowerShell + .NET，
  macOS 用系统自带 `screencapture` + 一段首次使用时用 `swiftc` 编译的 CGEvent helper。
- **Linux 依赖 xdotool**（X11）与任一截屏工具（grim / scrot / ImageMagick）。
- **自带屏幕监控面板**：插件运行后，DSH 会话的 run 卡片内会渲染实时屏幕面板，
  可点击截图上的任意位置来点击桌面，支持 Live 自动刷新。
- **Retina / DPI 坐标自动换算**：截屏返回像素尺寸 + 屏幕点尺寸，鼠标操作自动换算，
  高分屏下依旧精确。

---

## ✨ 功能一览

| 工具名 | 说明 |
|---|---|
| `computer_screenshot` | 截屏（主屏 / 指定显示器 / 指定区域），以**图片内容块**返回给模型 |
| `computer_click` | 移动鼠标并点击（左 / 右 / 中键，支持双击） |
| `computer_move` | 只移动鼠标，不点击 |
| `computer_scroll` | 移动到指定点并滚动滚轮（支持横向） |
| `computer_type` | 向当前聚焦的输入框键入文本（支持 Unicode / 中文） |
| `computer_key` | 按键 / 组合键，如 `key:"c", modifiers:["cmd"]` |
| `computer_open` | 打开 / 激活 App、打开文件路径或 URL |

### 客户端面板（run 卡片内）

- 实时显示最近一次截屏
- 点击截图上的任意点 = 在该位置点击桌面
- 📷 Capture、Refresh、Live 自动刷新
- 内联显示权限 / 依赖缺失提示

---

## 🖥 支持平台

| 平台 | 支持 | 截屏方案 | 鼠标/键盘方案 | 额外依赖 |
|---|---|---|---|---|
| **macOS 13+**（Apple Silicon / Intel） | ✅ 完整支持 | 系统 `screencapture` | Swift CGEvent helper（自动编译） | Xcode Command Line Tools（`swiftc`） |
| **Linux（X11）** | ✅ 支持 | grim / scrot / ImageMagick `import`（自动探测） | `xdotool` | `xdotool` + 任一截屏工具 |
| **Windows 10 / 11** | ✅ 支持 | PowerShell + System.Drawing（`CopyFromScreen`） | PowerShell + user32 P/Invoke + SendKeys | 无（系统自带） |
| **Linux（Wayland）** | ⚠️ 受限 | grim 可用 | 需要 `wtype`（仅输入）或 `ydotool`；点击/移动受限 | 视桌面环境而定 |
| **DSH 运行形态** | 支持 | Host（Node.js 进程）+ Client（Web GUI 面板） | | |

> 一句话：**插件控制的是运行 DSH 的那台电脑**，浏览器只是监控面板的载体。

---

## 📦 安装

### 1. 前置条件（按平台）

**macOS**
```bash
xcode-select --install   # 提供 swiftc，首次使用会自动编译 helper
swiftc --version
```

**Linux（X11）**
```bash
# Debian/Ubuntu
sudo apt install xdotool grim          # 或 scrot / imagemagick 二选一
# 也可用 scrot 或 imagemagick 代替 grim：
sudo apt install xdotool scrot
```

**Windows** — 无需安装任何东西（PowerShell 5.1+ 系统自带）。

### 2. 一次性授权（macOS）/ 依赖检查（Linux）

**macOS**（系统设置 › 隐私与安全性）
1. **屏幕录制**：勾选运行 DSH 的 App（Terminal / iTerm / VS Code 等）。
   > 不授权时截屏报 `could not create image from display`。
2. **辅助功能**：勾选同一 App。
   > 不授权时鼠标 / 键盘事件被拒（helper 输出 `ACCESSIBILITY_NOT_TRUSTED`）。

**Linux** — 确保 `xdotool` 与截屏工具已安装；确认当前是 X11 会话
（`echo $XDG_SESSION_TYPE` 应输出 `x11`）。Wayland 下受限，见平台表。

**Windows** — 无系统权限要求；若 DPI 缩放非 100%，建议在应用属性中关闭
"高 DPI 缩放替代"以保证坐标精确。

### 3. 构建（可选，仅修改源码时需要）

```bash
npm install   # 仅需要 node，无第三方依赖
npm run build # 或 node build.mjs
```

构建产物（已提交，开箱即用）：
- `dist/plugin.host.js` — Host 半部（已内嵌三个平台的原生 helper 源码）
- `dist/plugin.client.js` — Client 半部
- `dist/plugin.json` — Host + Client 打包（供脚本化安装）

### 4. 安装插件（二选一）

#### 方式 A：让 DSH 智能体加载（推荐）

把 `dist/plugin.json` 的内容（或直接指向这两个文件）交给 DSH 会话中的智能体，并说：

> 请用 cordis_define 创建这个 computer-use 插件（idPrefix 用 compu），host 代码取
> dist/plugin.host.js 的内容，client 代码取 dist/plugin.client.js 的内容，然后运行它。

智能体会替你完成 `cordis_define` → `cordis_run`，你在弹窗中批准即可。

#### 方式 B：手动定义

在能看到 Cordis 工具的会话中：

1. `cordis_define`：`plugin.kind = "new"`、`idPrefix = "compu"`，
   `code.host` = `dist/plugin.host.js` 的内容，`code.client` = `dist/plugin.client.js` 的内容，
   `name` 填 `Computer Use for DSH`。
2. `cordis_run`：用返回的 `pluginId` / `packageId`，`mode = "run"`，在 UI 中批准。

> 提示：插件会把原生 helper 写入临时目录缓存（macOS `/tmp/dsh-computer-use`，
> Windows `%TEMP%\dsh-computer-use`）；DSH 进程重启后重新运行一次插件即可，
> helper 无需重新编译。

---

## 🚀 使用示例

安装并授权后，在 DSH 会话里对智能体说（建议使用支持图片输入的视觉模型）：

```text
帮我在电脑上打开浏览器，搜索 "DeepSeek"，把第一个结果截图给我看。
```

智能体会自动执行：`computer_open` → `computer_screenshot` 看屏幕 →
`computer_click` 点地址栏 → `computer_type` 输入关键词 → `computer_key` 按回车 →
`computer_screenshot` 截图回传。

也可以在 run 卡片的实时面板里手动点截图，直接指挥鼠标。

---

## 🧩 工作原理

```
┌─────────────────────────── DSH ───────────────────────────┐
│  Host（Node.js 进程）                                      │
│  ├─ computer_* 工具（模型可调用）                          │
│  │    ├─ macOS:  screencapture + Swift CGEvent helper      │
│  │    ├─ Linux:  grim/scrot/import + xdotool               │
│  │    └─ Windows: PowerShell + System.Drawing + user32     │
│  │    └─ 图片经 attachments 服务以 image 内容块返回模型     │
│  ├─ RPC: status / latest / capture / click                 │
│  └─ Client（Web GUI）→ tool.view.cordis 面板（实时屏幕）     │
└───────────────────────────────────────────────────────────┘
```

- **坐标体系**：所有鼠标操作使用"最近一次截屏的图像像素坐标"；插件内部按
  `pixel/point` 比例换算为系统屏幕坐标（macOS Retina 2x、Windows DPI 缩放均自动处理，
  区域截图带偏移）。
- **平台探测**：运行时用 `uname` / `cmd /c ver` 自动识别操作系统，并按平台分派到对应
  的原生 helper；helper 源码在构建时内嵌进 `dist/plugin.host.js`（`node build.mjs` 重新生成）。

---

## 📁 项目结构

```
computer-use-dsh/
├── README.md               # 本文档
├── package.json
├── build.mjs               # 把 native/ 源码内嵌进 src/host.js，产出 dist/
├── src/
│   ├── host.js             # Host 半部（平台探测 + 工具 + RPC，含 __*_SOURCE__ 占位符）
│   └── client.js           # Client 半部（实时屏幕面板）
├── native/
│   ├── macos-helper.swift  # macOS CGEvent helper
│   ├── linux-helper.sh     # Linux 截屏 + xdotool 输入
│   └── windows-helper.ps1  # Windows 截屏 + user32 输入
└── dist/                   # 构建产物（提交，开箱即用）
    ├── plugin.host.js
    ├── plugin.client.js
    └── plugin.json
```

---

## 🔒 安全与隐私

- 插件**只能控制运行 DSH 的那台电脑**，且受系统权限保护（macOS TCC：屏幕录制 / 辅助功能；
  Linux 受 X11 会话权限限制；Windows 无额外权限但受当前用户会话限制）。
- 截图临时存放在系统临时目录，仅用于回传模型与面板展示。
- 所有工具为独占执行（不同时并发操作桌面），避免鼠标 / 键盘事件竞争。

---

## 📄 License

[MIT](./LICENSE) — 自由使用、修改、分发。

---

## ⭐ 支持项目

觉得有用的话，欢迎给个 Star ⭐ —— 你的支持是我持续维护的动力！

<div align="center">

**[⬆ 返回顶部](#computer-use-for-dsh) · [GitHub 仓库](https://github.com/TideSparrow/computer-use-dsh)**

</div>
