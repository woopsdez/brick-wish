import { expect, test } from '@playwright/test'
import { expectNoLeak, fillCart, LIVE, OVER_BUDGET_QTY, openKid, openParent, requestCard, sendOverBudget, storedFamily } from './helpers'

test('枠超えの送信 → 親が個数を減らして承認 → すぐ支払い手順 → 注文済み → 子どもの履歴に反映', async ({ browser }) => {
  const kid = await openKid(browser)
  const parent = await openParent(browser, kid.code)
  const note = '変形するロボット'
  const reduced = OVER_BUDGET_QTY - 1

  await sendOverBudget(kid.page, note)
  await kid.page.getByRole('link', { name: '履歴を見る' }).click()
  await expect(requestCard(kid.page, note).locator('.badge')).toHaveText('確認待ち')

  // 親は一覧を開いたまま。何も押さなくても出る
  const row = requestCard(parent.page, note)
  await expect(row.locator('.badge')).toHaveText('承認待ち', LIVE)
  await row.getByRole('link').click()
  await expect(parent.page.getByText(/承認が必要です/)).toBeVisible()

  await parent.page.getByRole('button', { name: '減らす' }).click()
  await expect(parent.page.locator('.cart-row')).toContainText(`× ${reduced} =`)
  await parent.page.getByLabel('子どもへのメッセージ（任意）').fill('少し減らしたよ')
  await parent.page.getByRole('button', { name: '承認して支払いへ' }).click()

  // 承認した本人には Broadcast が届かない。それでも待たされずに支払い手順が出る
  await expect(parent.page.getByRole('heading', { name: /で支払う/ })).toBeVisible(LIVE)
  await expect(parent.page.locator('header .badge')).toHaveText('支払い待ち')
  await expect(parent.page.locator('.qty-static')).toHaveText(`× ${reduced}`)
  await expect(parent.page.getByRole('button', { name: '承認して支払いへ' })).toHaveCount(0)

  // 子どもの端末は履歴を開いたまま。別の端末からの承認が届く
  const kidRow = requestCard(kid.page, note)
  await expect(kidRow.locator('.badge')).toHaveText('OK', LIVE)
  await expect(kidRow).toContainText('保護者から：少し減らしたよ')

  await parent.page.getByRole('button', { name: /注文済み/ }).click()
  await expect(parent.page).toHaveURL(/#\/parent$/)
  await expect(requestCard(parent.page, note).locator('.badge')).toHaveText('注文済み', LIVE)
  await expect(kidRow.locator('.badge')).toHaveText('注文済み', LIVE)

  const { requests, notifyCalls } = await storedFamily(kid.code)
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ status: 'ordered', approved_by: 'parent', parent_note: '少し減らしたよ' })
  expect(requests[0].items[0].qty).toBe(reduced)
  expect(requests[0].total_yen).toBe(requests[0].items[0].unit_yen! * reduced)
  expect(notifyCalls).toBe(1)

  expectNoLeak(kid.context, parent.context)
})

test('親が見送る → 枠を使わず、子どもの履歴に反映', async ({ browser }) => {
  const kid = await openKid(browser)
  const parent = await openParent(browser, kid.code)
  const note = '大きなお城'

  await sendOverBudget(kid.page, note)
  await kid.page.getByRole('link', { name: '履歴を見る' }).click()

  const row = requestCard(parent.page, note)
  await expect(row.locator('.badge')).toHaveText('承認待ち', LIVE)
  await row.getByRole('link').click()
  await parent.page.getByRole('button', { name: '今回は見送り' }).click()

  await expect(parent.page).toHaveURL(/#\/parent$/)
  await expect(requestCard(parent.page, note).locator('.badge')).toHaveText('見送り', LIVE)
  await expect(parent.page.locator('.family-code')).toContainText('¥0 / ¥1,000')
  await expect(requestCard(kid.page, note).locator('.badge')).toHaveText('今回は見送り', LIVE)

  const { requests } = await storedFamily(kid.code)
  expect(requests[0].status).toBe('rejected')

  expectNoLeak(kid.context, parent.context)
})

test('枠内の送信 → 自動承認され、親は支払いだけ', async ({ browser }) => {
  const kid = await openKid(browser)
  const parent = await openParent(browser, kid.code)
  const note = '小さな車'

  await fillCart(kid.page, 1)
  await expect(kid.page.getByText(/枠内なので、送るとすぐ OK/)).toBeVisible()
  await kid.page.getByLabel('メモ（何を作る？）').fill(note)
  await kid.page.getByRole('button', { name: 'OK にして注文へ進める' }).click()
  await expect(kid.page.getByRole('heading', { name: 'OK！注文に進みます' })).toBeVisible()
  await kid.page.getByRole('link', { name: '履歴を見る' }).click()
  await expect(requestCard(kid.page, note).locator('.badge')).toHaveText('自動 OK')

  const row = requestCard(parent.page, note)
  await expect(row.locator('.badge')).toHaveText('自動承認・支払い待ち', LIVE)
  await expect(parent.page.locator('.family-code')).not.toContainText('¥0 / ¥1,000')
  await row.getByRole('link').click()

  await expect(parent.page.getByText('今月の枠内なので自動で承認されています')).toBeVisible()
  await expect(parent.page.getByRole('heading', { name: /で支払う/ })).toBeVisible()
  await expect(parent.page.getByRole('button', { name: '承認して支払いへ' })).toHaveCount(0)

  await parent.page.getByRole('button', { name: /注文済み/ }).click()
  await expect(requestCard(parent.page, note).locator('.badge')).toHaveText('注文済み', LIVE)
  await expect(requestCard(kid.page, note).locator('.badge')).toHaveText('注文済み', LIVE)

  const { requests } = await storedFamily(kid.code)
  expect(requests[0]).toMatchObject({ status: 'ordered', approved_by: 'auto' })

  expectNoLeak(kid.context, parent.context)
})
