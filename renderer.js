let currentRepoPath = null

function isEditableElement(el) {
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

// 快捷键支持（输入框内不拦截普通按键，避免无法输入）
document.addEventListener('keydown', (e) => {
    if (e.isComposing) return

    const inField = isEditableElement(e.target)

    if (inField) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault()
            if (currentRepoPath) commitFabBtn?.click()
        }
        if (e.key === 'Escape') {
            if (dialogOverlay.style.display === 'flex') hideDialog()
        }
        return
    }

    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        if (!currentRepoPath) openRepoBtn.click()
    }
    if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault()
        if (currentRepoPath) refreshBtn.click()
    }
    if (e.key === 'Escape') {
        if (dialogOverlay.style.display === 'flex') hideDialog()
        else if (splitDiffOverlay?.style.display === 'flex') hideSplitDiffDialog()
    }
})

const welcomeScreen = document.getElementById('welcome-screen')
const mainScreen = document.getElementById('main-screen')
const repoName = document.getElementById('repo-name')
const currentBranch = document.getElementById('current-branch')
const trackingInfo = document.getElementById('tracking-info')
const statusText = document.getElementById('status-text')
const changeFileList = document.getElementById('change-file-list')
const commitFabBtn = document.getElementById('commit-fab')
const ignoreManageFabBtn = document.getElementById('ignore-manage-fab')
const commitList = document.getElementById('commit-list')
const branchList = document.getElementById('branch-list')
const stashList = document.getElementById('stash-list')
const tagList = document.getElementById('tag-list')
const recentReposEl = document.getElementById('recent-repos')
const commitSearchInput = document.getElementById('commit-search')
const commitSearchBtn = document.getElementById('commit-search-btn')
const commitSearchClear = document.getElementById('commit-search-clear')
const configNameInput = document.getElementById('config-name')
const configEmailInput = document.getElementById('config-email')
const saveConfigBtn = document.getElementById('save-config-btn')
const settingsRepoPath = document.getElementById('settings-repo-path')
const configScopeSelect = document.getElementById('config-scope')
const repoSwitcher = document.getElementById('repo-switcher')
const openOtherRepoBtn = document.getElementById('open-other-repo-btn')
const cloneRepoSidebarBtn = document.getElementById('clone-repo-sidebar-btn')
const removeRepoBtn = document.getElementById('remove-repo-btn')
const dialogPanel = document.getElementById('dialog-panel')
const splitDiffOverlay = document.getElementById('split-diff-overlay')
const splitDiffTitle = document.getElementById('split-diff-title')
const splitDiffBody = document.getElementById('split-diff-body')
const splitDiffClose = document.getElementById('split-diff-close')
const submoduleList = document.getElementById('submodule-list')
const submoduleUpdateAllBtn = document.getElementById('submodule-update-all-btn')

const openRepoBtn = document.getElementById('open-repo-btn')
const cloneRepoBtn = document.getElementById('clone-repo-btn')
const closeRepoBtn = document.getElementById('close-repo-btn')
const fetchBtn = document.getElementById('fetch-btn')
const refreshBtn = document.getElementById('refresh-btn')
const pullBtn = document.getElementById('pull-btn')
const pushBtn = document.getElementById('push-btn')
const newBranchBtn = document.getElementById('new-branch-btn')
const newStashBtn = document.getElementById('new-stash-btn')
const newTagBtn = document.getElementById('new-tag-btn')
const pushTagsBtn = document.getElementById('push-tags-btn')
const settingsBtn = document.getElementById('settings-btn')

const RECENT_REPOS_KEY = 'git-client-recent-repos'
const FAVORITE_REPOS_KEY = 'git-client-favorite-repos'
const THEME_KEY = 'git-client-theme'
const MAX_RECENT = 8

let currentOperationState = null
let cachedCommits = []
let currentBranchName = ''
let historyLogBranch = ''
let cachedChangeFiles = []
/** squash 合并未提交前保持操作条（冲突已全部 add 后仍可能无 MERGE_HEAD） */
let pendingSquashMerge = false
let pendingSquashMergeSourceBranch = ''

const operationBanner = document.getElementById('operation-banner')
const operationTitle = document.getElementById('operation-title')
const operationDesc = document.getElementById('operation-desc')
const opContinueBtn = document.getElementById('op-continue-btn')
const opSkipBtn = document.getElementById('op-skip-btn')
const opAbortBtn = document.getElementById('op-abort-btn')
const remoteBranchList = document.getElementById('remote-branch-list')
const themeToggleBtn = document.getElementById('theme-toggle-btn')
const favoriteRepoBtn = document.getElementById('favorite-repo-btn')

const dialogOverlay = document.getElementById('dialog-overlay')
const dialogTitle = document.getElementById('dialog-title')
const dialogBody = document.getElementById('dialog-body')
const dialogClose = document.getElementById('dialog-close')
const dialogCancel = document.getElementById('dialog-cancel')
const dialogFooter = document.getElementById('dialog-footer')
const dialogConfirm = document.getElementById('dialog-confirm')
const contextMenuEl = document.getElementById('context-menu')

const navItems = document.querySelectorAll('.nav-item')
const views = document.querySelectorAll('.content-views .view')

let contextMenuState = null
let cachedBranchData = { local: [], remote: [] }
let repoWatchUnsubscribe = null
let changesLoadInFlight = false
let pendingChangesLoad = false

function getRecentRepos() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_REPOS_KEY) || '[]')
    } catch {
        return []
    }
}

function saveRecentRepo(repoPath) {
    const list = getRecentRepos().filter(p => p !== repoPath)
    list.unshift(repoPath)
    localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
    renderRecentRepos()
    populateRepoSwitcher()
}

function removeRepoFromSavedList(repoPath) {
    const recent = getRecentRepos().filter(p => p !== repoPath)
    const favorites = getFavoriteRepos().filter(p => p !== repoPath)
    localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(recent))
    localStorage.setItem(FAVORITE_REPOS_KEY, JSON.stringify(favorites))
    renderRecentRepos()
    populateRepoSwitcher()
}

function getFavoriteRepos() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITE_REPOS_KEY) || '[]')
    } catch {
        return []
    }
}

function isFavorite(repoPath) {
    return getFavoriteRepos().includes(repoPath)
}

function toggleFavorite(repoPath, e) {
    if (e) e.stopPropagation()
    let list = getFavoriteRepos()
    if (list.includes(repoPath)) {
        list = list.filter(p => p !== repoPath)
    } else {
        list = [repoPath, ...list]
    }
    localStorage.setItem(FAVORITE_REPOS_KEY, JSON.stringify(list))
    renderRecentRepos()
    populateRepoSwitcher()
}

function renderRepoListItem(repoPath) {
    const name = escapeHtml(repoPath.split(/[/\\]/).pop())
    const path = escapeAttr(repoPath)
    const starred = isFavorite(repoPath)
    return `
        <li class="repo-list-item">
            <button type="button" class="repo-star ${starred ? 'starred' : ''}" data-path="${path}" title="${starred ? '取消收藏' : '收藏'}">${starred ? '★' : '☆'}</button>
            <button type="button" class="recent-item" data-path="${path}" title="${escapeAttr(repoPath)}">${name}</button>
            <button type="button" class="repo-remove" data-path="${path}" title="从列表移除（不删除磁盘文件）" aria-label="移除">×</button>
        </li>
    `
}

function renderRecentRepos() {
    const favorites = getFavoriteRepos()
    const recent = getRecentRepos().filter(p => !favorites.includes(p))
    if (!favorites.length && !recent.length) {
        recentReposEl.innerHTML = ''
        return
    }
    let html = ''
    if (favorites.length) {
        html += `<p class="recent-title">⭐ 收藏仓库</p><ul class="recent-list">${favorites.map(renderRepoListItem).join('')}</ul>`
    }
    if (recent.length) {
        html += `<p class="recent-title">最近打开</p><ul class="recent-list">${recent.map(renderRepoListItem).join('')}</ul>`
    }
    recentReposEl.innerHTML = html
    recentReposEl.querySelectorAll('.recent-item').forEach(btn => {
        btn.addEventListener('click', () => openRepositoryPath(btn.dataset.path))
    })
    recentReposEl.querySelectorAll('.repo-star').forEach(btn => {
        btn.addEventListener('click', (e) => toggleFavorite(btn.dataset.path, e))
    })
    recentReposEl.querySelectorAll('.repo-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            removeRepositoryFromList(btn.dataset.path)
        })
    })
}

function updateFavoriteButton() {
    if (!currentRepoPath) return
    const starred = isFavorite(currentRepoPath)
    favoriteRepoBtn.textContent = starred ? '★' : '☆'
    favoriteRepoBtn.title = starred ? '取消收藏' : '收藏此仓库'
    favoriteRepoBtn.classList.toggle('starred', starred)
}

function getOpenRepoList() {
    const set = new Set()
    getFavoriteRepos().forEach(p => set.add(p))
    getRecentRepos().forEach(p => set.add(p))
    if (currentRepoPath) set.add(currentRepoPath)
    return [...set]
}

function updateRemoveRepoButton() {
    if (!removeRepoBtn) return
    const repos = getOpenRepoList()
    const selected = repoSwitcher?.value || currentRepoPath
    removeRepoBtn.disabled = !repos.length || !selected
}

function populateRepoSwitcher() {
    const repos = getOpenRepoList()
    const prev = repoSwitcher.value
    repoSwitcher.innerHTML = repos.map(p => {
        const name = escapeHtml(p.split(/[/\\]/).pop())
        const path = escapeAttr(p)
        const selected = p === currentRepoPath ? 'selected' : ''
        return `<option value="${path}" ${selected} title="${path}">${name}</option>`
    }).join('')
    if (repos.length) {
        const keep = repos.includes(prev) ? prev : (currentRepoPath && repos.includes(currentRepoPath) ? currentRepoPath : repos[0])
        repoSwitcher.value = keep
    }
    updateRemoveRepoButton()
}

async function closeCurrentRepositoryView() {
    await stopRepoAutoRefresh()
    pendingSquashMerge = false
    pendingSquashMergeSourceBranch = ''
    currentRepoPath = null
    hideSplitDiffDialog()
    hideDialog()
    mainScreen.style.display = 'none'
    welcomeScreen.style.display = 'flex'
}

async function removeRepositoryFromList(repoPath) {
    if (!repoPath) return
    const name = repoPath.split(/[/\\]/).pop() || repoPath
    const ok = await showAppConfirm(
        `从列表中移除「${name}」？\n\n仅清除本应用的最近/收藏记录，不会删除磁盘上的仓库文件。`,
        { title: '移除仓库', variant: 'warning' }
    )
    if (!ok) return

    removeRepoFromSavedList(repoPath)
    if (repoPath === currentRepoPath) {
        await closeCurrentRepositoryView()
    }
}

async function startRepoAutoRefresh(repoPath) {
    if (repoWatchUnsubscribe) {
        repoWatchUnsubscribe()
        repoWatchUnsubscribe = null
    }
    await window.gitAPI.stopRepoWatch()
    if (!repoPath) return
    await window.gitAPI.startRepoWatch(repoPath)
    repoWatchUnsubscribe = window.gitAPI.onRepoFilesChanged((changedPath) => {
        if (changedPath === currentRepoPath) scheduleChangesRefresh()
    })
}

async function stopRepoAutoRefresh() {
    if (repoWatchUnsubscribe) {
        repoWatchUnsubscribe()
        repoWatchUnsubscribe = null
    }
    await window.gitAPI.stopRepoWatch()
}

function scheduleChangesRefresh() {
    if (!currentRepoPath) return
    loadChangesOnly()
}

async function openRepositoryPath(repoPath) {
    if (!repoPath) return

    let isRepo = false
    try {
        const result = await window.gitAPI.checkRepository(repoPath)
        isRepo = !!result?.isRepo
    } catch (error) {
        await showAppAlert('无法检查目录: ' + error.message)
        return
    }

    if (!isRepo) {
        const folderName = repoPath.split(/[/\\]/).pop() || repoPath
        const ok = await showAppConfirm(
            `所选目录还不是 Git 仓库：\n${folderName}\n\n是否在此目录初始化一个新的 Git 仓库（git init）？`,
            { title: '初始化 Git 仓库', confirmText: '创建仓库', cancelText: '取消' }
        )
        if (!ok) return
        try {
            setStatus('正在初始化 Git 仓库…')
            await window.gitAPI.initRepository(repoPath)
            setStatus('Git 仓库已创建')
        } catch (error) {
            await showAppAlert('初始化失败: ' + error.message)
            setStatus('就绪')
            return
        }
    }

    try {
        await openRepository(repoPath)
    } catch (error) {
        await showAppAlert('打开仓库失败: ' + error.message)
        setStatus('就绪')
    }
}

