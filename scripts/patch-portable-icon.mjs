import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rcedit } from 'rcedit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const iconPath = path.join(root, 'build', 'icon.ico')

const relExe = process.argv[2] || path.join('portable', 'GitX', 'electron.exe')
const exePath = path.resolve(root, relExe)
const tmpPath = `${exePath}.icon-tmp`

async function clearReadOnly(filePath) {
  try {
    await fs.chmod(filePath, 0o666)
  } catch {
    // ignore
  }
}

async function patchViaTemp() {
  await clearReadOnly(exePath)
  await fs.copyFile(exePath, tmpPath)
  await clearReadOnly(tmpPath)
  await rcedit(tmpPath, { icon: iconPath })
  await fs.unlink(exePath)
  await fs.rename(tmpPath, exePath)
  await clearReadOnly(exePath)
}

const maxAttempts = 5
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    await patchViaTemp()
    console.log('Applied icon:', iconPath)
    console.log('Target:', exePath)
    process.exit(0)
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {})
    const retryable =
      /commit changes|EBUSY|EPERM|EACCES|being used|locked/i.test(String(err.message))
    if (retryable && attempt < maxAttempts) {
      console.warn(`Attempt ${attempt} failed, retrying in 2s...`)
      await new Promise((r) => setTimeout(r, 2000))
      continue
    }
    console.error('Failed to apply icon:', err.message)
    console.error('Close GitX / Explorer windows on portable\\GitX, then retry.')
    process.exit(1)
  }
}
