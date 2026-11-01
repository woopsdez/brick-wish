import { defineConfig } from '@playwright/test'

export const STUB_URL = 'http://127.0.0.1:54399'
export const APP_URL = 'http://127.0.0.1:4173/brick-wish/'

const isCI = Boolean(process.env.CI)

// 環境変数は .env.local より優先されるので、手元に本番の接続先があってもスタブへ向く
const appEnv = {
  BASE_PATH: '/brick-wish/',
  VITE_SUPABASE_URL: STUB_URL,
  VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
  VITE_VAPID_PUBLIC_KEY: '',
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // 公開を止める判定なので、再試行で不安定さを隠さない
  retries: 0,
  workers: isCI ? 2 : 4,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/stub-supabase.mjs',
      url: `${STUB_URL}/__test/health`,
      reuseExistingServer: false,
    },
    {
      // 公開するものと同じ本番ビルドを試す。開発サーバーは StrictMode で購読が二重になり、挙動が変わる
      command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort',
      url: APP_URL,
      env: appEnv,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
