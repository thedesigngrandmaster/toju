import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareDevEnv } from './lib/dev-env.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const env = await prepareDevEnv()
const child = spawn(npm, ['run', 'dev:services'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