async function openRepository(repoPath) {
    await stopRepoAutoRefresh()
    currentRepoPath = repoPath
    historyLogBranch = ''
    welcomeScreen.style.display = 'none'
    mainScreen.style.display = 'flex'
    const shortName = repoPath.split(/[/\\]/).pop()
    repoName.textContent = shortName
    repoName.title = repoPath
    const avatarEl = document.getElementById('repo-avatar')
    if (avatarEl) avatarEl.textContent = (shortName.charAt(0) || 'G').toUpperCase()
    saveRecentRepo(repoPath)
    updateFavoriteButton()
    populateRepoSwitcher()
    await loadRepoData()
    await startRepoAutoRefresh(repoPath)
    requestAnimationFrame(() => fetchBtn?.focus())
}

repoSwitcher.addEventListener('change', async () => {
    updateRemoveRepoButton()
    const path = repoSwitcher.value
    if (path && path !== currentRepoPath) {
        await openRepositoryPath(path)
    }
})

removeRepoBtn.addEventListener('click', async () => {
    const path = repoSwitcher.value || currentRepoPath
    await removeRepositoryFromList(path)
})

openOtherRepoBtn.addEventListener('click', async () => {
    try {
        const path = await window.gitAPI.selectDirectory()
        if (path) await openRepositoryPath(path)
    } catch (error) {
        await showAppAlert('打开仓库失败: ' + error.message)
    }
})

favoriteRepoBtn.addEventListener('click', () => {
    if (currentRepoPath) {
        toggleFavorite(currentRepoPath)
        updateFavoriteButton()
    }
})

openRepoBtn.addEventListener('click', async () => {
    try {
        const path = await window.gitAPI.selectDirectory()
        if (path) await openRepositoryPath(path)
    } catch (error) {
        await showAppAlert('打开仓库失败: ' + error.message)
    }
})

function isSupportedCloneUrl(url) {
    const u = (url || '').trim()
    return /^https?:\/\//i.test(u)
        || /^ssh:\/\//i.test(u)
        || /^[^@\s/\\]+@[^:\s/\\]+:\S+$/.test(u)
}

function showCloneRepoDialog() {
    showDialog(
        '克隆远程仓库',
        `<label class="dialog-label">仓库 URL</label>
        <input type="text" id="clone-url" class="dialog-input" placeholder="ssh://git@host:10022/group/repo.git" spellcheck="false" />
        <p class="dialog-hint">支持 HTTPS、SSH（<code>ssh://git@主机:端口/路径/仓库.git</code>）及 <code>git@主机:路径/仓库.git</code></p>
        <label class="dialog-label" style="margin-top:12px">保存到目录（点击下方按钮选择父目录）</label>
        <input type="text" id="clone-parent" class="dialog-input" readonly placeholder="尚未选择目录" />
        <button type="button" id="clone-pick-dir" class="btn btn-secondary btn-block" style="margin-top:8px">选择父目录</button>`,
        async () => {
            const url = document.getElementById('clone-url').value.trim()
            const parentDir = document.getElementById('clone-parent').value.trim()
            if (!url) {
                await showAppAlert('请输入仓库 URL')
                return
            }
            if (!isSupportedCloneUrl(url)) {
                await showAppAlert('URL 格式不支持。请使用 https://、ssh://（含端口）或 git@主机:路径/仓库.git')
                return
            }
            if (!parentDir) {
                await showAppAlert('请选择保存目录')
                return
            }
            try {
                setStatus('正在克隆...')
                const { path } = await window.gitAPI.clone(url, parentDir)
                hideDialog()
                await openRepository(path)
                setStatus('克隆完成')
            } catch (error) {
                await showAppAlert('克隆失败: ' + error.message)
                setStatus('就绪')
            }
        }
    )
    setTimeout(() => {
        document.getElementById('clone-pick-dir')?.addEventListener('click', async () => {
            const dir = await window.gitAPI.selectDirectory()
            if (dir) document.getElementById('clone-parent').value = dir
        })
        document.getElementById('clone-url')?.focus()
    }, 0)
}

cloneRepoBtn.addEventListener('click', showCloneRepoDialog)
cloneRepoSidebarBtn?.addEventListener('click', showCloneRepoDialog)

renderRecentRepos()
populateRepoSwitcher()

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
    themeToggleBtn.textContent = saved === 'light' ? '🌙' : '☀️'
    themeToggleBtn.title = saved === 'light' ? '切换深色' : '切换浅色'
}

themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark'
    const next = current === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem(THEME_KEY, next)
    themeToggleBtn.textContent = next === 'light' ? '🌙' : '☀️'
    themeToggleBtn.title = next === 'light' ? '切换深色' : '切换浅色'
})

initTheme()

closeRepoBtn.addEventListener('click', () => closeCurrentRepositoryView())

refreshBtn.addEventListener('click', async () => {
    if (currentRepoPath) await loadRepoData()
})

fetchBtn.addEventListener('click', () => {
    if (!currentRepoPath) return
    runSyncStatusDialog('Fetch', () => window.gitAPI.fetch(currentRepoPath))
})

function switchView(viewName) {
    navItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewName))
    settingsBtn?.classList.toggle('active', viewName === 'settings')
    views.forEach(v => v.classList.remove('active'))
    document.getElementById(`${viewName}-view`)?.classList.add('active')
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        switchView(item.dataset.view)
    })
})

settingsBtn?.addEventListener('click', async () => {
    switchView('settings')
    if (currentRepoPath) await loadSettings()
})

async function applyStatusToUi(status) {
    const conflictCount = status.conflicted?.length || 0
    currentOperationState = await window.gitAPI.getOperationState(currentRepoPath)

    if (currentOperationState.squashInProgress) {
        pendingSquashMerge = true
    } else if (pendingSquashMerge) {
        // 冲突全部「已解决」后 Git 可能暂时识别不到 squash 状态，会话内保持横幅直至提交或中止
        currentOperationState = {
            ...currentOperationState,
            squashInProgress: true,
            mergeConflicts: true,
            inProgress: true,
            conflictCount
        }
    }

    updateBranchHeader(status)
    renderOperationBanner(currentOperationState, conflictCount)
    renderChanges(status)
    currentBranchName = status.current || ''
}

/** 仅刷新变更区与分支状态（文件监听触发，避免整页重载） */
async function loadChangesOnly() {
    if (!currentRepoPath) return
    if (changesLoadInFlight) {
        pendingChangesLoad = true
        return
    }
    changesLoadInFlight = true
    try {
        const status = await window.gitAPI.getStatus(currentRepoPath)
        await applyStatusToUi(status)
    } catch (error) {
        console.error(error)
    } finally {
        changesLoadInFlight = false
        if (pendingChangesLoad) {
            pendingChangesLoad = false
            loadChangesOnly()
        }
    }
}

async function loadRepoData() {
    try {
        setStatus('加载中...')
        const status = await window.gitAPI.getStatus(currentRepoPath)
        await applyStatusToUi(status)

        if (!historyLogBranch) {
            historyLogBranch = currentBranchName
        }
        await loadCommitHistoryForBranch(historyLogBranch)
        const branches = await window.gitAPI.getBranches(currentRepoPath)
        renderBranches(branches)

        const stashes = await window.gitAPI.getStashList(currentRepoPath)
        renderStashes(stashes)

        const tagData = await window.gitAPI.getTags(currentRepoPath)
        renderTags(tagData)

        setStatus('就绪')
    } catch (error) {
        setStatus('错误: ' + error.message)
        console.error(error)
    }
}

window.addEventListener('focus', () => {
    if (currentRepoPath) scheduleChangesRefresh()
})

function updateBranchHeader(status) {
    currentBranchName = status.current || ''
    currentBranch.textContent = status.current || 'unknown'
    if (status.tracking) {
        const ahead = status.ahead || 0
        const behind = status.behind || 0
        trackingInfo.textContent = `↑${ahead} ↓${behind}`
        trackingInfo.title = `跟踪 ${status.tracking}，领先 ${ahead}，落后 ${behind}`
        trackingInfo.style.display = 'inline-flex'
    } else if (status.hasRemotes) {
        trackingInfo.textContent = '未关联远程'
        trackingInfo.title = '已配置远程仓库，但当前分支尚未设置上游；Push 时可自动关联'
        trackingInfo.style.display = 'inline-flex'
    } else {
        trackingInfo.textContent = '无远程'
        trackingInfo.title = '尚未绑定远程仓库，Push 前需先添加远程地址'
        trackingInfo.style.display = 'inline-flex'
    }
}

function getRelativeDir(filePath) {
    const normalized = filePath.replace(/\\/g, '/')
    const idx = normalized.lastIndexOf('/')
    return idx === -1 ? '' : normalized.slice(0, idx)
}

function getFileBaseName(filePath) {
    const normalized = filePath.replace(/\\/g, '/')
    const idx = normalized.lastIndexOf('/')
    return idx === -1 ? normalized : normalized.slice(idx + 1)
}

function getFileExtension(filePath) {
    const base = getFileBaseName(filePath)
    const idx = base.lastIndexOf('.')
    if (idx <= 0 || idx === base.length - 1) return ''
    return base.slice(idx + 1).toLowerCase()
}

function resolveChangeState(file, isConflict) {
    if (isConflict || file.index === 'U' || file.working_dir === 'U') return 'Conflict'
    const i = file.index
    const w = file.working_dir
    if (i === 'D' || w === 'D') return 'Deleted'
    if (i === '?' || w === '?' || i === 'A' || w === 'A') return 'New'
    if (i === 'M' || w === 'M' || i === 'R' || w === 'R') return 'Modified'
    return 'Modified'
}

function buildChangeFileRows(files, conflicted) {
    const conflictSet = new Set(conflicted || [])
    const rows = (files || []).map(file => {
        const state = resolveChangeState(file, file.conflicted || conflictSet.has(file.path))
        return {
            path: file.path,
            name: getFileBaseName(file.path),
            dir: getRelativeDir(file.path),
            state,
            index: file.index,
            working_dir: file.working_dir,
            isUntracked: file.index === '?' || file.working_dir === '?'
        }
    })
    rows.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }))
    return rows
}

function normalizeDiffLines(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    if (lines.length && lines[lines.length - 1] === '') lines.pop()
    return lines
}

/** 基于 LCS 的逐行 diff，插入/删除行不会导致后续相同行错位（与历史页对比一致） */
function diffLinesLCS(oldLines, newLines) {
    const n = oldLines.length
    const m = newLines.length
    if (n === 0 && m === 0) return []

    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            if (oldLines[i] === newLines[j]) {
                dp[i][j] = dp[i + 1][j + 1] + 1
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
            }
        }
    }

    const ops = []
    let i = 0
    let j = 0
    while (i < n && j < m) {
        if (oldLines[i] === newLines[j]) {
            ops.push({ type: 'equal', left: oldLines[i], right: newLines[j] })
            i++
            j++
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ type: 'del', left: oldLines[i], right: null })
            i++
        } else {
            ops.push({ type: 'add', left: null, right: newLines[j] })
            j++
        }
    }
    while (i < n) {
        ops.push({ type: 'del', left: oldLines[i], right: null })
        i++
    }
    while (j < m) {
        ops.push({ type: 'add', left: null, right: newLines[j] })
        j++
    }
    return ops
}

function renderSplitDiffRow(type, text) {
    if (type === 'equal') {
        return `<div class="split-diff-line">${escapeHtml(text ?? '')}</div>`
    }
    if (type === 'empty') {
        return '<div class="split-diff-line split-diff-line--empty"></div>'
    }
    const cls = type === 'del' ? 'split-diff-line--del' : 'split-diff-line--add'
    return `<div class="split-diff-line ${cls}">${escapeHtml(text ?? '')}</div>`
}

