const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const simpleGit = require('simple-git')

let mainWindow
let activeRepoWatch = null

/** 工作区 / Git 索引变更时通知渲染进程（类似 SmartGit 自动刷新） */
function shouldRefreshForWatchPath(relPath) {
  if (relPath == null || relPath === '') return true
  const p = String(relPath).replace(/\\/g, '/')
  if (p.startsWith('.git/')) {
    if (p === '.git/index' || p === '.git/HEAD' || p === '.git/MERGE_HEAD' || p === '.git/CHERRY_PICK_HEAD') return true
    if (p.startsWith('.git/refs/')) return true
    if (p.startsWith('.git/rebase-merge/') || p.startsWith('.git/rebase-apply/')) return true
    return false
  }
  if (p === 'node_modules' || p.startsWith('node_modules/')) return false
  return true
}

function normalizeWatchRelPath(filename, repoPath) {
  if (!filename) return null
  const normalized = String(filename).replace(/\\/g, '/')
  if (path.isAbsolute(filename)) {
    return path.relative(repoPath, filename).replace(/\\/g, '/')
  }
  return normalized
}

function notifyRepoFilesChanged(repoPath) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('repo-files-changed', repoPath)
}

function stopRepoWatch() {
  if (!activeRepoWatch) return
  clearTimeout(activeRepoWatch.debounceTimer)
  for (const watcher of activeRepoWatch.watchers) {
    try {
      watcher.close()
    } catch (_) { /* ignore */ }
  }
  activeRepoWatch = null
}

function startRepoWatch(repoPath) {
  stopRepoWatch()
  if (!repoPath || !fs.existsSync(repoPath)) return

  let debounceTimer = null
  const scheduleNotify = () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => notifyRepoFilesChanged(repoPath), 350)
  }

  const watchers = []
  const onFsEvent = (filename) => {
    const rel = normalizeWatchRelPath(filename, repoPath)
    if (shouldRefreshForWatchPath(rel)) scheduleNotify()
  }

  try {
    const rootWatcher = fs.watch(repoPath, { recursive: true }, (_eventType, filename) => onFsEvent(filename))
    rootWatcher.on('error', () => {})
    watchers.push(rootWatcher)
  } catch (error) {
    console.error('repo watch (recursive) failed:', error.message)
  }

  const gitIndexPath = path.join(repoPath, '.git', 'index')
  if (fs.existsSync(gitIndexPath)) {
    try {
      const indexWatcher = fs.watch(gitIndexPath, () => scheduleNotify())
      indexWatcher.on('error', () => {})
      watchers.push(indexWatcher)
    } catch (_) { /* ignore */ }
  }

  activeRepoWatch = { repoPath, watchers, debounceTimer }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'GitX',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'icon.ico')
  })

  mainWindow.loadFile('index.html')

  // 开发时打开开发者工具
  // mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopRepoWatch()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopRepoWatch()
})

// IPC Handlers
ipcMain.handle('repo-watch-start', async (_event, repoPath) => {
  startRepoWatch(repoPath)
  return { ok: true }
})

