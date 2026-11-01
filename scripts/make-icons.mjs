// public/favicon.svg から PWA アイコン PNG を生成する（Playwright の Chromium でレンダリング）
// 使い方: npx playwright install chromium && node scripts/make-icons.mjs
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')
const here = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(resolve(here, '../public/favicon.svg'), 'utf8')
const outDir = resolve(here, '../public/icons')
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  const inner = svg.replace('<svg ', `<svg width="${size * 0.8}" height="${size * 0.8}" `)
  await page.setContent(`<html><body style="margin:0;background:#fff8e7;display:grid;place-items:center;width:${size}px;height:${size}px">${inner}</body></html>`)
  writeFileSync(resolve(outDir, `icon-${size}.png`), await page.screenshot({ type: 'png' }))
  await page.close()
}
await browser.close()
console.log('icons written to', outDir)