/** 滚动条旁改动概览条（类似 IDE 在滚动条轨道上的小横条） */
function buildScrollbarMapHtml(changedLineIndices, totalLines) {
    if (!totalLines || !changedLineIndices.length) return ''
    return changedLineIndices.map((index) => {
        const topPct = ((index + 0.5) / totalLines) * 100
        return `<button type="button" class="split-diff-scrollbar-map__mark" data-line-index="${index}" style="top: ${topPct}%" title="跳转到此处改动"></button>`
    }).join('')
}

function buildAlignedSplitDiff(beforeText, afterText) {
    const beforeLines = normalizeDiffLines(beforeText)
    const afterLines = normalizeDiffLines(afterText)
    const ops = diffLinesLCS(beforeLines, afterLines)

    let leftHtml = ''
    let rightHtml = ''
    let lineIndex = 0
    const changedLineIndices = []
    for (const op of ops) {
        if (op.type === 'equal') {
            leftHtml += renderSplitDiffRow('equal', op.left)
            rightHtml += renderSplitDiffRow('equal', op.right)
        } else if (op.type === 'del') {
            leftHtml += renderSplitDiffRow('del', op.left)
            rightHtml += renderSplitDiffRow('empty', null)
        } else if (op.type === 'add') {
            leftHtml += renderSplitDiffRow('empty', null)
            rightHtml += renderSplitDiffRow('add', op.right)
            changedLineIndices.push(lineIndex)
        }
        lineIndex++
    }

    const scrollbarMapHtml = buildScrollbarMapHtml(changedLineIndices, lineIndex)
    return { leftHtml, rightHtml, scrollbarMapHtml }
}

function isBinaryDiffText(text) {
    return text && /\0/.test(String(text).slice(0, 8000))
}

function renderSplitDiffPanel(leftLabel, rightLabel, leftHtml, rightHtml, scrollbarMapHtml = '') {
    return `
        <div class="split-diff">
            <div class="split-diff-head">
                <div class="split-diff-pane__header">${escapeHtml(leftLabel)}</div>
                <div class="split-diff-pane__header">${escapeHtml(rightLabel)}</div>
            </div>
            <div class="split-diff-body">
                <div class="split-diff-col split-diff-col--before">${leftHtml}</div>
                <div class="split-diff-col split-diff-col--after">
                    <div class="split-diff-col-inner">
                        <div class="split-diff-lines">${rightHtml}</div>
                    </div>
                    <div class="split-diff-scrollbar-map" title="点击红色标记跳转到对应改动">
                        ${scrollbarMapHtml}
                    </div>
                </div>
            </div>
        </div>
    `
}

function scrollSplitDiffToLine(lineIndex) {
    const leftCol = splitDiffBody?.querySelector('.split-diff-col--before')
    const rightScroll = splitDiffBody?.querySelector('.split-diff-col--after .split-diff-col-inner')
    if (!leftCol || !rightScroll) return

    const leftLine = leftCol.querySelectorAll('.split-diff-line')[lineIndex]
    const rightLine = rightScroll.querySelectorAll('.split-diff-line')[lineIndex]
    if (!leftLine && !rightLine) return

    const scrollToLine = (scrollEl, lineEl) => {
        if (!scrollEl || !lineEl) return
        const lineRect = lineEl.getBoundingClientRect()
        const scrollRect = scrollEl.getBoundingClientRect()
        const relativeTop = lineRect.top - scrollRect.top + scrollEl.scrollTop
        scrollEl.scrollTop = Math.max(0, relativeTop - scrollEl.clientHeight / 2 + lineEl.offsetHeight / 2)
    }

    scrollToLine(leftCol, leftLine)
    scrollToLine(rightScroll, rightLine)

    splitDiffBody?.querySelectorAll('.split-diff-line--jump').forEach((el) => {
        el.classList.remove('split-diff-line--jump')
    })
    ;[leftLine, rightLine].forEach((el) => {
        if (!el) return
        el.classList.add('split-diff-line--jump')
        setTimeout(() => el.classList.remove('split-diff-line--jump'), 1400)
    })
}

function bindSplitDiffScrollSync() {
    const leftCol = splitDiffBody?.querySelector('.split-diff-col--before')
    const rightScroll = splitDiffBody?.querySelector('.split-diff-col--after .split-diff-col-inner')
    if (!leftCol || !rightScroll) return

    let syncing = false

    const syncScroll = (source, target) => {
        if (syncing) return
        syncing = true
        target.scrollTop = source.scrollTop
        target.scrollLeft = source.scrollLeft
        syncing = false
    }

    leftCol.addEventListener('scroll', () => syncScroll(leftCol, rightScroll), { passive: true })
    rightScroll.addEventListener('scroll', () => syncScroll(rightScroll, leftCol), { passive: true })
}

function bindSplitDiffScrollbarMapClicks() {
    const map = splitDiffBody?.querySelector('.split-diff-scrollbar-map')
    if (!map) return

    map.querySelectorAll('.split-diff-scrollbar-map__mark').forEach((mark) => {
        mark.addEventListener('click', (e) => {
            e.stopPropagation()
            const lineIndex = Number.parseInt(mark.dataset.lineIndex, 10)
            if (Number.isNaN(lineIndex)) return
            scrollSplitDiffToLine(lineIndex)
        })
    })
}

function mountAlignedSplitDiff(leftLabel, rightLabel, leftText, rightText) {
    if (isBinaryDiffText(leftText) || isBinaryDiffText(rightText)) {
        splitDiffBody.innerHTML = '<div class="split-diff-empty">二进制文件，无法在窗口内预览</div>'
        return
    }
    const { leftHtml, rightHtml, scrollbarMapHtml } = buildAlignedSplitDiff(leftText, rightText)
    splitDiffBody.innerHTML = renderSplitDiffPanel(leftLabel, rightLabel, leftHtml, rightHtml, scrollbarMapHtml)
    bindSplitDiffScrollSync()
    bindSplitDiffScrollbarMapClicks()
}

