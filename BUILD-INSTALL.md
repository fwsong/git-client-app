# GitX 安装包打包指南（Windows / macOS）

使用 [electron-builder](https://www.electron.build/) 生成可安装的安装包。

## 前置条件

1. 已安装 [Node.js](https://nodejs.org/)（建议 LTS 18+）
2. 本机已安装 **Git**（GitX 运行时会调用系统 `git` 命令）
3. 在项目根目录执行过：

```bash
npm install
```

---

## 重要说明：平台不能随意交叉打包

| 目标安装包 | 建议在哪台机器上执行 |
|-----------|---------------------|
| Windows（`.exe` 安装程序） | **Windows** |
| macOS（`.dmg` / `.zip`） | **macOS** |

在 Windows 上一般**无法**直接打出 macOS 的 `.dmg`；在 Mac 上打 Windows 包也受限。  
若需要双平台发布，常见做法是：

- 各平台各打一次，或
- 使用 GitHub Actions 等 CI（Windows runner + macOS runner）

---

## 一、Windows 安装包（NSIS）

在项目根目录打开终端（PowerShell / CMD）：

```bash
npm run dist:win
```

或双击：`打包安装包-Windows.bat`

### 输出位置

```
dist/
├── GitX Setup 1.7.0.exe    ← 安装程序（发给用户）
└── win-unpacked/           ← 免安装目录版（调试用）
```

### 安装程序特性

- 可选安装目录
- 可创建桌面 / 开始菜单快捷方式
- 支持卸载（控制面板 / 设置 → 应用）

### 若打包失败

1. 关闭正在运行的 GitX / electron 进程  
2. 删除 `dist` 文件夹后重试  
3. 先 `taskkill /F /IM GitX.exe`（如有）  
4. 仍失败时执行：`npm install` 后重试  

**若报错「Cannot create symbolic link / 客户端没有所需的特权」**（winCodeSign 解压失败）：

- 本项目已关闭可执行文件签名（`signAndEditExecutable: false`），一般可避免该问题  
- 或：Windows **设置 → 系统 → 开发人员选项 → 开发人员模式** 打开后再打包  
- 或以**管理员身份**打开终端执行 `npm run dist:win`（不推荐日常开发使用）  

---

## 二、macOS 安装包（DMG + ZIP）

**必须在 Mac 上**打开终端，进入项目目录：

```bash
npm install
npm run dist:mac
```

### 输出位置

```
dist/
├── GitX-1.7.0.dmg          ← 常见分发格式（拖到「应用程序」）
├── GitX-1.7.0-mac.zip      ← 压缩包形式
└── mac/                    ← 未打包的 .app（调试用）
```

### 首次在 Mac 上打开

未签名的应用可能被 Gatekeeper 拦截，用户可：

- 右键 `.app` → **打开** → 确认打开，或  
- 系统设置 → 隐私与安全性 → 仍要打开  

若要上架 / 广泛分发，需要 Apple 开发者账号做 **代码签名** 与 **公证（notarization）**（本仓库默认未配置签名）。

---

## 三、一条命令（仅当前系统）

```bash
npm run dist
```

在 Windows 上只会打 Windows 包；在 Mac 上只会打 Mac 包。

---

## 四、与绿色版（portable）的区别

| 方式 | 脚本 | 产物 | 用途 |
|------|------|------|------|
| **安装包** | `npm run dist:win` / `dist:mac` | `.exe` 安装程序 / `.dmg` | 正式发给用户安装 |
| **绿色版** | `pack-auto.bat` | `portable/GitX/GitX.exe` | 免安装、U 盘拷贝、本机快速测试 |

两者可并存：安装包给正式用户，绿色版给自己或内网调试。

---

## 五、版本号

修改 `package.json` 里的 `"version"` 后重新打包，安装包文件名会随之变化（如 `GitX Setup 1.7.0.exe`）。

---

## 六、可选：应用图标

将图标放入 `build/` 目录可在安装包中显示自定义图标：

- Windows：`build/icon.ico`（须为正方形；宽图用 `scripts\build-icon.bat` 从 `build\icon-source.png` 生成）
- macOS：`build/icon.icns`

未放置时使用 Electron 默认图标。
