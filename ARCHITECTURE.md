# Git Client - 技术架构与功能清单

## 项目概述

一个使用 Electron + JavaScript 构建的现代化 Git 图形客户端，目标是复刻 SmartGit 的核心功能。

## 技术栈

### 核心技术
- **Electron** 28.3.3 - 跨平台桌面框架
- **simple-git** 3.21.0 - Git 命令封装库
- **HTML5 + CSS3 + JavaScript** - 原生 Web 技术
- **Node.js** - 后端运行时

### 开发工具
- **electron-builder** 24.13.3 - 应用打包工具
- **npm** - 包管理工具

## 项目结构

```
git-client-app/
├── main.js              # Electron 主进程
│   ├── 窗口管理
│   ├── IPC 通信处理
│   ├── Git 命令执行
│   └── 文件系统操作
│
├── preload.js           # 预加载脚本
│   ├── contextBridge API 暴露
│   └── 安全的 IPC 通信桥接
│
├── index.html           # 应用界面
│   ├── 欢迎页面
│   ├── 主界面布局
│   │   ├── 顶部菜单栏
│   │   ├── 侧边导航栏
│   │   ├── 主工作区
│   │   └── 底部状态栏
│   └── 各视图容器
│
├── style.css            # 样式文件
│   ├── 深色主题
│   ├── Git 状态颜色
│   ├── 布局样式
│   └── 组件样式
│
├── renderer.js          # 渲染进程逻辑
│   ├── UI 交互处理
│   ├── Git API 调用
│   ├── 视图渲染
│   └── 事件监听
│
└── package.json         # 项目配置
    ├── 依赖声明
    ├── 启动脚本
    └── 打包配置
```

## 核心功能清单

### ✅ 已实现功能（v1.1.0）

#### 1. 仓库管理
- **打开仓库** - 通过文件选择器打开本地 Git 仓库
- **仓库信息显示** - 显示当前仓库名称和路径
- **当前分支显示** - 实时显示当前所在分支

#### 2. 文件变更管理
- **工作区状态查看** - 实时显示所有未提交的文件
- **文件状态标识**
  - `M` - 已修改（Modified）- 🟡 黄色
  - `A` - 新增（Added）- 🟢 绿色
  - `D` - 删除（Deleted）- 🔴 红色
  - `?` - 未跟踪（Untracked）- ⚪ 灰色
- **Stage 操作** - 将文件添加到暂存区
- **暂存区查看** - 查看已暂存的文件列表

#### 3. 提交功能
- **提交消息输入** - 多行文本输入框
- **提交操作** - 一键提交所有暂存的文件
- **提交后自动刷新** - 自动更新文件状态

#### 4. 提交历史
- **历史记录浏览** - 显示最近 50 条提交
- **提交信息展示**
  - Commit Hash（短格式）
  - 提交消息
  - 作者信息
  - 提交时间（相对时间）
- **提交详情查看** - 点击查看完整提交信息
- **分支标签显示** - 显示关联的分支和标签

#### 5. 分支管理
- **分支列表** - 显示所有本地分支
- **当前分支标识** - 高亮显示当前分支
- **切换分支** - 一键切换到其他分支
- **分支信息** - 显示分支的最新提交 hash

#### 6. 远程操作
- **Pull 操作** - 拉取远程最新代码
- **Push 操作** - 推送本地提交到远程
- **Fetch 按钮** - 获取远程更新（占位）

#### 7. 用户界面
- **深色主题** - 类似 VSCode 的深色配色
- **响应式布局** - 灵活的三栏布局
- **实时状态提示** - 底部状态栏显示操作状态
- **图标和表情符号** - 友好的视觉提示
- **悬停效果** - 按钮和列表项悬停反馈