function renderChanges(status) {
    cachedChangeFiles = buildChangeFileRows(status.files, status.conflicted)
    const tbody = changeFileList
    if (!tbody) return

    if (!cachedChangeFiles.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="changes-table-empty">工作区干净，没有待提交的更改</td></tr>`
        if (commitFabBtn) commitFabBtn.disabled = true
        if (commitFabBtn) {
            commitFabBtn.textContent = 'Commit'
            commitFabBtn.title = '提交全部变更'
        }
        return
    }

    if (commitFabBtn) {
        commitFabBtn.disabled = false
        commitFabBtn.textContent = 'Commit'
        commitFabBtn.title = '提交全部变更'
    }
    tbody.innerHTML = cachedChangeFiles.map(row => {
        const path = escapeAttr(row.path)
        const stateClass = `change-state change-state--${row.state.toLowerCase()}`
        const ignoreAction = row.state === 'New'
            ? `<button type="button" class="btn btn-ghost btn-sm change-row-action" data-action="ignore-choose" data-path="${path}" data-dir="${escapeAttr(row.dir || '.')}" data-ext="${escapeAttr(getFileExtension(row.path))}">Ignore</button>`
            : ''
        const discardAction = row.state === 'Conflict'
            ? ''
            : `<button type="button" class="btn btn-ghost btn-sm change-row-action" data-action="discard-file" data-path="${path}">Discard</button>`
        const resolvedAction = row.state === 'Conflict'
            ? `<button type="button" class="btn btn-primary btn-sm change-row-action" data-action="mark-resolved" data-path="${path}">已解决</button>`
            : ''
        return `
            <tr class="change-file-row" data-filepath="${path}" data-state="${escapeAttr(row.state)}" title="双击查看修改前后对比">
                <td class="change-file-name">${escapeHtml(row.name)}</td>
                <td><span class="${stateClass}">${escapeHtml(row.state)}</span></td>
                <td class="change-file-dir">${escapeHtml(row.dir || '.')}</td>
                <td class="changes-table__actions"><div class="changes-table__actions-wrap">${resolvedAction}${ignoreAction}${discardAction}</div></td>
            </tr>
        `
    }).join('')

    tbody.querySelectorAll('.change-row-action').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation()
            const filePath = btn.dataset.path
            if (btn.dataset.action === 'ignore-choose') {
                await showIgnoreChoiceDialog(filePath, btn.dataset.ext, btn.dataset.dir)
            }
            if (btn.dataset.action === 'discard-file') {
                await discardSingleFile(filePath)
            }
            if (btn.dataset.action === 'mark-resolved') {
                await markFileResolved(filePath)
            }
        })
    })

    tbody.querySelectorAll('.change-file-row').forEach(row => {
        row.addEventListener('dblclick', () => {
            showWorkingFileSplitDialog(row.dataset.filepath, row.dataset.state)
        })
    })
}

async function readWorkingFileSafe(filePath) {
    try {
        const result = await window.gitAPI.readWorkingFile(currentRepoPath, filePath)
        return { content: result.content ?? '', exists: true }
    } catch {
        return { content: '', exists: false }
    }
}

async function resolveWorkingDiffSides(filePath, state, row) {
    const [headSnap, indexSnap, workingSnap] = await Promise.all([
        window.gitAPI.getHeadFileSnapshot(currentRepoPath, filePath),
        window.gitAPI.getIndexFileSnapshot(currentRepoPath, filePath),
        readWorkingFileSafe(filePath)
    ])

    if (state === 'New') {
        return {
            leftLabel: '（新文件）',
            rightLabel: '工作区',
            leftText: '',
            rightText: workingSnap.exists ? workingSnap.content : ''
        }
    }
    if (state === 'Deleted') {
        return {
            leftLabel: '修改前 (HEAD)',
            rightLabel: '（已删除）',
            leftText: headSnap.exists ? headSnap.content : '',
            rightText: ''
        }
    }
    if (state === 'Conflict') {
        return {
            leftLabel: '修改前 (HEAD)',
            rightLabel: '工作区（含冲突标记）',
            leftText: headSnap.exists ? headSnap.content : '',
            rightText: workingSnap.exists ? workingSnap.content : ''
        }
    }

    const indexState = row?.index ?? ' '
    const workingState = row?.working_dir ?? ' '
    const stagedOnly = indexState !== ' ' && indexState !== '?'
        && (workingState === ' ' || !workingState)

    if (stagedOnly && indexSnap.exists) {
        return {
            leftLabel: '修改前 (HEAD)',
            rightLabel: '修改后 (暂存区)',
            leftText: headSnap.exists ? headSnap.content : '',
            rightText: indexSnap.content
        }
    }

    return {
        leftLabel: '修改前 (HEAD)',
        rightLabel: '修改后 (工作区)',
        leftText: headSnap.exists ? headSnap.content : '',
        rightText: workingSnap.exists ? workingSnap.content : ''
    }
}

async function showWorkingFileSplitDialog(filePath, state) {
    if (!currentRepoPath || !filePath) return

    splitDiffTitle.textContent = filePath
    splitDiffBody.innerHTML = '<p class="dialog-hint" style="padding:16px">加载对比…</p>'
    splitDiffOverlay.style.display = 'flex'

    try {
        const row = cachedChangeFiles.find((item) => item.path === filePath)
        const { leftLabel, rightLabel, leftText, rightText } = await resolveWorkingDiffSides(
            filePath,
            state || row?.state,
            row
        )
        mountAlignedSplitDiff(leftLabel, rightLabel, leftText, rightText)
    } catch (error) {
        splitDiffBody.innerHTML = `<div class="split-diff-empty">加载失败: ${escapeHtml(error.message)}</div>`
    }
}

function showCommitDialog() {
    showDialog(
        '提交更改',
        `<label class="dialog-label" for="commit-msg-input">提交说明</label>
        <textarea id="commit-msg-input" class="field-textarea commit-msg-input" placeholder="描述本次更改…" rows="5" spellcheck="false"></textarea>`,
        async () => {
            const message = document.getElementById('commit-msg-input')?.value.trim()
            if (!message) {
                await showAppAlert('请输入提交说明')
                return
            }
            try {
                setStatus('正在提交...')
                await window.gitAPI.addAll(currentRepoPath)
                await window.gitAPI.commit(currentRepoPath, message)
                pendingSquashMerge = false
                pendingSquashMergeSourceBranch = ''
                await loadRepoData()
                setStatus('提交成功')
            } catch (error) {
                await showAppAlert('提交失败: ' + error.message)
                setStatus('就绪')
            }
        }
    )
    setTimeout(() => {
        const input = document.getElementById('commit-msg-input')
        if (!input) return
        input.focus()
    }, 0)
}

commitFabBtn?.addEventListener('click', () => {
    if (!currentRepoPath) return
    if (!cachedChangeFiles.length) {
        showAppAlert('没有可提交的更改', { variant: 'info' })
        return
    }
    showCommitDialog()
})

function hideContextMenu() {
    if (contextMenuEl) contextMenuEl.style.display = 'none'
    contextMenuState = null
}

function showContextMenu(x, y, items) {
    if (!contextMenuEl) return
    contextMenuEl.innerHTML = items.map(item => {
        if (item.divider) return '<div class="context-menu-divider"></div>'
        const cls = ['context-menu-item', item.danger ? 'danger' : ''].filter(Boolean).join(' ')
        return `<button type="button" class="${cls}" data-action="${escapeAttr(item.action)}" ${item.disabled ? 'disabled' : ''}>${escapeHtml(item.label)}</button>`
    }).join('')
    contextMenuEl.style.display = 'block'
    contextMenuEl.style.visibility = 'hidden'
    const rect = contextMenuEl.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - 8
    const maxY = window.innerHeight - rect.height - 8
    contextMenuEl.style.left = `${Math.max(8, Math.min(x, maxX))}px`
    contextMenuEl.style.top = `${Math.max(8, Math.min(y, maxY))}px`
    contextMenuEl.style.visibility = 'visible'

    contextMenuEl.querySelectorAll('.context-menu-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            if (btn.disabled || !contextMenuState) return
            const action = btn.dataset.action
            const { branchName, branchType, isCurrent } = contextMenuState
            hideContextMenu()
            if (branchType === 'local') {
                if (action === 'log') viewBranchLog(branchName)
                if (action === 'checkout') checkoutBranch(branchName)
                if (action === 'merge') mergeBranch(branchName)
                if (action === 'rebase') rebaseOntoBranch(branchName)
                if (action === 'rename') showRenameBranchDialog(branchName)
                if (action === 'delete') deleteBranch(branchName)
            } else if (branchType === 'remote') {
                if (action === 'log') viewBranchLog(branchName)
                if (action === 'checkout-remote') checkoutRemoteBranch(branchName)
            } else if (branchType === 'commit') {
                const hash = branchName
                if (action === 'cherry-pick') cherryPickCommit(hash)
                if (action === 'reset') showResetCommitDialog(hash)
            }
        })
    })
}

function showLocalBranchContextMenu(e, branch) {
    e.preventDefault()
    const items = [{ label: 'Log', action: 'log' }]
    if (branch.current) {
        items.push(
            { label: '当前分支', action: 'noop', disabled: true },
            { divider: true },
            { label: 'Rename', action: 'rename' }
        )
    } else {
        items.push(
            { divider: true },
            { label: 'Checkout', action: 'checkout' },
            { label: 'Merge', action: 'merge' },
            { label: 'Rebase', action: 'rebase' },
            { divider: true },
            { label: 'Rename', action: 'rename' },
            { label: 'Delete', action: 'delete', danger: true }
        )
    }
    contextMenuState = { branchName: branch.name, branchType: 'local', isCurrent: !!branch.current }
    showContextMenu(e.clientX, e.clientY, items)
}

function showRemoteBranchContextMenu(e, branch) {
    e.preventDefault()
    contextMenuState = { branchName: branch.name, branchType: 'remote', isCurrent: false }
    showContextMenu(e.clientX, e.clientY, [
        { label: 'Log', action: 'log' },
        { divider: true },
        { label: 'Checkout', action: 'checkout-remote' }
    ])
}

function switchToHistoryView() {
    switchView('history')
}

function updateHistoryBranchHint() {
    const el = document.getElementById('history-branch-hint')
    if (!el || !historyLogBranch) return
    const viewingCurrent = historyLogBranch === currentBranchName
    if (viewingCurrent) {
        el.textContent = `正在查看当前分支「${historyLogBranch}」的提交；Cherry-pick 仅适用于其他分支的提交`
    } else {
        el.textContent = `正在查看分支「${historyLogBranch}」的提交；可将提交 Cherry-pick 到当前分支「${currentBranchName}」`
    }
}

function isViewingCurrentBranchLog() {
    return !!historyLogBranch && historyLogBranch === currentBranchName
}

async function loadCommitHistoryForBranch(branchName, maxCount = 100) {
    if (!currentRepoPath || !branchName) return
    try {
        setStatus(`加载 ${branchName} 提交历史...`)
        const log = await window.gitAPI.getLogForBranch(currentRepoPath, branchName, maxCount)
        cachedCommits = log
        renderCommits(log)
        updateHistoryBranchHint()
        setStatus('就绪')
    } catch (error) {
        commitList.innerHTML = `<div class="empty-state"><p>加载失败: ${escapeHtml(error.message)}</p></div>`
        setStatus('错误')
    }
}

async function viewBranchLog(branchName) {
    if (!currentRepoPath || !branchName) return
    historyLogBranch = branchName
    commitSearchInput.value = ''
    switchToHistoryView()
    await loadCommitHistoryForBranch(branchName)
}

async function checkoutRemoteBranch(remoteName) {
    try {
        setStatus(`正在检出 ${remoteName}...`)
        const result = await window.gitAPI.checkoutRemote(currentRepoPath, remoteName)
        historyLogBranch = result.branch || remoteName
        await loadRepoData()
        setStatus(`已切换到 ${result.branch}`)
    } catch (error) {
        await showAppAlert('检出远程分支失败: ' + error.message)
        setStatus('就绪')
    }
}

document.addEventListener('click', hideContextMenu)
document.addEventListener('scroll', hideContextMenu, true)
window.addEventListener('resize', hideContextMenu)

function renderOperationBanner(opState, conflictCount) {
    const count = conflictCount || opState?.conflictCount || 0
    if (!opState?.inProgress) {
        operationBanner.style.display = 'none'
        opContinueBtn.textContent = '继续'
        return
    }

    operationBanner.style.display = 'flex'
    opContinueBtn.style.display = 'inline-block'
    opAbortBtn.style.display = 'inline-block'
    opSkipBtn.style.display = (opState.rebase || opState.cherryPick) ? 'inline-block' : 'none'

    if (opState.mergeConflicts && !opState.merge) {
        operationTitle.textContent = count > 0 ? '合并冲突' : '待完成合并'
        operationDesc.textContent = count > 0
            ? `· ${count} 个文件待解决，解决后点「已解决」，全部完成后点「完成合并」`
            : '· 冲突已处理完毕，请点击「完成合并」自动生成合并提交'
        opContinueBtn.textContent = '完成合并'
        return
    }

    opContinueBtn.textContent = '继续'

    if (opState.rebase) {
        operationTitle.textContent = 'Rebase'
        operationDesc.textContent = count > 0
            ? `· ${count} 个冲突，解决后点「已解决」再「继续」`
            : '· 可继续或跳过'
    } else if (opState.cherryPick) {
        operationTitle.textContent = 'Cherry-pick'
        operationDesc.textContent = count > 0
            ? `· ${count} 个冲突，解决后点「已解决」再「继续」`
            : '· 可继续或跳过'
    } else if (opState.merge) {
        operationTitle.textContent = '合并'
        operationDesc.textContent = count > 0
            ? `· ${count} 个冲突，解决后点「已解决」再「继续」`
            : '· 可继续完成'
    }
}

opContinueBtn.addEventListener('click', async () => {
    if (!currentRepoPath || !currentOperationState) return
    try {
        setStatus('正在继续...')
        if (currentOperationState.rebase) {
            await window.gitAPI.rebaseContinue(currentRepoPath)
        } else if (currentOperationState.cherryPick) {
            await window.gitAPI.cherryPickContinue(currentRepoPath)
        } else if (currentOperationState.mergeConflicts && !currentOperationState.merge) {
            const status = await window.gitAPI.getStatus(currentRepoPath)
            if ((status.conflicted || []).length > 0) {
                await showAppAlert('仍有未解决的冲突，请先在编辑器中处理冲突标记后再点「完成合并」。', { variant: 'warning' })
                return
            }
            setStatus('正在完成合并...')
            const result = await window.gitAPI.finishSquashMerge(
                currentRepoPath,
                pendingSquashMergeSourceBranch
            )
            pendingSquashMerge = false
            pendingSquashMergeSourceBranch = ''
            await loadRepoData()
            setStatus('合并完成')
            await showAppAlert(
                `已自动创建合并提交。\n\n${result?.message || ''}`,
                { variant: 'success', title: '完成合并' }
            )
            return
        } else if (currentOperationState.merge) {
            await window.gitAPI.mergeContinue(currentRepoPath)
        }
        await loadRepoData()
        setStatus('操作已继续')
    } catch (error) {
        await showAppAlert('继续失败: ' + error.message + '\n\n请确认所有冲突已解决并已标记。')
        await loadRepoData()
        setStatus('就绪')
    }
})

opSkipBtn.addEventListener('click', async () => {
    if (!(await showAppConfirm('确定要跳过当前提交吗？'))) return
    try {
        setStatus('正在跳过...')
        if (currentOperationState?.cherryPick) {
            await window.gitAPI.cherryPickSkip(currentRepoPath)
        } else {
            await window.gitAPI.rebaseSkip(currentRepoPath)
        }
        await loadRepoData()
        setStatus('已跳过')
    } catch (error) {
        await showAppAlert('跳过失败: ' + error.message)
        setStatus('就绪')
    }
})

opAbortBtn.addEventListener('click', async () => {
    const squashConflictAbort = currentOperationState?.mergeConflicts && !currentOperationState?.merge
    const abortMsg = squashConflictAbort
        ? '确定要放弃本次合并吗？\n\n将丢弃工作区中所有未提交改动（git reset --hard），此操作不可恢复。'
        : '确定要中止当前操作吗？'
    if (!(await showAppConfirm(abortMsg, { variant: 'warning', danger: squashConflictAbort }))) return
    try {
        setStatus('正在中止...')
        if (currentOperationState?.rebase) {
            await window.gitAPI.rebaseAbort(currentRepoPath)
        } else if (currentOperationState?.cherryPick) {
            await window.gitAPI.cherryPickAbort(currentRepoPath)
        } else if (currentOperationState?.merge || currentOperationState?.mergeConflicts) {
            await window.gitAPI.mergeAbort(currentRepoPath)
        }
        pendingSquashMerge = false
        pendingSquashMergeSourceBranch = ''
        await loadRepoData()
        setStatus('已中止')
        await showAppAlert('操作已中止')
    } catch (error) {
        await showAppAlert('中止失败: ' + error.message)
        setStatus('就绪')
    }
})

async function markFileResolved(filePath) {
    try {
        setStatus(`标记已解决: ${filePath}`)
        await window.gitAPI.markResolved(currentRepoPath, filePath)
        await loadRepoData()
        const status = await window.gitAPI.getStatus(currentRepoPath)
        const left = (status.conflicted || []).length
        if (left > 0) {
            setStatus(`已标记，还有 ${left} 个冲突文件`)
        } else if (currentOperationState?.mergeConflicts || pendingSquashMerge) {
            setStatus('冲突已处理完毕，请点击「完成合并」')
        } else {
            setStatus('已标记为已解决')
        }
    } catch (error) {
        await showAppAlert('标记失败: ' + error.message)
        setStatus('就绪')
    }
}

function formatRelativeTime(dateStr) {
    const date = new Date(dateStr)
    const diff = Date.now() - date.getTime()
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return '刚刚'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min} 分钟前`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} 小时前`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day} 天前`
    return date.toLocaleDateString()
}

function getHeadCommitHash(commits) {
    const head = (commits || []).find(c => c.refs && /\bHEAD\b/.test(c.refs))
    return head?.hash || null
}

function isHeadCommit(hash) {
    return hash === getHeadCommitHash(cachedCommits)
}

function showCommitContextMenu(e, hash) {
    e.preventDefault()
    const isHead = isHeadCommit(hash)
    const viewingCurrent = isViewingCurrentBranchLog()
    contextMenuState = { branchName: hash, branchType: 'commit', isCurrent: isHead }
    showContextMenu(e.clientX, e.clientY, [
        {
            label: 'Cherry-pick',
            action: 'cherry-pick',
            disabled: viewingCurrent
        },
        { divider: true },
        {
            label: '回滚到此提交',
            action: 'reset',
            disabled: isHead || !viewingCurrent
        }
    ])
}

