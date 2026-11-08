import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const BACKEND_DIR = path.join(ROOT, 'backend')
const LIB_ROOT = path.join(BACKEND_DIR, '.mongo-libs')
const LIB_DIR = path.join(LIB_ROOT, 'usr', 'lib', 'x86_64-linux-gnu')
const DEB_PATH = path.join(LIB_ROOT, 'libssl1.1.deb')
const DEB_URL =
  'https://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb'

function hasCommand(command) {
  return spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' }).status === 0
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? 'unknown'}`)
  }
}

function envFileHasMongoUri() {
  const envPath = path.join(BACKEND_DIR, '.env')
  if (!fs.existsSync(envPath)) return false
  const contents = fs.readFileSync(envPath, 'utf8')
  return /^\s*MONGODB_URI\s*=\s*\S+/m.test(contents)
}

async function ensureLibssl() {
  if (process.platform !== 'linux' || process.arch !== 'x64') return null

  const ssl = path.join(LIB_DIR, 'libssl.so.1.1')
  const crypto = path.join(LIB_DIR, 'libcrypto.so.1.1')
  if (fs.existsSync(ssl) && fs.existsSync(crypto)) return LIB_DIR

  fs.mkdirSync(LIB_ROOT, { recursive: true })

  if (!fs.existsSync(DEB_PATH)) {
    console.log('[dev] Downloading libssl1.1 for the local MongoDB fallback…')
    const response = await fetch(DEB_URL)
    if (!response.ok) {
      throw new Error(`libssl1.1 download failed (${response.status} ${response.statusText})`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const temporary = `${DEB_PATH}.tmp`
    fs.writeFileSync(temporary, buffer)
    fs.renameSync(temporary, DEB_PATH)
  }

  console.log('[dev] Extracting libssl1.1…')
  if (hasCommand('dpkg-deb')) {
    run('dpkg-deb', ['-x', DEB_PATH, LIB_ROOT])
  } else {
    if (hasCommand('bsdtar')) {
      run('bsdtar', ['-xf', DEB_PATH, '-C', LIB_ROOT])
    } else if (hasCommand('ar')) {
      run('ar', ['x', DEB_PATH], LIB_ROOT)
    } else {
      throw new Error('Could not extract libssl1.1: install dpkg-deb, bsdtar, or ar.')
    }

    const dataArchive = ['data.tar.xz', 'data.tar.gz', 'data.tar']
      .map((name) => path.join(LIB_ROOT, name))
      .find((file) => fs.existsSync(file))
    if (!dataArchive) throw new Error('Could not find the data archive inside libssl1.1.deb.')
    run('tar', ['-xf', dataArchive, '-C', LIB_ROOT])

    for (const leftover of ['data.tar.xz', 'data.tar.gz', 'data.tar', 'control.tar.xz', 'control.tar.gz', 'debian-binary']) {
      fs.rmSync(path.join(LIB_ROOT, leftover), { force: true })
    }
  }

  if (!fs.existsSync(ssl) || !fs.existsSync(crypto)) {
    throw new Error('libssl1.1 extraction did not produce the expected shared libraries.')
  }
  return LIB_DIR
}

/**
 * The development MongoDB fallback uses MongoDB 4.4, which links against
 * libssl1.1. Modern distributions ship libssl3 only, so keep a private copy
 * next to the backend data and add it to the child process library path.
 *
 * This is skipped whenever a real MONGODB_URI is configured.
 */
export async function prepareDevEnv() {
  const env = { ...process.env }
  if (env.MONGODB_URI || envFileHasMongoUri()) return env

  try {
    const libDir = await ensureLibssl()
    if (libDir) {
      env.LD_LIBRARY_PATH = [libDir, env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter)
    }
  } catch (error) {
    console.warn(`[dev] ${error instanceof Error ? error.message : String(error)}`)
    console.warn('[dev] Set MONGODB_URI to use an external MongoDB instead of the local fallback.')
  }

  return env
}