#### 8. Diff 查看器 🆕
- **文件差异对比** - 点击文件查看详细 diff
- **语法高亮** - 区分添加、删除、上下文行
- **颜色标识** - 绿色（新增）、红色（删除）
- **分割视图** - 左侧文件列表，右侧 diff 显示
- **智能检测** - 自动区分工作区和暂存区差异

#### 9. 高级分支操作 🆕
- **创建新分支** - 从当前 HEAD 创建并切换
- **分支名称验证** - 格式检查和错误提示
- **分支合并** - Merge 操作
- **冲突提示** - 合并失败时的友好提示

#### 10. Stash 管理 🆕
- **保存更改** - 临时保存工作区内容
- **Stash 列表** - 查看所有保存的 Stash
- **应用 Stash** - 恢复之前保存的更改
- **删除 Stash** - 移除不需要的 Stash
- **描述信息** - 为每个 Stash 添加说明

#### 11. 快捷键支持 🆕
- **Ctrl+O** - 打开仓库
- **Ctrl+R / F5** - 刷新状态
- **Ctrl+Enter** - 快速提交
- **Escape** - 关闭对话框或 Diff 查看器

### 📋 待实现功能

#### 高级功能
- [x] **Diff 查看器** ✅
  - [x] 统一差异视图
  - [x] 语法高亮
  - [ ] 并排对比视图
  - [ ] 行内对比

- [x] **创建新分支** ✅
  - [x] 从当前提交创建
  - [x] 分支命名验证
  - [ ] 从远程分支创建

- [x] **分支合并** ✅
  - [x] Merge 合并
  - [ ] Rebase 变基
  - [ ] Fast-forward 选项

- [ ] **冲突解决**
  - 冲突文件列表
  - 三路合并视图
  - 逐块解决
  - 标记为已解决

- [x] **Stash 管理** ✅
  - [x] 创建 Stash
  - [x] 查看 Stash 列表
  - [x] 应用 Stash
  - [x] 删除 Stash

- [ ] **标签管理**
  - 创建标签
  - 查看标签列表
  - 删除标签
  - 推送标签

- [ ] **Cherry-pick**
  - 选择提交
  - 应用到当前分支

- [ ] **子模块支持**
  - 初始化子模块
  - 更新子模块
  - 递归操作

- [ ] **多仓库管理**
  - 最近打开列表
  - 收藏仓库
  - 快速切换

#### 用户体验
- [x] **快捷键支持** ✅
  - [x] Ctrl+O 打开仓库
  - [x] Ctrl+R 刷新
  - [x] Ctrl+Enter 提交
  - [x] F5 刷新
  - [x] Escape 关闭
  - [ ] 自定义快捷键

- [ ] **主题系统**
  - 浅色主题
  - 深色主题
  - 自定义配色

- [ ] **用户设置**
  - Git 用户名/邮箱
  - 默认编辑器
  - 提交消息模板
  - UI 偏好设置

- [ ] **搜索功能**
  - 搜索提交
  - 搜索文件
  - 正则表达式支持

## 技术架构

### Electron 架构

```
┌─────────────────────────────────────┐
│   Main Process (main.js)            │  ← Node.js 环境
│   - 窗口管理                         │
│   - 文件系统访问                     │
│   - Git 命令执行                     │
│   - IPC 通信处理                     │
└─────────────────┬───────────────────┘
                  │ IPC
                  │ (contextBridge)
┌─────────────────▼───────────────────┐
│   Preload Script (preload.js)       │  ← 隔离层
│   - 暴露安全 API                     │
│   - 类型检查                         │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│   Renderer Process                  │  ← Chromium 浏览器
│   - index.html (界面结构)            │
│   - style.css (样式)                 │
│   - renderer.js (交互逻辑)           │
└─────────────────────────────────────┘
```

### Git 操作流程

```
用户点击按钮
    ↓
renderer.js 调用 window.gitAPI.xxx()
    ↓
preload.js 通过 ipcRenderer.invoke()
    ↓
main.js IPC 处理器接收请求
    ↓
simple-git 执行 Git 命令
    ↓
返回结果给 renderer
    ↓
更新 UI 显示
```