function getStatusClass(status) {
    const s = (status || '').charAt(0).toUpperCase()
    if (s === 'M') return 'status-M'
    if (s === 'A') return 'status-A'
    if (s === 'D') return 'status-D'
    if (s === 'R') return 'status-M'
    if (s === 'U' || s === 'C') return 'status-conflict'
    return 'status-question'
}

async function showCommitFilesDialog(hash) {
    if (!currentRepoPath || !hash) return
    const commit = cachedCommits.find(c => c.hash === hash)
    const short = hash.substring(0, 7)
    const title = commit
        ? `${short} — ${commit.message.split('\n')[0]}`
        : `提交 ${short}`

    showDialog(title, '<p class="dialog-hint">加载改动文件…</p>', null, { wide: true })

    try {
        const { files } = await window.gitAPI.getCommitFiles(currentRepoPath, hash)
        if (!files || files.length === 0) {
            dialogBody.innerHTML = '<p class="dialog-hint">此提交没有文件改动</p>'
            return
        }

        const listHtml = files.map(file => {
            const statusClass = getStatusClass(file.status)
            const path = escapeAttr(file.path)
            const status = escapeAttr(file.status)
            return `
                <div class="commit-file-dialog-item file-item" data-filepath="${path}" data-status="${status}" title="双击查看左右对比">
                    <div class="file-info">
                        <span class="file-status ${statusClass}">${escapeHtml(file.status)}</span>
                        <span class="file-path">${escapeHtml(file.path)}</span>
                    </div>
                </div>
            `
        }).join('')

        dialogBody.innerHTML = `
            <p class="dialog-hint">共 ${files.length} 个文件，双击查看左右对比</p>
            <div class="commit-files-dialog-list">${listHtml}</div>
        `

        dialogBody.querySelectorAll('.commit-file-dialog-item').forEach(item => {
            item.addEventListener('dblclick', () => {
                showCommitFileSplitDialog(hash, item.dataset.filepath, item.dataset.status)
            })
        })
    } catch (error) {
        dialogBody.innerHTML = `<p class="dialog-hint">加载失败: ${escapeHtml(error.message)}</p>`
    }
}

async function showCommitFileSplitDialog(hash, filePath, status) {
    if (!currentRepoPath || !hash || !filePath) return

    splitDiffTitle.textContent = filePath
    splitDiffBody.innerHTML = '<p class="dialog-hint" style="padding:16px">加载对比…</p>'
    splitDiffOverlay.style.display = 'flex'

    try {
        const [parentSnap, commitSnap] = await Promise.all([
            window.gitAPI.getCommitFileSnapshot(currentRepoPath, hash, filePath, 'parent'),
            window.gitAPI.getCommitFileSnapshot(currentRepoPath, hash, filePath, 'commit')
        ])

        let leftLabel = '修改前'
        let rightLabel = '修改后'
        if (status === 'A') leftLabel = '（新增文件）'
        else if (status === 'D') rightLabel = '（已删除）'

        mountAlignedSplitDiff(
            leftLabel,
            rightLabel,
            parentSnap.exists ? parentSnap.content : '',
            commitSnap.exists ? commitSnap.content : ''
        )
    } catch (error) {
        splitDiffBody.innerHTML = `<div class="split-diff-empty">加载失败: ${escapeHtml(error.message)}</div>`
    }
}

function hideSplitDiffDialog() {
    if (splitDiffOverlay) splitDiffOverlay.style.display = 'none'
}

splitDiffClose?.addEventListener('click', hideSplitDiffDialog)
splitDiffOverlay?.addEventListener('click', (e) => {
    if (e.target === splitDiffOverlay) hideSplitDiffDialog()
})

function showResetCommitDialog(hash) {
    const commit = cachedCommits.find(c => c.hash === hash)
    const short = hash.substring(0, 7)
    const msg = commit ? commit.message.split('\n')[0] : ''

    showDialog(
        `回滚到 ${short}`,
        `<p class="dialog-hint">将把<strong>当前分支</strong>移动到该提交。若之后还有未推送的提交，回滚后需 <code>git push --force</code> 才能同步远程（请谨慎）。</p>
        <p class="dialog-hint" style="margin-top:8px">${escapeHtml(msg)}</p>
        <label class="dialog-label" style="margin-top:12px">回滚模式</label>
        <select id="reset-mode" class="dialog-select">
            <option value="mixed" selected>混合 (--mixed)：保留工作区改动，取消暂存</option>
            <option value="soft">软 (--soft)：保留改动并保持暂存</option>
            <option value="hard">硬 (--hard)：丢弃工作区与暂存区所有未提交改动</option>
        </select>`,
        async () => {
            const mode = document.getElementById('reset-mode')?.value || 'mixed'
            if (mode === 'hard') {
                const status = await window.gitAPI.getStatus(currentRepoPath)
                let warn = '硬回滚会丢弃工作区与暂存区的所有未提交改动，且无法撤销。确定继续？'
                if (!status.isClean) {
                    warn = '工作区有未提交更改，硬回滚将永久丢失这些更改。确定继续？'
                }
                if (!(await showAppConfirm(warn, { variant: 'danger', danger: true }))) return
            } else if (!(await showAppConfirm(`确定以「${mode}」模式回滚到 ${short} 吗？`, { variant: 'warning' }))) {
                return
            }

            try {
                setStatus('正在回滚…')
                await window.gitAPI.resetToCommit(currentRepoPath, hash, mode)
                hideDialog()
                hideSplitDiffDialog()
                await loadRepoData()
                setStatus('回滚完成')
                await showAppAlert(`已回滚到 ${short}`)
            } catch (error) {
                await showAppAlert('回滚失败: ' + error.message)
                setStatus('就绪')
            }
        }
    )
}

function renderCommits(commits) {
    if (!commits || commits.length === 0) {
        commitList.innerHTML = '<div class="empty-state"><p>没有提交历史</p></div>'
        return
    }

    commitList.innerHTML = commits.map(commit => {
        const refs = commit.refs && commit.refs.trim()
            ? `<span class="commit-refs">${escapeHtml(commit.refs)}</span>`
            : ''
        const hash = escapeAttr(commit.hash)
        return `
            <div class="commit-item" data-hash="${hash}">
                <div class="commit-main" title="双击查看改动；右键操作">
                    <div class="commit-top">
                        <span class="commit-hash">${escapeHtml(commit.hash.substring(0, 7))}</span>
                        ${refs}
                    </div>
                    <div class="commit-item__message">${escapeHtml(commit.message)}</div>
                    <div class="commit-meta">${escapeHtml(commit.author)} • ${formatRelativeTime(commit.date)}</div>
                </div>
            </div>
        `
    }).join('')

    commitList.querySelectorAll('.commit-item').forEach(item => {
        item.addEventListener('dblclick', () => {
            showCommitFilesDialog(item.dataset.hash)
        })
        item.addEventListener('contextmenu', (e) => {
            showCommitContextMenu(e, item.dataset.hash)
        })
    })
}

branchList?.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.branch-item[data-branch-name]')
    if (!item) return
    const branch = cachedBranchData.local.find(b => b.name === item.dataset.branchName)
    if (!branch || branch.current) return
    checkoutBranch(branch.name)
})

branchList?.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.branch-item[data-branch-name]')
    if (!item) return
    const branch = cachedBranchData.local.find(b => b.name === item.dataset.branchName)
    if (branch) showLocalBranchContextMenu(e, branch)
})

remoteBranchList?.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.branch-item[data-branch-name]')
    if (!item) return
    const branch = cachedBranchData.remote.find(b => b.name === item.dataset.branchName)
    if (branch) checkoutRemoteBranch(branch.name)
})

remoteBranchList?.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.branch-item[data-branch-name]')
    if (!item) return
    const branch = cachedBranchData.remote.find(b => b.name === item.dataset.branchName)
    if (branch) showRemoteBranchContextMenu(e, branch)
})

function renderBranches(branchData) {
    cachedBranchData = {
        local: branchData?.local || [],
        remote: branchData?.remote || []
    }
    const local = cachedBranchData.local
    if (!local.length) {
        branchList.innerHTML = '<div class="empty-hint sidebar-empty">无本地分支</div>'
    } else {
        branchList.innerHTML = local.map(branch => renderLocalBranchItem(branch)).join('')
    }
    renderRemoteBranches(cachedBranchData.remote)
}

function renderLocalBranchItem(branch) {
    const shortHash = branch.commit ? branch.commit.substring(0, 7) : ''
    const name = escapeAttr(branch.name)
    return `
        <div class="branch-item ${branch.current ? 'current' : ''}" data-branch-name="${name}" title="${branch.current ? '当前分支' : '双击切换；右键操作'}">
            ${branch.current ? '<span class="branch-current-tag">Current</span>' : ''}
            <div class="branch-info">
                <span class="branch-name">${escapeHtml(branch.name)}</span>
                ${shortHash ? `<span class="branch-commit">${escapeHtml(shortHash)}</span>` : ''}
            </div>
        </div>
    `
}

function renderRemoteBranches(remote) {
    if (!remote.length) {
        remoteBranchList.innerHTML = '<div class="empty-hint sidebar-empty">无远程分支</div>'
        return
    }
    remoteBranchList.innerHTML = remote.map(branch => renderRemoteBranchItem(branch)).join('')
}

function renderRemoteBranchItem(branch) {
    const shortHash = branch.commit ? branch.commit.substring(0, 7) : ''
    const name = escapeAttr(branch.name)
    return `
        <div class="branch-item remote" data-branch-name="${name}" title="双击检出到本地；右键操作">
            <div class="branch-info">
                <span class="branch-name">${escapeHtml(branch.name)}</span>
                ${shortHash ? `<span class="branch-commit">${escapeHtml(shortHash)}</span>` : ''}
            </div>
        </div>
    `
}

function renderTags(tagData) {
    if (!tagList) return
    const tags = tagData?.tags || []
    if (!tags.length) {
        tagList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏷️</div><p>没有标签</p></div>'
        return
    }
    tagList.innerHTML = tags.map(tag => {
        const name = escapeAttr(tag.name)
        const shortHash = tag.hash ? tag.hash.substring(0, 7) : ''
        const msg = tag.message ? `<div class="tag-message">${escapeHtml(tag.message.split('\n')[0])}</div>` : ''
        return `
            <div class="tag-item">
                <div class="tag-info">
                    <span class="tag-name">🏷️ ${escapeHtml(tag.name)}</span>
                    ${shortHash ? `<span class="branch-commit">${escapeHtml(shortHash)}</span>` : ''}
                    ${msg}
                </div>
                <button class="btn btn-secondary btn-tiny tag-delete" data-tag="${name}" type="button">删除</button>
            </div>
        `
    }).join('')

    tagList.querySelectorAll('.tag-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteTag(btn.dataset.tag))
    })
}

pullBtn.addEventListener('click', () => {
    if (!currentRepoPath) return
    runSyncStatusDialog('Pull', () => window.gitAPI.pull(currentRepoPath))
})

pushBtn.addEventListener('click', async () => {
    if (!currentRepoPath) return
    const ready = await ensureRemoteReadyForPush()
    if (!ready) return
    openPushSyncDialog(ready)
})

async function checkoutBranch(branchName) {
    try {
        setStatus(`正在切换到 ${branchName}...`)
        await window.gitAPI.checkout(currentRepoPath, branchName)
        historyLogBranch = branchName
        await loadRepoData()
        setStatus('切换成功')
    } catch (error) {
        await showAppAlert('切换分支失败: ' + error.message)
        setStatus('就绪')
    }
}

function setStatus(text) {
    statusText.textContent = text
}

async function openFileInEditor(filePath) {
    if (!currentRepoPath || !filePath) return
    try {
        await window.gitAPI.openRepoFile(currentRepoPath, filePath)
    } catch (error) {
        await showAppAlert('打开文件失败: ' + error.message)
    }
}

