# GitX - Git GUI Desktop Application

## Architecture
- **main.js**: Electron main process with ~60 IPC handlers for all git operations
- **preload.js**: Context bridge exposing gitAPI to renderer
- **renderer.js**: Frontend logic (2672 lines)
- **index.html**: UI layout
- **style.css**: Complete design system (2205 lines)

## Key patterns
- IPC: handler in main.js → expose in preload.js → call in renderer.js
- Dialogs: `showDialog(title, html, onConfirm, options)` / `showAppAlert` / `showAppConfirm`
- Sidebar buttons use `repo-action-btn` classes with color-coded themes
- Grid layout: `.repo-switcher-actions` uses `grid-template-columns: 1fr 1fr`
- `remove-repo-btn` spans full width with `grid-column: 1 / -1`
