/**
 * electron-builder afterPack：在未启用 winCodeSign 时写入 exe 图标。
 */
const path = require('path')
const { spawnSync } = require('child_process')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const productName = context.packager.appInfo.productFilename
  const exePath = path.join(context.appOutDir, `${productName}.exe`)
  const rel = path.relative(path.join(__dirname, '..'), exePath)

  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, 'patch-portable-icon.mjs'), rel],
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
  )
  if (r.status !== 0) {
    throw new Error(`Failed to patch icon on ${exePath}`)
  }
}