async function ignoreFilePath(filePath) {
    if (!filePath) return
    if (!(await showAppConfirm(`将 "${filePath}" 添加到 .gitignore ？`))) return
    try {
        setStatus(`正在忽略 ${filePath}...`)
        await window.gitAPI.ignorePath(currentRepoPath, filePath)
        await loadRepoData()
        setStatus('已更新 .gitignore')
    } catch (error) {
        await showAppAlert('忽略失败: ' + error.message)
        setStatus('就绪')
    }
}

async function ignoreFileExtension(filePath) {
    const ext = getFileExtension(filePath)
    if (!ext) {
        await showAppAlert('该文件没有可忽略的后缀', { variant: 'warning' })
        return
    }
    if (!(await showAppConfirm(`将所有 .${ext} 文件添加到 .gitignore（*.${ext}）？`))) return
    try {
        setStatus(`正在忽略 *.${ext}...`)
        await window.gitAPI.ignorePath(currentRepoPath, filePath, 'extension')
        await loadRepoData()
        setStatus(`已更新 .gitignore（*.${ext}）`)
    } catch (error) {
        await showAppAlert('忽略后缀失败: ' + error.message)
        setStatus('就绪')
    }
}

async function ignoreDirectory(relativeDir) {
    if (!relativeDir || relativeDir === '.') return
    if (!(await showAppConfirm(`将目录 "${relativeDir}" 添加到 .gitignore（${relativeDir}/）？`))) return
    try {
        setStatus(`正在忽略目录 ${relativeDir}...`)
        await window.gitAPI.ignorePath(currentRepoPath, relativeDir, 'directory')
        await loadRepoData()
        setStatus(`已更新 .gitignore（${relativeDir}/）`)
    } catch (error) {
        await showAppAlert('忽略目录失败: ' + error.message)
        setStatus('就绪')
    }
}

async function showIgnoreChoiceDialog(filePath, ext, dir) {
    const options = [{ id: 'path', label: '忽略当前文件' }]
    if (ext) options.push({ id: 'extension', label: `忽略同后缀 (*.${ext})` })
    if (dir && dir !== '.') options.push({ id: 'directory', label: `忽略当前目录 (${dir}/)` })

    const html = options.map(opt => `
        <label class="ignore-choice-item">
            <input type="radio" name="ignore-mode" value="${opt.id}" ${opt.id === 'path' ? 'checked' : ''} />
            <span>${escapeHtml(opt.label)}</span>
        </label>
    `).join('')

    showDialog(
        '选择 Ignore 方式',
        `<div class="ignore-choice-list">${html}</div>`,
        async () => {
            const picked = dialogBody.querySelector('input[name="ignore-mode"]:checked')?.value || 'path'
            if (picked === 'path') await ignoreFilePath(filePath)
            if (picked === 'extension') await ignoreFileExtension(filePath)
            if (picked === 'directory' && dir && dir !== '.') await ignoreDirectory(dir)
        }
    )
}

async function discardSingleFile(filePath) {
    if (!filePath) return
    if (!(await showDiscardConfirm(filePath))) return
    try {
        setStatus(`正在 Discard ${filePath}...`)
        await window.gitAPI.discardFiles(currentRepoPath, [filePath])
        await loadRepoData()
        setStatus('Discard 完成')
    } catch (error) {
        await showAppAlert('Discard 失败: ' + error.message)
        setStatus('就绪')
    }
}

async function showIgnoreManageDialog() {
    if (!currentRepoPath) return
    try {
        const { entries } = await window.gitAPI.getIgnoreList(currentRepoPath)
        const listHtml = entries.length
            ? `<div class="ignore-entry-list">${entries.map(item => {
                const safe = escapeAttr(item)
                return `<div class="ignore-entry-item">
                    <code class="ignore-entry-text">${escapeHtml(item)}</code>
                    <button type="button" class="btn btn-ghost btn-sm ignore-remove-btn" data-entry="${safe}">取消忽略</button>
                </div>`
            }).join('')}</div>`
            : '<p class="dialog-hint">当前 .gitignore 没有可管理项</p>'
        showDialog('管理 .gitignore', listHtml, null, { wide: true })
        dialogBody.querySelectorAll('.ignore-remove-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const entry = btn.dataset.entry
                if (!(await showAppConfirm(`确定从 .gitignore 中移除 "${entry}"？`))) return
                try {
                    await window.gitAPI.removeIgnoreEntry(currentRepoPath, entry)
                    await loadRepoData()
                    await showIgnoreManageDialog()
                } catch (error) {
                    await showAppAlert('取消忽略失败: ' + error.message)
                }
            })
        })
    } catch (error) {
        await showAppAlert('读取 .gitignore 失败: ' + error.message)
    }
}

ignoreManageFabBtn?.addEventListener('click', () => {
    showIgnoreManageDialog()
})

function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

function escapeAttr(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
}

let dialogCallback = null
let dialogDismissCallback = null
let dialogMode = 'form'
let pendingModalResolve = null
let bindRemoteDialogResolve = null
let syncDialogBusy = false

function formatModalMessage(message) {
    const escaped = escapeHtml(String(message))
    const paragraphs = escaped.split(/\n\n+/).map(p => p.replace(/\n/g, '<br>'))
    if (paragraphs.length <= 1) {
        return `<p>${paragraphs[0] || ''}</p>`
    }
    return paragraphs.map(p => `<p>${p}</p>`).join('')
}

function buildModalMessageHtml(message, variant = 'default') {
    const icons = { default: '?', info: 'i', success: '✓', warning: '!', danger: '!' }
    return `
        <div class="modal-message modal-message--${variant}">
            <div class="modal-message__icon" aria-hidden="true">${icons[variant] || '?'}</div>
            <div class="modal-message__content">${formatModalMessage(message)}</div>
        </div>
    `
}

function resetDialogChrome() {
    dialogFooter?.querySelectorAll('.merge-footer-actions').forEach(el => el.remove())
    dialogConfirm.style.display = 'inline-block'
    dialogConfirm.textContent = '确定'
    dialogConfirm.className = 'btn btn-primary'
    dialogCancel.textContent = '取消'
    dialogCancel.disabled = false
    dialogCancel.style.display = 'inline-block'
    dialogClose.style.display = ''
    syncDialogBusy = false
    if (dialogPanel) {
        dialogPanel.classList.remove('dialog--wide', 'dialog--message', 'dialog--merge-choice', 'dialog--discard-confirm', 'dialog--sync')
    }
}

function buildSyncDialogBody(state, headline, detail) {
    const detailHtml = detail
        ? `<pre class="sync-output">${escapeHtml(detail)}</pre>`
        : ''
    return `<p class="sync-status sync-status--${state}">${escapeHtml(headline)}</p>${detailHtml}`
}

function openSyncDialogShell(title, bodyHtml, options = {}) {
    resetDialogChrome()
    dialogDismissCallback = null
    openDialogShell({ title, bodyHtml, mode: 'sync' })
    if (dialogPanel) dialogPanel.classList.add('dialog--sync')
    dialogConfirm.style.display = options.showConfirm ? 'inline-block' : 'none'
    if (options.confirmText) dialogConfirm.textContent = options.confirmText
    if (options.confirmClass) dialogConfirm.className = options.confirmClass
    dialogCancel.textContent = options.cancelText || '关闭'
    dialogCallback = options.onConfirm || null
}

async function runSyncStatusDialog(title, operationFn) {
    openSyncDialogShell(title, buildSyncDialogBody('loading', '正在执行，请稍候…', ''))
    syncDialogBusy = true
    dialogCallback = null
    dialogCancel.disabled = true
    dialogClose.style.display = 'none'

    try {
        setStatus(`正在 ${title}…`)
        const result = await operationFn()
        await loadRepoData()
        const detail = result?.summary || result?.output || '操作成功'
        dialogBody.innerHTML = buildSyncDialogBody('success', `${title} 完成`, detail)
        setStatus(`${title} 完成`)
    } catch (error) {
        dialogBody.innerHTML = buildSyncDialogBody('error', `${title} 失败`, error.message)
        setStatus('就绪')
    } finally {
        syncDialogBusy = false
        dialogCancel.disabled = false
        dialogClose.style.display = ''
    }
}

async function ensureRemoteReadyForPush() {
    let info
    try {
        info = await window.gitAPI.getRemotePushInfo(currentRepoPath)
    } catch (error) {
        await showAppAlert('无法读取远程配置: ' + error.message)
        return null
    }

    if (!info.hasRemotes) {
        const bound = await showBindRemoteDialog()
        if (!bound) return null
        try {
            info = await window.gitAPI.getRemotePushInfo(currentRepoPath)
        } catch (error) {
            await showAppAlert('无法读取远程配置: ' + error.message)
            return null
        }
        if (!info.hasRemotes) return null
    }

    const pushOptions = {}
    if (info.needsUpstream) {
        const remote = info.defaultRemote || 'origin'
        const branch = info.branch || '当前分支'
        const ok = await showAppConfirm(
            `当前分支「${branch}」尚未关联远程分支。\n\n继续 Push 将推送到 ${remote}/${branch}，并自动设置上游跟踪。`,
            { title: '设置上游并推送', confirmText: '继续 Push' }
        )
        if (!ok) return null
        pushOptions.remote = remote
        pushOptions.setUpstream = true
    }

    return pushOptions
}

function showBindRemoteDialog() {
    return new Promise((resolve) => {
        bindRemoteDialogResolve = resolve
        showDialog(
            '绑定远程仓库',
            `<p class="dialog-hint">当前仓库还没有远程地址，无法 Push。请填写远程仓库 URL（与克隆时相同）。</p>
            <label class="dialog-label" for="bind-remote-name">远程名称</label>
            <input type="text" id="bind-remote-name" class="dialog-input" value="origin" spellcheck="false" />
            <label class="dialog-label" for="bind-remote-url" style="margin-top:12px">远程仓库 URL</label>
            <input type="text" id="bind-remote-url" class="dialog-input" placeholder="https://github.com/user/repo.git 或 git@host:group/repo.git" spellcheck="false" />
            <p class="dialog-hint">支持 HTTPS、SSH（<code>ssh://…</code>）及 <code>git@主机:路径/仓库.git</code></p>`,
            async () => {
                const remoteName = document.getElementById('bind-remote-name')?.value.trim() || 'origin'
                const url = document.getElementById('bind-remote-url')?.value.trim()
                if (!url) {
                    await showAppAlert('请输入远程仓库 URL')
                    return
                }
                if (!isSupportedCloneUrl(url)) {
                    await showAppAlert('URL 格式不支持。请使用 https://、ssh://（含端口）或 git@主机:路径/仓库.git')
                    return
                }
                try {
                    setStatus('正在绑定远程…')
                    await window.gitAPI.addRemote(currentRepoPath, remoteName, url)
                    await loadRepoData()
                    setStatus('远程已绑定')
                    bindRemoteDialogResolve = null
                    hideDialog()
                    resolve(true)
                } catch (error) {
                    await showAppAlert('绑定失败: ' + error.message)
                    setStatus('就绪')
                }
            },
            { wide: true }
        )
        dialogConfirm.textContent = '绑定'
        setTimeout(() => {
            document.getElementById('bind-remote-url')?.focus()
        }, 0)
    })
}

function openPushSyncDialog(pushOptions = {}) {
    openSyncDialogShell('Push', `
        <label class="sync-push-option">
            <input type="checkbox" id="push-force-check" class="sync-push-force-check">
            <span>Force Push</span>
        </label>
        <p class="dialog-hint">勾选后使用 <code>git push --force</code>，会覆盖远程同名分支，可能影响其他协作者。</p>
    `, {
        showConfirm: true,
        confirmText: 'Push',
        confirmClass: 'btn btn-primary',
        cancelText: '取消',
        onConfirm: async () => {
            const force = !!document.getElementById('push-force-check')?.checked
            if (force) {
                const ok = await showAppConfirm(
                    '强制推送会用本地分支覆盖远程同名分支，可能改写远程历史并影响他人。\n\n仅在确认需要覆盖远程时再执行。',
                    {
                        title: '确认 Force Push',
                        variant: 'danger',
                        danger: true,
                        confirmText: '强制推送'
                    }
                )
                if (!ok) return
            }
            dialogBody.innerHTML = buildSyncDialogBody('loading', force ? '正在强制推送…' : '正在推送…', '')
            dialogConfirm.style.display = 'none'
            syncDialogBusy = true
            dialogCancel.disabled = true
            dialogClose.style.display = 'none'
            dialogCallback = null

            try {
                setStatus(force ? '正在强制推送…' : '正在推送…')
                const result = await window.gitAPI.push(currentRepoPath, force, pushOptions)
                await loadRepoData()
                const detail = result?.summary || (force ? '强制推送完成' : '推送完成')
                dialogBody.innerHTML = buildSyncDialogBody('success', 'Push 完成', detail)
                setStatus('Push 完成')
            } catch (error) {
                dialogBody.innerHTML = buildSyncDialogBody('error', 'Push 失败', error.message)
                setStatus('就绪')
            } finally {
                syncDialogBusy = false
                dialogCancel.disabled = false
                dialogCancel.textContent = '关闭'
                dialogClose.style.display = ''
            }
        }
    })
}

