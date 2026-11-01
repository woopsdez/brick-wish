import { devices, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { APP_URL, STUB_URL } from '../playwright.config'
import type { WishRequest } from '../src/types'

/**
 * Broadcast で届くはずの画面更新を待つ時間。
 * アプリは保険として 30 秒ごとに取り直すので、これより十分短くして「定期更新で偶然通る」のを防ぐ。
 */
export const LIVE = { timeout: 5_000 }

const OWN_HOST = '127.0.0.1'

/** 本番の Supabase に出ようとした通信。テストの最後に空であることを確かめる */
const leaks = new WeakMap<BrowserContext, string[]>()

export async function newDevice(browser: Browser, device: 'kid' | 'parent'): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    ...(device === 'parent' ? devices['Pixel 7'] : devices['Desktop Chrome']),
    baseURL: APP_URL,
    // 新しい版への自動切り替えで画面が読み直されないようにする
    serviceWorkers: 'block',
  })
  const leaked: string[] = []
  leaks.set(context, leaked)
  // 外へは一切出さない。パーツ画像は読めなくても図形の代替表示になる
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === OWN_HOST) return route.continue()
    if (url.hostname.endsWith('supabase.co')) leaked.push(url.href)
    return route.abort()
  })
  return { context, page: await context.newPage() }
}

export function expectNoLeak(...contexts: BrowserContext[]) {
  for (const c of contexts) expect(leaks.get(c) ?? [], '本番の Supabase に通信しようとした').toEqual([])
}

/** 子どもの端末を開く。ファミリーは履歴やカートなど、家族のデータを読む画面を開いたときに自動で作られる */
export async function openKid(browser: Browser) {
  const device = await newDevice(browser, 'kid')
  await device.page.goto('#/kid/history')
  const code = await readFamilyCode(device.page)
  await device.page.getByRole('link', { name: 'パーツ', exact: true }).click()
  await expect(device.page.getByRole('heading', { name: 'ほしいパーツ' })).toBeVisible()
  return { ...device, code }
}

export async function readFamilyCode(page: Page): Promise<string> {
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bw:settings:v2') ?? '{}').familyId)).toMatch(/^[A-Z0-9]{6}$/)
  return page.evaluate(() => JSON.parse(localStorage.getItem('bw:settings:v2') ?? '{}').familyId as string)
}

/** 親のスマホをリンクでつなぐ。つなぐ画面そのものの確認は connect.spec.ts */
export async function openParent(browser: Browser, code: string) {
  const device = await newDevice(browser, 'parent')
  await device.page.goto(`#/join/${code}`)
  await device.page.getByRole('button', { name: 'つなぐ' }).click()
  await expect(device.page.getByRole('heading', { name: /保護者/ })).toBeVisible()
  await expect(device.page.getByText('ローカルモード')).toHaveCount(0)
  return device
}

/** 価格の分かる最初のパーツを指定の個数カートに入れて、カート画面へ進む */
export async function fillCart(kid: Page, qty: number) {
  await kid.locator('.tile:not(.soldout)').first().click()
  const dialog = kid.getByRole('dialog')
  await dialog.locator('input[type=number]').fill(String(qty))
  await dialog.getByRole('button', { name: 'カートに入れる' }).click()
  await expect(dialog).toBeHidden()
  await kid.getByRole('link', { name: /カートを見る/ }).click()
  await expect(kid.getByRole('heading', { name: new RegExp(`カート（${qty} 個）`) })).toBeVisible()
}

/** 枠を超える個数。どのパーツでも ¥1,000 の枠を超える */
export const OVER_BUDGET_QTY = 999

/** 枠を超える分を送り、親の承認待ちにする */
export async function sendOverBudget(kid: Page, note: string) {
  await fillCart(kid, OVER_BUDGET_QTY)
  await expect(kid.getByText('保護者の承認が必要です')).toBeVisible()
  await kid.getByLabel('メモ（何を作る？）').fill(note)
  await kid.getByRole('button', { name: '保護者にリクエストを送る' }).click()
  await expect(kid.getByRole('heading', { name: 'リクエストを送りました' })).toBeVisible()
}

export const requestCard = (page: Page, note: string): Locator => page.locator('.req-card', { hasText: note })

export async function storedFamily(code: string): Promise<{ requests: WishRequest[]; notifyCalls: number }> {
  const res = await fetch(`${STUB_URL}/__test/family/${code}`)
  return res.json()
}
