# GitX - 桌面应用

一个简洁实用的 Git 图形客户端，基于 Electron 开发。

## ✨ 特性

### 核心功能
- ✅ 查看工作区状态和文件变更
- ✅ Stage 文件和提交代码
- ✅ 浏览提交历史
- ✅ 查看和切换分支
- ✅ Push、Pull 远程操作
- ✅ **Diff 文件对比查看器** 🆕
- ✅ **创建新分支** 🆕
- ✅ **分支合并（Merge）** 🆕
- ✅ **Stash 管理** 🆕

### 用户体验
- ✅ 深色主题界面
- ✅ **快捷键支持（Ctrl+O, Ctrl+R, F5, Ctrl+Enter）** 🆕
- ✅ **暂存区 / 工作区分区、Unstage、全部 Stage/Unstage** 🆕 v1.2
- ✅ **Fetch 与 ahead/behind 显示** 🆕 v1.2
- ✅ **合并冲突文件列表** 🆕 v1.2
- ✅ **提交详情、refs、相对时间** 🆕 v1.2
- ✅ **标签管理（创建/删除/推送）** 🆕 v1.3
- ✅ **Cherry-pick、Rebase、删除分支** 🆕 v1.3
- ✅ **克隆远程仓库、最近打开列表** 🆕 v1.3
- ✅ **变基/Cherry-pick/合并 继续·跳过·中止** 🆕 v1.4
- ✅ **冲突「标记已解决」、远程分支列表** 🆕 v1.4
- ✅ **浅色/深色主题切换** 🆕 v1.4
- ✅ **收藏仓库、Git 用户配置、提交搜索** 🆕 v1.5
- ✅ **Cherry-pick 跳过、冲突文件高亮、在编辑器中打开** 🆕 v1.5
- ✅ **全局 Git 配置、多仓库切换、提交对比** 🆕 v1.6
- ✅ **冲突三路预览、子模块管理** 🆕 v1.6
- ✅ 模态对话框交互
- ✅ 分割视图布局
- ✅ 跨平台桌面应用

## 🚀 快速开始

### 1. 运行应用（开发模式）

双击 `start.bat`，或命令行：

```bash
npm start
```

### 2. 打包绿色版（免安装）

双击 `pack-auto.bat`

生成位置：`portable/GitX/GitX.exe`

### 3. 打包 Windows 安装包

双击 `pack-installer-win.bat`（或 `打包安装包-Windows.bat`）

详见 [BUILD-INSTALL.md](BUILD-INSTALL.md)

### 4. 打包 macOS 安装包

在 Mac 上执行：

```bash
nvm use 22
npm run pack:mac
```

生成位置：`dist/GitX-版本号-架构.dmg` 和 `dist/GitX-版本号-架构-mac.zip`

## 📁 项目结构

```
git-client-app/
├── main.js
├── preload.js
├── index.html
├── style.css
├── renderer.js
├── package.json
├── start.bat                 # 运行应用
├── pack-auto.bat             # 绿色版
├── pack-installer-win.bat    # Windows 安装包
├── scripts/pack-mac.sh       # macOS 安装包
├── README.md
├── BUILD-INSTALL.md
├── ARCHITECTURE.md
└── portable/GitX/            # 绿色版输出
```

## 🎯 使用方法

1. **打开仓库**
   - 点击"打开仓库"按钮
   - 选择一个 Git 仓库文件夹

2. **查看变更**
   - 自动显示所有未提交的文件
   - 点击 "Stage" 添加到暂存区

3. **提交代码**
   - 输入提交信息
   - 点击"提交"按钮

4. **管理分支**
   - 切换到"分支"视图
   - 点击"切换"按钮切换分支

5. **同步代码**
   - 点击 "Pull" 拉取
   - 点击 "Push" 推送

## 💻 环境要求

- Windows 10/11
- Node.js 已安装（开发需要）
- Git 已安装（使用需要）

## 🔧 开发

### 安装依赖

```bash
npm install
```

已安装的依赖：
- electron@28.3.3
- simple-git@3.21.0
- electron-builder@24.13.3

### 运行

```bash
npm start
```

### 打包

| 类型 | 方式 |
|------|------|
| 绿色版 | `pack-auto.bat` |
| Windows 安装包 | `pack-installer-win.bat` 或 `npm run dist:win` |
| macOS 安装包 | 在 Mac 上 `npm run pack:mac`（见 BUILD-INSTALL.md） |

## 📦 分发

- **绿色版**：复制 `portable/GitX/` 文件夹，运行 `GitX.exe`
- **安装包**：Windows 分发 `dist/GitX Setup x.x.x.exe`；macOS 分发 `dist/GitX-x.x.x-*.dmg`

## 🎨 界面预览

```
┌──────────────────────────────────────┐
│ GitX          🌿 main        [关闭]   │
├──────┬───────────────────────────────┤
│ 📝 变更│ 工作区变更                    │
│ 📊 历史│ M  src/main.js    [Stage]    │
│ 🌿 分支│ ?  new-file.txt   [Stage]    │
│      │                               │
│ [⬇️Pull]│ [提交信息输入框]             │
│ [⬆️Push]│ [💾 提交]                    │
│ [🔄刷新]│                              │
└──────┴───────────────────────────────┘
```

## 🛠️ 技术栈

- **Electron** 28.3.3 - 桌面应用框架
- **simple-git** 3.21.0 - Git 命令封装
- **HTML/CSS/JavaScript** - 原生 Web 技术

## ❓ 常见问题

**Q: 杀毒软件报警？**  
A: 因为没有数字签名，添加到白名单即可

**Q: 可以在其他电脑运行吗？**  
A: 可以，复制整个 GitX 绿色版文件夹即可

**Q: 绿色版和安装版有什么区别？**  
A: 功能完全相同，绿色版更方便，无需安装

**Q: 文件大小为什么这么大？**  
A: 包含了 Chromium 和 Node.js 运行时，约 250MB 是正常的

## 📝 待办功能

### 下一版本
- [ ] 冲突解决工具（三路合并 UI）

### 未来计划
- [ ] Git Flow 工作流
- [ ] 内置可编辑三路合并
- [ ] 多窗口并行

## 📄 许可证

MIT License

---

**现在就开始使用吧！** 🎉

双击 `start.bat` 运行，或 `pack-auto.bat` / `pack-installer-win.bat` 打包