function openDialogShell({ title, bodyHtml, mode, wide }) {
    dialogMode = mode
    dialogTitle.textContent = title
    dialogBody.innerHTML = bodyHtml
    dialogOverlay.style.display = 'flex'
    if (dialogPanel) {
        dialogPanel.classList.toggle('dialog--wide', !!wide)
        dialogPanel.classList.toggle('dialog--message', mode === 'alert' || mode === 'confirm')
    }
}

function showDialog(title, content, onConfirm, options = {}) {
    resetDialogChrome()
    dialogDismissCallback = null
    openDialogShell({ title, bodyHtml: content, mode: 'form', wide: options.wide })
    dialogCallback = onConfirm
    dialogConfirm.style.display = onConfirm ? 'inline-block' : 'none'
    dialogCancel.textContent = onConfirm ? '取消' : '关闭'
}

function finishModal(result) {
    const resolve = pendingModalResolve
    pendingModalResolve = null
    dialogCallback = null
    dialogDismissCallback = null
    dialogMode = 'form'
    dialogOverlay.style.display = 'none'
    resetDialogChrome()
    if (resolve) resolve(result)
}

function hideDialog() {
    if (syncDialogBusy) return
    if (dialogMode === 'alert' || dialogMode === 'confirm') {
        finishModal(dialogMode === 'alert' ? undefined : null)
        return
    }
    if (bindRemoteDialogResolve) {
        const resolve = bindRemoteDialogResolve
        bindRemoteDialogResolve = null
        resolve(false)
    }
    dialogOverlay.style.display = 'none'
    dialogCallback = null
    dialogDismissCallback = null
    dialogMode = 'form'
    resetDialogChrome()
}

/** 替代原生 alert，样式与主界面一致 */
function showAppAlert(message, options = {}) {
    return new Promise((resolve) => {
        pendingModalResolve = () => resolve()
        resetDialogChrome()
        const variant = options.variant || 'info'
        openDialogShell({
            title: options.title || '提示',
            bodyHtml: buildModalMessageHtml(message, variant),
            mode: 'alert'
        })
        dialogCallback = null
        dialogConfirm.style.display = 'none'
        dialogCancel.textContent = options.confirmText || '知道了'
    })
}

/**
 * 替代原生 confirm：确定 true，取消 false，关闭/遮罩 null
 */
function showAppConfirm(message, options = {}) {
    return new Promise((resolve) => {
        pendingModalResolve = resolve
        resetDialogChrome()
        const variant = options.variant || (options.danger ? 'danger' : 'default')
        openDialogShell({
            title: options.title || '请确认',
            bodyHtml: buildModalMessageHtml(message, variant),
            mode: 'confirm'
        })
        dialogConfirm.textContent = options.confirmText || '确定'
        dialogConfirm.className = options.danger ? 'btn btn-danger' : 'btn btn-primary'
        dialogCancel.textContent = options.cancelText || '取消'
        if (options.hideCancel) dialogCancel.style.display = 'none'
        dialogCallback = () => finishModal(true)
    })
}

/** 放弃单文件改动：路径单独展示，避免长路径撑出横向滚动条 */
function showDiscardConfirm(filePath) {
    const safePath = escapeHtml(filePath)
    const fileName = escapeHtml(filePath.split(/[/\\]/).pop() || filePath)
    const dirMatch = filePath.match(/^(.*)[/\\][^/\\]+$/)
    const dirPart = dirMatch ? escapeHtml(dirMatch[1]) : ''

    return new Promise((resolve) => {
        pendingModalResolve = resolve
        resetDialogChrome()
        openDialogShell({
            title: '放弃本地改动',
            bodyHtml: `
                <div class="modal-message modal-message--danger discard-confirm">
                    <div class="modal-message__icon" aria-hidden="true">!</div>
                    <div class="modal-message__content">
                        <p class="discard-confirm__lead">将撤销该文件在工作区中的修改，此操作<strong>不可恢复</strong>。</p>
                        <div class="discard-confirm__file">
                            <div class="discard-confirm__name" title="${safePath}">${fileName}</div>
                            ${dirPart ? `<div class="discard-confirm__dir" title="${safePath}">${dirPart}</div>` : ''}
                        </div>
                    </div>
                </div>
            `,
            mode: 'confirm'
        })
        if (dialogPanel) dialogPanel.classList.add('dialog--discard-confirm')
        dialogConfirm.textContent = '放弃改动'
        dialogConfirm.className = 'btn btn-danger'
        dialogCancel.textContent = '取消'
        dialogCallback = () => finishModal(true)
    })
}

/**
 * SmartGit 风格合并方式选择：fast-forward | merge-commit | working-tree | null(取消)
 */
function showMergeChoiceDialog(branchName) {
    return new Promise((resolve) => {
        pendingModalResolve = resolve
        resetDialogChrome()
        dialogMode = 'merge-choice'
        dialogCallback = null
        dialogTitle.textContent = 'Merge'
        dialogBody.innerHTML = `
            <div class="modal-message modal-message--info">
                <div class="modal-message__icon" aria-hidden="true">?</div>
                <div class="modal-message__content">
                    <p><strong>如何合并分支「${escapeHtml(branchName)}」？</strong></p>
                    <p>Fast-forward merge 表示将当前分支（HEAD）直接移动到所选提交。Create Merge-Commit 会将对方分支的改动压成一个提交合入当前分支（历史中只增加一个合并点）。也可先合并到工作区，审查后再自行提交。</p>
                </div>
            </div>
        `
        dialogConfirm.style.display = 'none'
        dialogCancel.style.display = 'none'
        dialogOverlay.style.display = 'flex'
        if (dialogPanel) {
            dialogPanel.classList.add('dialog--message', 'dialog--merge-choice')
        }

        const actions = document.createElement('div')
        actions.className = 'merge-footer-actions'
        actions.innerHTML = `
            <button type="button" class="btn btn-primary btn-sm" data-merge-action="fast-forward">Fast-Forward</button>
            <button type="button" class="btn btn-secondary btn-sm" data-merge-action="merge-commit">Create Merge-Commit</button>
            <button type="button" class="btn btn-secondary btn-sm" data-merge-action="working-tree">Merge to Working Tree</button>
            <button type="button" class="btn btn-ghost btn-sm merge-footer-cancel" data-merge-action="cancel">Cancel</button>
        `
        dialogFooter?.prepend(actions)

        actions.querySelectorAll('[data-merge-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.mergeAction
                finishModal(action === 'cancel' ? null : action)
            })
        })
    })
}

dialogClose.addEventListener('click', () => {
    if (syncDialogBusy) return
    if (dialogMode === 'merge-choice') finishModal(null)
    else if (dialogMode === 'alert' || dialogMode === 'confirm') finishModal(null)
    else hideDialog()
})
dialogCancel.addEventListener('click', () => {
    if (syncDialogBusy) return
    if (dialogMode === 'merge-choice') finishModal(null)
    else if (dialogMode === 'alert') finishModal(undefined)
    else if (dialogMode === 'confirm') finishModal(false)
    else hideDialog()
})
dialogConfirm.addEventListener('click', async () => {
    if (syncDialogBusy && dialogMode !== 'sync') return
    if (dialogMode === 'confirm') {
        if (dialogCallback) dialogCallback()
        return
    }
    if (dialogCallback) await dialogCallback()
    if (dialogMode === 'form') hideDialog()
})

dialogOverlay.addEventListener('click', (e) => {
    if (e.target !== dialogOverlay) return
    if (syncDialogBusy) return
    if (dialogMode === 'merge-choice') finishModal(null)
    else if (dialogMode === 'alert') finishModal(undefined)
    else if (dialogMode === 'confirm') finishModal(null)
    else hideDialog()
})

newBranchBtn.addEventListener('click', () => {
    showDialog(
        '创建新分支',
        `<label class="dialog-label">分支名称</label>
        <input type="text" id="new-branch-name" class="dialog-input" placeholder="例如: feature/new-feature" />`,
        async () => {
            const branchName = document.getElementById('new-branch-name').value.trim()
            if (!branchName) {
                await showAppAlert('请输入分支名称')
                return
            }
            if (!/^[a-zA-Z0-9/_-]+$/.test(branchName)) {
                await showAppAlert('分支名称只能包含字母、数字、下划线、连字符和斜杠')
                return
            }
            try {
                setStatus(`正在创建分支: ${branchName}`)
                await window.gitAPI.createBranch(currentRepoPath, branchName)
                await loadRepoData()
                setStatus(`分支 ${branchName} 创建成功`)
            } catch (error) {
                await showAppAlert('创建分支失败: ' + error.message)
                setStatus('就绪')
            }
        }
    )
})

async function cherryPickCommit(hash) {
    if (isViewingCurrentBranchLog()) {
        await showAppAlert('当前正在查看本分支提交历史，请从其他分支的 Log 中选择提交再 Cherry-pick。', { variant: 'info' })
        return
    }
    if (!(await showAppConfirm(
        `确定将 ${historyLogBranch} 上的提交 ${hash.substring(0, 7)} Cherry-pick 到当前分支「${currentBranchName}」吗？`,
        { variant: 'warning' }
    ))) return
    try {
        setStatus('正在 Cherry-pick...')
        await window.gitAPI.cherryPick(currentRepoPath, hash)
        await loadRepoData()
        setStatus('Cherry-pick 成功')
        await showAppAlert('Cherry-pick 完成')
    } catch (error) {
        await loadRepoData()
        const status = await window.gitAPI.getStatus(currentRepoPath)
        const conflictCount = (status.conflicted || []).length
        await showAppAlert(conflictCount > 0
            ? `Cherry-pick 失败，存在 ${conflictCount} 个冲突文件，请在编辑器中解决后刷新。`
            : `Cherry-pick 失败: ${error.message}`)
        setStatus('就绪')
    }
}

async function rebaseOntoBranch(ontoBranch) {
    if (!(await showAppConfirm(`确定要将当前分支 rebase 到 "${ontoBranch}" 吗？\n\nRebase 会重写提交历史，请确保已备份重要更改。`))) return
    try {
        setStatus(`正在 rebase 到 ${ontoBranch}...`)
        await window.gitAPI.rebase(currentRepoPath, ontoBranch)
        await loadRepoData()
        setStatus('Rebase 成功')
        await showAppAlert('Rebase 完成')
    } catch (error) {
        await loadRepoData()
        const status = await window.gitAPI.getStatus(currentRepoPath)
        const conflictCount = (status.conflicted || []).length
        await showAppAlert(conflictCount > 0
            ? `Rebase 中断，有 ${conflictCount} 个冲突。\n\n请在变更视图解决冲突后，使用顶部横幅的「继续」或「中止」。`
            : `Rebase 失败: ${error.message}`)
        setStatus('Rebase 冲突')
    }
}

