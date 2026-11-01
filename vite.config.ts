import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages のプロジェクトサイト (https://<user>.github.io/<repo>/) に置く場合は
// BASE_PATH=/<repo>/ を渡す。独自ドメイン直下なら未指定で "/"。
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Brick Wish',
        short_name: 'BrickWish',
        description: '子どもがレゴパーツを選び、親が承認して国内ショップで支払う家庭用おねがいカート',
        lang: 'ja',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#141416',
        theme_color: '#141416',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
      },
      devOptions: { enabled: false },
    }),
  ],
})