### IPC 通信接口

```javascript
// 文件系统
window.gitAPI.selectDirectory()

// Git 操作
window.gitAPI.getStatus(repoPath)
window.gitAPI.getLog(repoPath)
window.gitAPI.addFiles(repoPath, files)
window.gitAPI.commit(repoPath, message)
window.gitAPI.push(repoPath)
window.gitAPI.pull(repoPath)
window.gitAPI.getBranches(repoPath)
window.gitAPI.checkout(repoPath, branch)
```

## 数据结构

### Git Status
```javascript
{
  current: "main",           // 当前分支
  tracking: "origin/main",   // 跟踪的远程分支
  ahead: 0,                  // 领先提交数
  behind: 0,                 // 落后提交数
  files: [                   // 文件列表
    {
      path: "src/main.js",
      working_dir: "M",      // 工作区状态
      index: " "             // 暂存区状态
    }
  ],
  isClean: false            // 是否干净
}
```

### Commit
```javascript
{
  hash: "1a2b3c4d...",       // 完整 hash
  message: "feat: add ...",  // 提交消息
  author: "Developer",       // 作者
  date: "2024-01-01",       // 日期
  refs: ["HEAD", "main"]    // 引用标签
}
```

### Branch
```javascript
{
  name: "main",             // 分支名
  current: true,            // 是否当前分支
  commit: "1a2b3c4d..."     // 最新提交
}
```

## 性能优化

### 已实现
- **按需加载** - 只加载可见的提交记录
- **操作缓存** - 减少重复的 Git 命令
- **异步操作** - 所有 Git 操作异步执行
- **状态更新** - 只在必要时刷新状态

### 待优化
- **虚拟滚动** - 大量提交记录的虚拟化
- **增量更新** - 只更新变化的部分
- **Web Worker** - 将数据处理移到 Worker
- **缓存策略** - 智能的数据缓存

## 打包和分发

### 绿色版（当前方式）
- **打包方式** - 手动复制文件
- **优点**
  - ✅ 无需管理员权限
  - ✅ 打包速度快（1分钟）
  - ✅ 可以直接运行
  - ✅ 方便分享
- **文件大小** - 约 250 MB
- **使用方式** - 解压后双击 .exe

### 安装程序（未来）
- **打包方式** - electron-builder + NSIS
- **优点**
  - ✅ 标准的 Windows 安装程序
  - ✅ 可选安装路径
  - ✅ 创建快捷方式
  - ✅ 可从控制面板卸载
- **问题** - 需要管理员权限创建符号链接
- **解决方案** - 以管理员身份运行或使用代码签名

## 安全考虑

### 已实现
- ✅ **Context Isolation** - 渲染进程隔离
- ✅ **contextBridge** - 安全的 API 暴露
- ✅ **禁用 Node Integration** - 渲染进程无直接 Node 访问
- ✅ **IPC 验证** - 参数类型检查

### 建议增强
- [ ] 路径遍历防护
- [ ] 命令注入防护
- [ ] 凭证加密存储
- [ ] CSP 安全策略

## 开发路线图

### Phase 1: 核心功能 ✅ (已完成)
- ✅ 项目架构搭建
- ✅ Electron 集成
- ✅ Git 命令封装
- ✅ 基础 UI 布局
- ✅ 仓库管理
- ✅ 文件变更查看
- ✅ 提交功能
- ✅ 提交历史
- ✅ 分支管理
- ✅ 远程操作

### Phase 2: 高级功能 (计划中)
- [ ] Diff 查看器
- [ ] 创建/合并分支
- [ ] 冲突解决
- [ ] Stash 管理
- [ ] 标签管理

### Phase 3: 用户体验 (未来)
- [ ] 快捷键
- [ ] 主题系统
- [ ] 用户设置
- [ ] 搜索功能
- [ ] 多仓库管理