function showRenameBranchDialog(branchName) {
    const safeName = escapeAttr(branchName)
    showDialog(
        '重命名分支',
        `<label class="dialog-label">当前名称</label>
        <input type="text" class="dialog-input" value="${safeName}" readonly />
        <label class="dialog-label" style="margin-top:12px">新名称</label>
        <input type="text" id="rename-branch-name" class="dialog-input" value="${safeName}" placeholder="例如: feature/new-name" spellcheck="false" />`,
        async () => {
            const newName = document.getElementById('rename-branch-name').value.trim()
            if (!newName) {
                await showAppAlert('请输入新分支名称')
                return
            }
            if (newName === branchName) {
                await showAppAlert('新名称与当前名称相同')
                return
            }
            if (!/^[a-zA-Z0-9/_-]+$/.test(newName)) {
                await showAppAlert('分支名称只能包含字母、数字、下划线、连字符和斜杠')
                return
            }
            try {
                setStatus(`正在重命名分支 ${branchName} → ${newName}...`)
                await window.gitAPI.renameBranch(currentRepoPath, branchName, newName)
                if (historyLogBranch === branchName) {
                    historyLogBranch = newName
                }
                await loadRepoData()
                setStatus(`分支已重命名为 ${newName}`)
            } catch (error) {
                await showAppAlert('重命名失败: ' + error.message)
                setStatus('就绪')
            }
        }
    )
    setTimeout(() => {
        const input = document.getElementById('rename-branch-name')
        if (!input) return
        input.focus()
        input.select()
    }, 0)
}

async function deleteBranch(branchName) {
    if (!(await showAppConfirm(`确定要删除分支 "${branchName}" 吗？`, { variant: 'warning' }))) return
    const forceChoice = await showAppConfirm(
        '选择删除方式：\n\n强制删除（-D）可删除未合并分支；普通删除仅在分支已合并时成功。',
        {
            title: '删除方式',
            confirmText: '强制删除 (-D)',
            cancelText: '普通删除',
            variant: 'warning',
            danger: true
        }
    )
    if (forceChoice === null) return
    const force = forceChoice === true
    try {
        setStatus(`正在删除分支 ${branchName}...`)
        await window.gitAPI.deleteBranch(currentRepoPath, branchName, force)
        await loadRepoData()
        setStatus('分支已删除')
    } catch (error) {
        await showAppAlert('删除分支失败: ' + error.message)
        setStatus('就绪')
    }
}

newTagBtn?.addEventListener('click', () => {
    showDialog(
        '创建标签',
        `<label class="dialog-label">标签名称</label>
        <input type="text" id="new-tag-name" class="dialog-input" placeholder="例如: v1.0.0" />
        <label class="dialog-label" style="margin-top:12px">附注说明（可选，填写则创建附注标签）</label>
        <input type="text" id="new-tag-message" class="dialog-input" placeholder="例如: Release 1.0.0" />`,
        async () => {
            const tagName = document.getElementById('new-tag-name').value.trim()
            const message = document.getElementById('new-tag-message').value.trim()
            if (!tagName) {
                await showAppAlert('请输入标签名称')
                return
            }
            if (!/^[a-zA-Z0-9._/-]+$/.test(tagName)) {
                await showAppAlert('标签名称格式无效')
                return
            }
            try {
                setStatus(`正在创建标签 ${tagName}...`)
                await window.gitAPI.createTag(currentRepoPath, tagName, message)
                await loadRepoData()
                setStatus(`标签 ${tagName} 已创建`)
            } catch (error) {
                await showAppAlert('创建标签失败: ' + error.message)
                setStatus('就绪')
            }
        }
    )
})

pushTagsBtn?.addEventListener('click', async () => {
    try {
        setStatus('正在推送标签...')
        await window.gitAPI.pushTags(currentRepoPath)
        setStatus('标签推送成功')
        await showAppAlert('所有标签已推送到远程')
    } catch (error) {
        await showAppAlert('推送标签失败: ' + error.message)
        setStatus('就绪')
    }
})

async function deleteTag(tagName) {
    if (!(await showAppConfirm(`确定要删除标签 "${tagName}" 吗？`))) return
    try {
        setStatus(`正在删除标签 ${tagName}...`)
        await window.gitAPI.deleteTag(currentRepoPath, tagName)
        await loadRepoData()
        setStatus('标签已删除')
    } catch (error) {
        await showAppAlert('删除标签失败: ' + error.message)
        setStatus('就绪')
    }
}

async function mergeBranch(branchName) {
    const mode = await showMergeChoiceDialog(branchName)
    if (!mode) return
    if (mode === 'merge-commit') {
        pendingSquashMergeSourceBranch = branchName
    }
    try {
        setStatus(`正在合并 ${branchName}...`)
        await window.gitAPI.mergeBranch(currentRepoPath, branchName, mode)
        pendingSquashMerge = false
        pendingSquashMergeSourceBranch = ''
        await loadRepoData()
        setStatus('合并成功')
        if (mode === 'working-tree') {
            await showAppAlert(
                '已合并到工作区，尚未创建提交。\n\n请在变更页审查文件，确认后使用 Commit 提交。',
                { variant: 'info', title: 'Merge' }
            )
        } else if (mode === 'merge-commit') {
            await showAppAlert(
                '已合并为一个提交（squash merge），当前分支历史上只新增一个合并点。',
                { variant: 'success', title: 'Merge' }
            )
        } else {
            await showAppAlert('分支合并成功！', { variant: 'success' })
        }
    } catch (error) {
        switchView('changes')
        if (mode === 'merge-commit') {
            pendingSquashMerge = true
            pendingSquashMergeSourceBranch = branchName
        }
        await loadRepoData()
        const status = await window.gitAPI.getStatus(currentRepoPath)
        const conflictCount = (status.conflicted || []).length
        const squashStyle = mode === 'merge-commit'
        let msg = conflictCount > 0
            ? squashStyle
                ? `合并未完成，有 ${conflictCount} 个冲突文件。\n\n请在变更页解决冲突后，点击操作条「完成合并」自动生成合并提交。`
                : `合并未完成，有 ${conflictCount} 个冲突文件。\n\n请在变更页解决冲突后，使用顶部操作条「继续」完成合并。`
            : `合并失败: ${error.message}`
        if (mode === 'fast-forward' && !conflictCount) {
            msg += '\n\n提示：当前无法 fast-forward，请改用 Create Merge-Commit 或 Merge to Working Tree。'
        }
        await showAppAlert(msg, { variant: conflictCount > 0 ? 'warning' : 'danger' })
        setStatus(conflictCount > 0 ? '合并冲突' : '就绪')
    }
}

function renderStashes(stashes) {
    if (!stashes || stashes.length === 0) {
        stashList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>没有保存的 Stash</p></div>'
        return
    }

    stashList.innerHTML = stashes.map(stash => `
        <div class="stash-item">
            <div class="stash-info">
                <div class="stash-message">${escapeHtml(stash.message)}</div>
                <div class="stash-meta">stash@{${stash.index}} • ${formatRelativeTime(stash.date)}</div>
            </div>
            <div class="stash-actions">
                <button class="btn btn-primary stash-action" data-index="${stash.index}" data-action="apply">应用</button>
                <button class="btn btn-secondary stash-action" data-index="${stash.index}" data-action="drop">删除</button>
            </div>
        </div>
    `).join('')

    stashList.querySelectorAll('.stash-action').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index, 10)
            if (btn.dataset.action === 'apply') await applyStash(index)
            if (btn.dataset.action === 'drop') await dropStash(index)
        })
    })
}

newStashBtn.addEventListener('click', () => {
    showDialog(
        '保存当前更改',
        `<label class="dialog-label">Stash 描述（可选）</label>
        <input type="text" id="stash-message" class="dialog-input" placeholder="例如: WIP: 正在开发的功能" />`,
        async () => {
            const message = document.getElementById('stash-message').value.trim()
            try {
                setStatus('正在保存更改...')
                await window.gitAPI.stashSave(currentRepoPath, message)
                await loadRepoData()
                setStatus('更改已保存到 Stash')
            } catch (error) {
                await showAppAlert('保存失败: ' + error.message)
                setStatus('就绪')
            }
        }
    )
})

async function applyStash(index) {
    try {
        setStatus(`正在应用 stash@{${index}}...`)
        await window.gitAPI.stashApply(currentRepoPath, index)
        await loadRepoData()
        setStatus('Stash 应用成功')
    } catch (error) {
        await showAppAlert('应用 Stash 失败: ' + error.message)
        setStatus('就绪')
    }
}

async function dropStash(index) {
    if (!(await showAppConfirm(`确定要删除 stash@{${index}} 吗？此操作不可撤销。`))) return
    try {
        setStatus(`正在删除 stash@{${index}}...`)
        await window.gitAPI.stashDrop(currentRepoPath, index)
        await loadRepoData()
        setStatus('Stash 已删除')
    } catch (error) {
        await showAppAlert('删除 Stash 失败: ' + error.message)
        setStatus('就绪')
    }
}

async function loadSettings() {
    if (!currentRepoPath) return
    settingsRepoPath.textContent = currentRepoPath
    const scope = configScopeSelect.value
    try {
        const config = await window.gitAPI.getConfig(currentRepoPath, scope)
        configNameInput.value = config.name || ''
        configEmailInput.value = config.email || ''
    } catch (error) {
        await showAppAlert('加载配置失败: ' + error.message)
    }
    await loadSubmodules()
}

configScopeSelect.addEventListener('change', () => {
    if (currentRepoPath) loadSettings()
})

async function loadSubmodules() {
    try {
        const { submodules } = await window.gitAPI.getSubmodules(currentRepoPath)
        if (!submodules || !submodules.length) {
            submoduleList.innerHTML = '<div class="empty-hint">无子模块</div>'
            return
        }
        submoduleList.innerHTML = submodules.map(sm => {
            const path = escapeAttr(sm.path)
            const statusLabel = sm.status === '+' ? '已修改' : sm.status === '-' ? '未初始化' : '正常'
            return `
                <div class="submodule-item">
                    <div class="submodule-info">
                        <span class="submodule-path">${escapeHtml(sm.path)}</span>
                        <span class="submodule-meta">${escapeHtml(statusLabel)} • ${escapeHtml(sm.hash?.substring(0, 7) || '')} ${escapeHtml(sm.branch)}</span>
                    </div>
                    <button class="btn btn-secondary btn-tiny submodule-update" data-path="${path}">更新</button>
                </div>
            `
        }).join('')
        submoduleList.querySelectorAll('.submodule-update').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    setStatus('更新子模块...')
                    await window.gitAPI.updateSubmodules(currentRepoPath, btn.dataset.path)
                    await loadSubmodules()
                    setStatus('子模块已更新')
                } catch (error) {
                    await showAppAlert('更新失败: ' + error.message)
                    setStatus('就绪')
                }
            })
        })
    } catch (error) {
        submoduleList.innerHTML = `<div class="empty-hint">${escapeHtml(error.message)}</div>`
    }
}

submoduleUpdateAllBtn.addEventListener('click', async () => {
    if (!(await showAppConfirm('确定要初始化并更新所有子模块吗？'))) return
    try {
        setStatus('更新全部子模块...')
        await window.gitAPI.updateSubmodules(currentRepoPath, null)
        await loadSubmodules()
        setStatus('全部子模块已更新')
    } catch (error) {
        await showAppAlert('更新失败: ' + error.message)
        setStatus('就绪')
    }
})

saveConfigBtn.addEventListener('click', async () => {
    if (!currentRepoPath) return
    const scope = configScopeSelect.value
    try {
        setStatus('正在保存配置...')
        await window.gitAPI.setConfig(
            currentRepoPath,
            configNameInput.value.trim(),
            configEmailInput.value.trim(),
            scope
        )
        setStatus('配置已保存')
        await showAppAlert(`Git 用户配置已保存（${scope === 'global' ? '全局' : '当前仓库'}）`)
    } catch (error) {
        await showAppAlert('保存配置失败: ' + error.message)
        setStatus('就绪')
    }
})

async function searchCommits() {
    const keyword = commitSearchInput.value.trim()
    if (!keyword) {
        await loadCommitHistoryForBranch(historyLogBranch || currentBranchName)
        return
    }
    try {
        setStatus('搜索提交...')
        const results = cachedCommits.filter(c =>
            c.message.toLowerCase().includes(keyword.toLowerCase()) ||
            c.author.toLowerCase().includes(keyword.toLowerCase()) ||
            c.hash.toLowerCase().includes(keyword.toLowerCase())
        )
        renderCommits(results)
        setStatus(`找到 ${results.length} 条提交`)
    } catch (error) {
        await showAppAlert('搜索失败: ' + error.message)
        setStatus('就绪')
    }
}

commitSearchBtn.addEventListener('click', searchCommits)
commitSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchCommits()
})
commitSearchClear.addEventListener('click', async () => {
    commitSearchInput.value = ''
    await loadCommitHistoryForBranch(historyLogBranch || currentBranchName)
})
