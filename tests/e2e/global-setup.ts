import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function globalSetup(): Promise<void> {
  // Set environment variables for testing
  process.env.OLLAMA_LLM_LIBRARY = 'cpu'
  process.env.NODE_ENV = 'test'

  // Ensure the app is built before running E2E tests
  const mainOut = resolve(__dirname, '../../out/main/index.js')
  if (!existsSync(mainOut)) {
    console.log('[E2E] Build output not found, running electron-vite build...')
    execSync('npx electron-vite build', {
      cwd: resolve(__dirname, '../..'),
      stdio: 'inherit',
    })
  }
}

export default globalSetup