### Phase 4: 优化和完善 (未来)
- [ ] 性能优化
- [ ] 大仓库支持
- [ ] 代码签名
- [ ] 自动更新
- [ ] 多语言支持

## 与 SmartGit 对比

| 功能 | SmartGit | 本项目 | 优先级 |
|------|----------|--------|--------|
| 打开仓库 | ✅ | ✅ | - |
| 查看变更 | ✅ | ✅ | - |
| 提交代码 | ✅ | ✅ | - |
| 提交历史 | ✅ | ✅ | - |
| 分支管理 | ✅ | ✅ 基础 | 中 |
| Diff 查看 | ✅ | ❌ | 高 |
| 冲突解决 | ✅ | ❌ | 高 |
| Merge/Rebase | ✅ | ❌ | 中 |
| Stash | ✅ | ❌ | 低 |
| 子模块 | ✅ | ❌ | 低 |
| Push/Pull | ✅ | ✅ | - |
| 标签管理 | ✅ | ❌ | 低 |
| 价格 | 💰 收费 | 🆓 免费 | - |
| 开源 | ❌ | ✅ | - |
| 可定制 | 有限 | ✅ 完全 | - |

## 贡献指南

### 添加新功能

1. **在 main.js 中添加 IPC 处理器**
```javascript
ipcMain.handle('git-new-feature', async (event, repoPath, ...args) => {
  const git = simpleGit(repoPath)
  const result = await git.someOperation()
  return result
})
```

2. **在 preload.js 中暴露 API**
```javascript
contextBridge.exposeInMainWorld('gitAPI', {
  newFeature: (repoPath, ...args) => 
    ipcRenderer.invoke('git-new-feature', repoPath, ...args)
})
```

3. **在 renderer.js 中调用**
```javascript
async function handleNewFeature() {
  const result = await window.gitAPI.newFeature(currentRepoPath, ...)
  // 更新 UI
}
```

4. **在 index.html 中添加 UI**
```html
<button onclick="handleNewFeature()">新功能</button>
```

### 代码规范

- 使用 ES6+ 语法
- 函数使用 async/await
- 错误使用 try/catch 处理
- 注释说明复杂逻辑

## 常见问题

### 开发相关

**Q: 如何调试？**  
A: 在 main.js 中取消注释 `mainWindow.webContents.openDevTools()`

**Q: 如何测试 Git 操作？**  
A: 创建一个测试仓库，或使用现有项目测试

**Q: 如何添加新的 Git 命令？**  
A: 查看 simple-git 文档，在 main.js 中添加相应处理

### 打包相关

**Q: 为什么打包这么大？**  
A: 包含了 Chromium 和 Node.js，这是 Electron 的正常大小

**Q: 如何减小体积？**  
A: 可以使用 ASAR 压缩，移除不必要的依赖

**Q: 为什么需要管理员权限？**  
A: electron-builder 的代码签名工具需要创建符号链接

**Q: 如何避免管理员权限？**  
A: 使用当前的手动打包方式，或禁用代码签名

## 技术债务

### 当前限制
- 只支持本地仓库（不支持克隆远程仓库）
- 只显示最近 50 条提交
- 没有 Diff 查看器
- 没有冲突解决工具
- 没有持久化配置

### 改进计划
- 添加仓库克隆功能
- 实现虚拟滚动显示更多提交
- 集成 Monaco Editor 作为 Diff 查看器
- 添加冲突标记和解决界面
- 使用 localStorage 或配置文件存储设置

## 参考资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [simple-git 文档](https://github.com/steveukx/git-js)
- [Git 官方文档](https://git-scm.com/doc)
- [Electron Builder 文档](https://www.electron.build/)

---

**文档版本**: 1.0  
**最后更新**: 2024  
**项目状态**: ✅ 核心功能完成，可用于日常 Git 操作