ipcMain.handle('repo-watch-stop', async () => {
  stopRepoWatch()
  return { ok: true }
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (result.canceled) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('git-check-repo', async (event, repoPath) => {
  try {
    const isRepo = await simpleGit(repoPath).checkIsRepo()
    return { isRepo: !!isRepo }
  } catch {
    return { isRepo: false }
  }
})

ipcMain.handle('git-init', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.init()
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-status', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const conflicted = status.conflicted || []
    const remotes = await git.getRemotes()
    return {
      current: status.current,
      tracking: status.tracking,
      ahead: status.ahead,
      behind: status.behind,
      hasRemotes: remotes.length > 0,
      conflicted,
      files: status.files.map(f => ({
        path: f.path,
        working_dir: f.working_dir,
        index: f.index,
        conflicted: conflicted.includes(f.path)
      })),
      isClean: status.isClean()
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

function formatLogCommits(log) {
  return log.all.map(commit => ({
    hash: commit.hash,
    message: commit.message,
    author: commit.author_name,
    date: commit.date,
    refs: commit.refs
  }))
}

ipcMain.handle('git-log', async (event, repoPath, maxCount = 100) => {
  try {
    const git = simpleGit(repoPath)
    const log = await git.log({ maxCount })
    return formatLogCommits(log)
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-log-branch', async (event, repoPath, branchName, maxCount = 100) => {
  try {
    const git = simpleGit(repoPath)
    // 等价于 git log <branch>；修订必须作为第一个参数数组传入，否则会被忽略而落到 HEAD
    const log = await git.log([branchName], { maxCount })
    return formatLogCommits(log)
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-add', async (event, repoPath, files) => {
  try {
    const git = simpleGit(repoPath)
    await git.add(files)
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-commit', async (event, repoPath, message) => {
  try {
    const git = simpleGit(repoPath)
    await git.commit(message)
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

function formatFetchSummary(result) {
  if (!result || typeof result !== 'object') return '远程已是最新，没有新的更新。'
  const lines = []
  const fetched = [].concat(result.fetched || [])
  const deleted = [].concat(result.deleted || [])
  const tags = [].concat(result.tags || [])
  if (fetched.length) {
    lines.push('已获取远程更新：')
    fetched.forEach((ref) => lines.push(`  · ${ref}`))
  }
  if (deleted.length) {
    lines.push('已删除的远程引用：')
    deleted.forEach((ref) => lines.push(`  · ${ref}`))
  }
  if (tags.length) {
    lines.push(`标签：${tags.join(', ')}`)
  }
  if (!lines.length) return '远程已是最新，没有新的更新。'
  return lines.join('\n')
}

function formatPullSummary(result) {
  const summary = result?.summary
  if (summary && typeof summary.changes === 'number') {
    if (summary.changes === 0) return '已经是最新，无需拉取。'
    return `拉取完成：${summary.changes} 个文件变更，+${summary.insertions || 0} / -${summary.deletions || 0} 行`
  }
  const files = result?.files || []
  if (files.length) {
    return `拉取完成，${files.length} 个文件有变更。`
  }
  return '拉取完成。'
}

function formatPushSummary(result, force) {
  const head = force ? '强制推送完成' : '推送完成'
  const parts = [head]
  if (result?.remote) parts.push(`远程：${result.remote}`)
  if (result?.repo) parts.push(`仓库：${result.repo}`)
  const local = result?.ref?.local || result?.ref?.localRef
  const remote = result?.ref?.remote || result?.ref?.remoteRef
  if (local && remote) parts.push(`${local} → ${remote}`)
  else if (local) parts.push(local)
  return parts.join('\n')
}

ipcMain.handle('git-remote-push-info', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const remotes = await git.getRemotes(true)
    const names = remotes.map((r) => r.name)
    const defaultRemote = names.includes('origin') ? 'origin' : (names[0] || null)
    const branch = status.current || ''
    const tracking = status.tracking || null
    return {
      branch,
      tracking,
      hasRemotes: names.length > 0,
      defaultRemote,
      remotes: remotes.map((r) => ({
        name: r.name,
        fetchUrl: r.refs?.fetch || '',
        pushUrl: r.refs?.push || ''
      })),
      pushReady: names.length > 0,
      needsUpstream: names.length > 0 && !tracking && !!branch
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-remote-add', async (event, repoPath, remoteName, url) => {
  try {
    const name = (remoteName || 'origin').trim()
    if (!name) {
      throw new Error('请输入远程名称')
    }
    const { cloneUrl } = parseCloneUrl(url)
    const git = simpleGit(repoPath)
    const existing = await git.getRemotes()
    if (existing.includes(name)) {
      await git.removeRemote(name)
    }
    await git.addRemote(name, cloneUrl)
    return { success: true, remoteName: name, url: cloneUrl }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-push', async (event, repoPath, force = false, options = {}) => {
  try {
    const git = simpleGit(repoPath)
    const remotes = await git.getRemotes()
    if (!remotes.length) {
      throw new Error('尚未配置远程仓库，请先绑定远程地址')
    }
    const status = await git.status()
    const branch = status.current
    if (!branch) {
      throw new Error('当前不在任何分支上，无法推送')
    }

    let result
    if (!status.tracking) {
      const remote = options.remote || (remotes.includes('origin') ? 'origin' : remotes[0])
      if (!remotes.includes(remote)) {
        throw new Error(`远程「${remote}」不存在`)
      }
      const args = force
        ? ['--force', '-u', remote, branch]
        : ['-u', remote, branch]
      result = await git.push(args)
    } else if (force) {
      result = await git.push(['--force'])
    } else {
      result = await git.push()
    }
    return { success: true, summary: formatPushSummary(result, force), force: !!force }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-pull', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    const result = await git.pull()
    return { success: true, summary: formatPullSummary(result) }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-fetch', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    const result = await git.fetch()
    return { success: true, summary: formatFetchSummary(result) }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-reset-file', async (event, repoPath, filePath) => {
  try {
    const git = simpleGit(repoPath)
    await git.reset(['HEAD', '--', filePath])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-reset-staged', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.reset(['HEAD'])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-add-all', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.add('.')
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-discard-files', async (event, repoPath, filePaths = []) => {
  try {
    const git = simpleGit(repoPath)
    const uniquePaths = [...new Set((filePaths || []).map(p => String(p || '').trim().replace(/\\/g, '/')).filter(Boolean))]
    for (const targetPath of uniquePaths) {
      let tracked = true
      try {
        await git.raw(['ls-files', '--error-unmatch', '--', targetPath])
      } catch {
        tracked = false
      }

      if (tracked) {
        try {
          await git.raw(['restore', '--source=HEAD', '--staged', '--worktree', '--', targetPath])
        } catch {
          try { await git.reset(['HEAD', '--', targetPath]) } catch { /* ignore */ }
          await git.checkout(['--', targetPath])
        }
      } else {
        const fullPath = path.join(repoPath, targetPath)
        const isDir = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()
        if (isDir) {
          await git.raw(['clean', '-fd', '--', targetPath])
        } else {
          await git.raw(['clean', '-f', '--', targetPath])
        }
      }
    }
    return { success: true, count: uniquePaths.length }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-ignore-path', async (event, repoPath, filePath, mode = 'path') => {
  try {
    const targetPath = String(filePath || '').trim().replace(/\\/g, '/')
    if (!targetPath) {
      throw new Error('无效的文件路径')
    }

    let entry = targetPath
    if (mode === 'extension') {
      const base = path.basename(targetPath)
      const dotIndex = base.lastIndexOf('.')
      if (dotIndex <= 0 || dotIndex === base.length - 1) {
        throw new Error('该文件没有可忽略的后缀')
      }
      const ext = base.slice(dotIndex + 1)
      entry = `*.${ext}`
    } else if (mode === 'directory') {
      const dir = targetPath.replace(/\/+$/, '')
      if (!dir || dir === '.') {
        throw new Error('根目录无需忽略')
      }
      entry = `${dir}/`
    }

    const gitignorePath = path.join(repoPath, '.gitignore')
    let content = ''
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf8')
    }
    const lines = content.split(/\r?\n/).map(line => line.trim())
    if (!lines.includes(entry)) {
      const suffix = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
      fs.appendFileSync(gitignorePath, `${suffix}${entry}\n`, 'utf8')
    }
    if (mode === 'path') {
      try {
        const git = simpleGit(repoPath)
        // 若该文件已进入索引（A），先从索引移除，避免继续被跟踪
        await git.raw(['rm', '--cached', '--ignore-unmatch', '--', targetPath])
      } catch {
        // 忽略失败不影响 .gitignore 写入
      }
    }
    return { success: true, path: targetPath, entry }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-ignore-list', async (event, repoPath) => {
  try {
    const gitignorePath = path.join(repoPath, '.gitignore')
    if (!fs.existsSync(gitignorePath)) {
      return { entries: [] }
    }
    const content = fs.readFileSync(gitignorePath, 'utf8')
    const entries = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
    return { entries }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-ignore-remove', async (event, repoPath, entry) => {
  try {
    const target = String(entry || '').trim()
    if (!target) throw new Error('无效的忽略项')
    const gitignorePath = path.join(repoPath, '.gitignore')
    if (!fs.existsSync(gitignorePath)) {
      return { success: true }
    }
    const content = fs.readFileSync(gitignorePath, 'utf8')
    const kept = content
      .split(/\r?\n/)
      .filter(line => line.trim() !== target)
    const finalContent = kept.filter((line, idx, arr) => idx < arr.length - 1 || line !== '').join('\n')
    fs.writeFileSync(gitignorePath, finalContent + (finalContent.endsWith('\n') || finalContent.length === 0 ? '' : '\n'), 'utf8')
    return { success: true, entry: target }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-show', async (event, repoPath, hash) => {
  try {
    const git = simpleGit(repoPath)
    const output = await git.show([hash, '--stat', '--format=fuller'])
    return { output }
  } catch (error) {
    throw new Error(error.message)
  }
})

function parseDiffTreeNameStatus(output) {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t')
      if (parts.length < 2) return null
      const rawStatus = parts[0]
      const status = rawStatus.charAt(0)
      const path = rawStatus.startsWith('R') && parts.length >= 3 ? parts[2] : parts[1]
      return { status, path, rawStatus }
    })
    .filter(Boolean)
}

ipcMain.handle('git-commit-files', async (event, repoPath, hash) => {
  try {
    const git = simpleGit(repoPath)
    const output = await git.raw(['diff-tree', '--no-commit-id', '--name-status', '-r', hash])
    return { files: parseDiffTreeNameStatus(output) }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-commit-file-snapshot', async (event, repoPath, hash, filePath, side) => {
  try {
    const git = simpleGit(repoPath)
    const ref = side === 'parent' ? `${hash}^:${filePath}` : `${hash}:${filePath}`
    try {
      const content = await git.show([ref])
      return { content: content ?? '', exists: true }
    } catch {
      return { content: '', exists: false }
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-commit-file-diff', async (event, repoPath, hash, filePath) => {
  try {
    const git = simpleGit(repoPath)
    let diff = ''
    try {
      diff = await git.show([hash, '--', filePath])
    } catch (err) {
      if (/commit is a merge/i.test(err.message || '')) {
        diff = await git.show([hash, '-m', '--first-parent', '--', filePath])
      } else {
        throw err
      }
    }
    return { diff: diff || '' }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-reset-to-commit', async (event, repoPath, hash, mode) => {
  const allowed = ['hard', 'soft', 'mixed']
  if (!allowed.includes(mode)) {
    throw new Error('无效的回滚模式')
  }
  try {
    const git = simpleGit(repoPath)
    await git.reset([`--${mode}`, hash])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

async function gitPathExists(repoPath, gitRelativePath) {
  try {
    const git = simpleGit(repoPath)
    const gitDir = (await git.raw(['rev-parse', '--git-dir'])).trim()
    const gitDirAbs = path.isAbsolute(gitDir) ? gitDir : path.join(repoPath, gitDir)
    const target = path.join(gitDirAbs, gitRelativePath)
    return fs.existsSync(target)
  } catch {
    return false
  }
}

async function readGitRepoFile(repoPath, gitRelativePath) {
  try {
    const git = simpleGit(repoPath)
    const gitDir = (await git.raw(['rev-parse', '--git-dir'])).trim()
    const gitDirAbs = path.isAbsolute(gitDir) ? gitDir : path.join(repoPath, gitDir)
    const target = path.join(gitDirAbs, gitRelativePath)
    if (!fs.existsSync(target)) return null
    return fs.readFileSync(target, 'utf8')
  } catch {
    return null
  }
}

async function writeGitRepoFile(repoPath, gitRelativePath, content) {
  const git = simpleGit(repoPath)
  const gitDir = (await git.raw(['rev-parse', '--git-dir'])).trim()
  const gitDirAbs = path.isAbsolute(gitDir) ? gitDir : path.join(repoPath, gitDir)
  const target = path.join(gitDirAbs, gitRelativePath)
  fs.writeFileSync(target, content, 'utf8')
}

/** 去掉 MERGE_MSG 里以 # 开头的注释行，与 git commit 行为一致 */
function normalizeMergeCommitMessage(raw) {
  if (!raw) return ''
  return raw
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .trim()
}

function formatMergeBranchMessage(sourceBranch, targetBranch) {
  return `Merge branch '${sourceBranch}' into ${targetBranch}`
}

/** 从已有提交说明中解析 merge A into B */
function parseMergeBranchMessage(message) {
  if (!message) return null
  const firstLine = message.split('\n')[0].trim()
  let match = firstLine.match(/^Merge branch '([^']+)' into (.+)$/i)
  if (match) return { source: match[1], target: match[2].trim() }
  match = firstLine.match(/^Merge remote-tracking branch '([^']+)' into (.+)$/i)
  if (match) return { source: match[1], target: match[2].trim() }
  return null
}

function isGenericSquashFallbackMessage(message) {
  if (!message) return true
  return /^Squashed commit\s*\(merge into\s+/i.test(message.trim())
}

async function buildSquashMergeCommitMessage(repoPath, sourceBranch) {
  const git = simpleGit(repoPath)
  const status = await git.status()
  const current = status.current || 'HEAD'
  const mergeMsg = normalizeMergeCommitMessage(await readGitRepoFile(repoPath, 'MERGE_MSG'))
  const parsed = parseMergeBranchMessage(mergeMsg)

  if (parsed?.source && parsed?.target && !isGenericSquashFallbackMessage(mergeMsg)) {
    return formatMergeBranchMessage(parsed.source, parsed.target)
  }

  const source = sourceBranch || parsed?.source
  if (source) {
    return formatMergeBranchMessage(source, current)
  }

  if (mergeMsg && !isGenericSquashFallbackMessage(mergeMsg)) {
    return mergeMsg
  }

  throw new Error('无法确定被合并的分支名称，请使用顶部 Commit 手动提交并填写说明')
}

/** squash merge 无 MERGE_HEAD；有 MERGE_MSG 且仍有冲突或暂存改动时表示合并未完成 */
async function isSquashMergeInProgress(repoPath, status) {
  if (await gitPathExists(repoPath, 'MERGE_HEAD')) return false
  if (await gitPathExists(repoPath, 'rebase-merge') || await gitPathExists(repoPath, 'rebase-apply')) return false
  if (await gitPathExists(repoPath, 'CHERRY_PICK_HEAD')) return false

  const mergeMsg = await readGitRepoFile(repoPath, 'MERGE_MSG')
  if (!mergeMsg) return false

  const conflictCount = (status.conflicted || []).length
  if (conflictCount > 0) return true

  const hasStagedInStatus = (status.files || []).some((f) => {
    const i = f.index
    return i && i !== ' ' && i !== '?'
  })
  if (hasStagedInStatus) return true

  try {
    const git = simpleGit(repoPath)
    const cached = await git.diff(['--cached', '--name-only'])
    return cached.trim().length > 0
  } catch {
    return false
  }
}

ipcMain.handle('git-branches', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    const branches = await git.branch(['-a'])
    const local = []
    const remote = []

    for (const name of branches.all) {
      if (name === 'HEAD') continue
      const info = branches.branches[name]
      if (name.startsWith('remotes/')) {
        const shortName = name.replace(/^remotes\//, '')
        if (shortName.endsWith('/HEAD')) continue
        remote.push({
          name: shortName,
          fullName: name,
          commit: info?.commit || ''
        })
      } else {
        local.push({
          name,
          current: name === branches.current,
          commit: info?.commit || ''
        })
      }
    }

    local.sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || a.name.localeCompare(b.name))
    remote.sort((a, b) => a.name.localeCompare(b.name))

    return {
      current: branches.current,
      local,
      remote
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-operation-state', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const conflictCount = (status.conflicted || []).length

    const rebase = await gitPathExists(repoPath, 'rebase-merge') ||
      await gitPathExists(repoPath, 'rebase-apply')
    const merge = await gitPathExists(repoPath, 'MERGE_HEAD')
    const cherryPick = await gitPathExists(repoPath, 'CHERRY_PICK_HEAD')
    const squashInProgress = await isSquashMergeInProgress(repoPath, status)
    // squash merge 冲突时通常没有 MERGE_HEAD；全部标记已解决后仍需保留操作条直至提交
    const mergeConflicts = squashInProgress ||
      (conflictCount > 0 && !rebase && !cherryPick && !merge)

    return {
      rebase,
      merge,
      cherryPick,
      squashInProgress,
      mergeConflicts,
      conflictCount,
      inProgress: rebase || merge || cherryPick || mergeConflicts
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-rebase-continue', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.rebase(['--continue'])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-rebase-skip', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.rebase(['--skip'])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-cherry-pick-continue', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.raw(['cherry-pick', '--continue'])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-cherry-pick-abort', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.raw(['cherry-pick', '--abort'])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-merge-abort', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    if (await gitPathExists(repoPath, 'MERGE_HEAD')) {
      await git.raw(['merge', '--abort'])
    } else {
      await git.reset(['--hard', 'HEAD'])
    }
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-merge-continue', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    try {
      await git.raw(['merge', '--continue'])
    } catch {
      await git.commit()
    }
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

/** squash 合并冲突解决后：用 MERGE_MSG / 源分支名自动生成 merge A into B 提交说明 */
ipcMain.handle('git-finish-squash-merge', async (event, repoPath, sourceBranch) => {
  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const conflictCount = (status.conflicted || []).length
    if (conflictCount > 0) {
      throw new Error('仍有未解决的冲突文件')
    }

    const cached = await git.diff(['--cached', '--name-only'])
    if (!cached.trim()) {
      throw new Error('没有已暂存的合并改动可提交')
    }

    const message = await buildSquashMergeCommitMessage(repoPath, sourceBranch)
    const commitResult = await git.commit(message)
    return { success: true, message, commitResult }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-mark-resolved', async (event, repoPath, filePath) => {
  try {
    const git = simpleGit(repoPath)
    await git.add([filePath])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-checkout-remote', async (event, repoPath, remoteBranch) => {
  try {
    const git = simpleGit(repoPath)
    const localName = remoteBranch.includes('/')
      ? remoteBranch.split('/').slice(1).join('/')
      : remoteBranch
    const locals = await git.branchLocal()
    if (locals.all.includes(localName)) {
      await git.checkout(localName)
    } else {
      await git.checkout(['-b', localName, remoteBranch])
    }
    return { success: true, branch: localName }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-checkout', async (event, repoPath, branch) => {
  try {
    const git = simpleGit(repoPath)
    await git.checkout(branch)
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-diff', async (event, repoPath, filePath) => {
  try {
    const git = simpleGit(repoPath)
    // 获取工作区的 diff（相对于暂存区或 HEAD）
    const diff = await git.diff(['--', filePath])
    return { diff }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-diff-cached', async (event, repoPath, filePath) => {
  try {
    const git = simpleGit(repoPath)
    // 获取暂存区的 diff（相对于 HEAD）
    const diff = await git.diff(['--cached', '--', filePath])
    return { diff }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-create-branch', async (event, repoPath, branchName) => {
  try {
    const git = simpleGit(repoPath)
    // 创建新分支
    await git.checkoutLocalBranch(branchName)
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-merge', async (event, repoPath, branchName, mode = 'merge-commit') => {
  try {
    const git = simpleGit(repoPath)
    let mergeArgs
    switch (mode) {
      case 'fast-forward':
        mergeArgs = ['--ff-only', branchName]
        break
      case 'working-tree':
        mergeArgs = ['--no-commit', '--no-ff', branchName]
        break
      case 'merge-commit':
      default: {
        const statusBefore = await git.status()
        const current = statusBefore.current || 'HEAD'
        const message = formatMergeBranchMessage(branchName, current)
        try {
          await git.merge(['--squash', branchName])
        } catch (mergeError) {
          try {
            await writeGitRepoFile(repoPath, 'MERGE_MSG', `${message}\n`)
          } catch {
            // 写入失败不掩盖原始合并错误
          }
          throw mergeError
        }
        const status = await git.status()
        if (status.isClean()) {
          return { success: true, mode: 'merge-commit', nothingToCommit: true }
        }
        const commitResult = await git.commit(message)
        return { success: true, mode: 'merge-commit', squash: true, commitResult }
      }
    }
    const result = await git.merge(mergeArgs)
    return { success: true, result, mode }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-stash-list', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    const stashList = await git.stashList()
    return stashList.all.map((stash, index) => ({
      index: index,
      hash: stash.hash,
      message: stash.message,
      date: stash.date
    }))
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-stash-save', async (event, repoPath, message) => {
  try {
    const git = simpleGit(repoPath)
    await git.stash(['save', message || 'WIP'])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-stash-apply', async (event, repoPath, index) => {
  try {
    const git = simpleGit(repoPath)
    await git.stash(['apply', `stash@{${index}}`])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-stash-drop', async (event, repoPath, index) => {
  try {
    const git = simpleGit(repoPath)
    await git.stash(['drop', `stash@{${index}}`])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-tags', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    const summary = await git.tags()
    const tags = await Promise.all(
      (summary.all || []).map(async (name) => {
        try {
          const hash = (await git.revparse([`${name}^{commit}`])).trim()
          let message = ''
          try {
            const tagType = (await git.raw(['cat-file', '-t', name])).trim()
            if (tagType === 'tag') {
              message = (await git.raw(['tag', '-l', name, '-n999'])).trim()
            }
          } catch (_) { /* lightweight tag */ }
          return { name, hash, message }
        } catch {
          return { name, hash: '', message: '' }
        }
      })
    )
    return { tags, latest: summary.latest }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-tag-create', async (event, repoPath, tagName, message) => {
  try {
    const git = simpleGit(repoPath)
    if (message && message.trim()) {
      await git.raw(['tag', '-a', tagName, '-m', message.trim()])
    } else {
      await git.addTag(tagName)
    }
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-tag-delete', async (event, repoPath, tagName) => {
  try {
    const git = simpleGit(repoPath)
    await git.tag(['-d', tagName])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-push-tags', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.pushTags()
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-cherry-pick', async (event, repoPath, hash) => {
  try {
    const git = simpleGit(repoPath)
    await git.raw(['cherry-pick', hash])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-rebase', async (event, repoPath, ontoBranch) => {
  try {
    const git = simpleGit(repoPath)
    await git.rebase([ontoBranch])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-rebase-abort', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.rebase(['--abort'])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-delete-branch', async (event, repoPath, branchName, force) => {
  try {
    const git = simpleGit(repoPath)
    if (force) {
      await git.branch(['-D', branchName])
    } else {
      await git.deleteLocalBranch(branchName)
    }
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-rename-branch', async (event, repoPath, oldName, newName) => {
  try {
    const git = simpleGit(repoPath)
    const { current } = await git.status()
    if (current === oldName) {
      await git.branch(['-m', newName])
    } else {
      await git.branch(['-m', oldName, newName])
    }
    return { success: true, branch: newName }
  } catch (error) {
    throw new Error(error.message)
  }
})

function repoNameFromPath(pathname) {
  const segments = pathname.replace(/\\/g, '/').split('/').filter(Boolean)
  const last = segments[segments.length - 1] || 'repository'
  return last.replace(/\.git$/i, '')
}

function sanitizeRepoDirName(name) {
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
  return safe || 'repository'
}

/** 解析克隆 URL，支持 https、ssh://（含自定义端口）、git@host:path */
function parseCloneUrl(url) {
  const trimmed = (url || '').trim()
  if (!trimmed) {
    throw new Error('请输入仓库 URL')
  }

  if (/^ssh:\/\//i.test(trimmed)) {
    let parsed
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new Error('SSH URL 格式无效，示例：ssh://git@host:10022/group/repo.git')
    }
    if (!parsed.hostname) {
      throw new Error('SSH URL 缺少主机名')
    }
    if (!parsed.pathname || parsed.pathname === '/') {
      throw new Error('SSH URL 缺少仓库路径（如 /group/repo.git）')
    }
    return {
      cloneUrl: trimmed,
      repoName: sanitizeRepoDirName(repoNameFromPath(parsed.pathname))
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    let parsed
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new Error('HTTPS URL 格式无效')
    }
    if (!parsed.pathname || parsed.pathname === '/') {
      throw new Error('HTTPS URL 缺少仓库路径')
    }
    return {
      cloneUrl: trimmed,
      repoName: sanitizeRepoDirName(repoNameFromPath(parsed.pathname))
    }
  }

  // SCP：git@host:group/repo.git（默认 22 端口；非 22 端口请用 ssh://）
  const scpMatch = trimmed.match(/^([^@\s/\\]+@[^:\s/\\]+):(\S+)$/)
  if (scpMatch) {
    const pathPart = scpMatch[2].replace(/\\/g, '/')
    return {
      cloneUrl: trimmed,
      repoName: sanitizeRepoDirName(repoNameFromPath('/' + pathPart))
    }
  }

  throw new Error(
    '不支持的仓库地址。支持：https://…、ssh://git@主机:端口/组/仓库.git、git@主机:组/仓库.git'
  )
}

ipcMain.handle('git-clone', async (event, url, parentDir) => {
  try {
    const { cloneUrl, repoName } = parseCloneUrl(url)
    const targetPath = path.join(parentDir, repoName)
    if (fs.existsSync(targetPath)) {
      throw new Error(`目录已存在: ${targetPath}`)
    }
    const git = simpleGit()
    await git.clone(cloneUrl, targetPath)
    return { path: targetPath, repoName }
  } catch (error) {
    const msg = error.message || String(error)
    if (/authentication|permission denied|host key|could not read from remote/i.test(msg)) {
      throw new Error(`克隆失败（请检查 SSH 密钥与网络）：${msg}`)
    }
    throw new Error(msg)
  }
})

ipcMain.handle('git-cherry-pick-skip', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    await git.raw(['cherry-pick', '--skip'])
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-config-get', async (event, repoPath, scope = 'local') => {
  try {
    const git = scope === 'global' ? simpleGit() : simpleGit(repoPath)
    const get = async (key) => {
      try {
        const args = scope === 'global'
          ? ['config', '--global', '--get', key]
          : ['config', '--get', key]
        return (await git.raw(args)).trim()
      } catch {
        return ''
      }
    }
    return {
      name: await get('user.name'),
      email: await get('user.email'),
      scope
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-config-set', async (event, repoPath, name, email, scope = 'local') => {
  try {
    const git = scope === 'global' ? simpleGit() : simpleGit(repoPath)
    const configScope = scope === 'global' ? 'global' : 'local'
    if (name !== undefined && name !== null) {
      await git.addConfig('user.name', name, false, configScope)
    }
    if (email !== undefined && email !== null) {
      await git.addConfig('user.email', email, false, configScope)
    }
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-diff-commits', async (event, repoPath, hashA, hashB) => {
  try {
    const git = simpleGit(repoPath)
    const diff = await git.diff([hashA, hashB])
    return { diff }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-conflict-versions', async (event, repoPath, filePath) => {
  try {
    const git = simpleGit(repoPath)
    const readStage = async (stage) => {
      try {
        return await git.show([`:${stage}:${filePath}`])
      } catch {
        return null
      }
    }
    let working = null
    try {
      const fullPath = path.join(repoPath, filePath)
      if (fs.existsSync(fullPath)) {
        working = fs.readFileSync(fullPath, 'utf8')
      }
    } catch { /* ignore */ }
    return {
      base: await readStage(1),
      ours: await readStage(2),
      theirs: await readStage(3),
      working
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-submodules', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath)
    let output = ''
    try {
      output = await git.raw(['submodule', 'status', '--recursive'])
    } catch {
      return { submodules: [] }
    }
    const submodules = output.split('\n').filter(Boolean).map(line => {
      const match = line.match(/^([+\-U ])([a-f0-9]+)\s+(\S+)(?:\s+\((.+)\))?/)
      if (!match) return { raw: line.trim(), status: '?', hash: '', path: line.trim(), branch: '' }
      return {
        status: match[1].trim() || ' ',
        hash: match[2],
        path: match[3],
        branch: match[4] || '',
        raw: line.trim()
      }
    })
    return { submodules }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-submodule-update', async (event, repoPath, submodulePath) => {
  try {
    const git = simpleGit(repoPath)
    if (submodulePath) {
      await git.raw(['submodule', 'update', '--init', '--recursive', submodulePath])
    } else {
      await git.raw(['submodule', 'update', '--init', '--recursive'])
    }
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-head-file-snapshot', async (event, repoPath, filePath) => {
  try {
    const git = simpleGit(repoPath)
    try {
      const content = await git.show([`HEAD:${filePath}`])
      return { content: content ?? '', exists: true }
    } catch {
      return { content: '', exists: false }
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-index-file-snapshot', async (event, repoPath, filePath) => {
  try {
    const git = simpleGit(repoPath)
    try {
      const content = await git.show([`:${filePath}`])
      return { content: content ?? '', exists: true }
    } catch {
      return { content: '', exists: false }
    }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-read-working-file', async (event, repoPath, filePath) => {
  try {
    const fullPath = path.join(repoPath, filePath)
    if (!fs.existsSync(fullPath)) {
      throw new Error('文件不存在')
    }
    return { content: fs.readFileSync(fullPath, 'utf8') }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('open-path', async (event, fullPath) => {
  try {
    const result = await shell.openPath(fullPath)
    if (result) throw new Error(result)
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-open-repo-file', async (event, repoPath, filePath) => {
  try {
    const fullPath = path.join(repoPath, filePath)
    const result = await shell.openPath(fullPath)
    if (result) throw new Error(result)
    return { success: true }
  } catch (error) {
    throw new Error(error.message)
  }
})

ipcMain.handle('git-log-search', async (event, repoPath, keyword, maxCount = 100) => {
  try {
    const git = simpleGit(repoPath)
    const log = await git.log([`--grep=${keyword}`, '-i', `-n`, String(maxCount)])
    return formatLogCommits(log)
  } catch (error) {
    throw new Error(error.message)
  }
})
