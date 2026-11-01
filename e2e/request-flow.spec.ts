import { expect, test } from '@playwright/test'
import { addPart, expectNoLeak, LIVE, OVER_BUDGET_QTY, openCart, openKid, openParent, requestCard, send, sendButton, sendNextMonth, sendThisMonth, storedFamily } from './helpers'
import { monthKey, nextMonthKey } from '../src/lib/budget'

const UNUSED_BUDGET = '¥0 / ¥1,000'

test('枠に入る分: 送ると親の「支払う」に出る → 注文済み → 子どもの履歴に反映', async ({ browser }) => {
  const kid = await openKid(browser)
  const parent = await openParent(browser, kid.code)
  const note = '小さな車'

  await sendThisMonth(kid.page, note)
  await kid.page.getByRole('link', { name: '履歴を見る' }).click()
  await expect(requestCard(kid.page, note).locator('.badge')).toHaveText('OK')

  // 親は一覧を開いたまま。何も押さなくても出て、枠も減る
  const row = requestCard(parent.page, note)
  await expect(row.locator('.badge')).toHaveText('未払い', LIVE)
  await expect(parent.page.locator('.family-code')).not.toContainText(UNUSED_BUDGET)
  await row.getByRole('link').click()

  await expect(parent.page.getByRole('heading', { name: /で支払う/ })).toBeVisible()
  await expect(parent.page.getByRole('button', { name: '今払う' })).toHaveCount(0)

  await parent.page.getByRole('button', { name: /注文済み/ }).click()
  await expect(requestCard(parent.page, note).locator('.badge')).toHaveText('注文済み', LIVE)
  await expect(requestCard(kid.page, note).locator('.badge')).toHaveText('注文済み', LIVE)

  const { requests, notifyCalls } = await storedFamily(kid.code)
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ status: 'ordered', approved_by: 'auto', pay_month: monthKey() })
  expect(notifyCalls).toBe(1)

  expectNoLeak(kid.context, parent.context)
})

test('枠を超える分: 来月に回すまで送れない → 親が個数を減らして今払う → 本人の画面がすぐ進む → 注文済み', async ({ browser }) => {
  const kid = await openKid(browser)
  const parent = await openParent(browser, kid.code)
  const note = '変形するロボット'
  const reduced = OVER_BUDGET_QTY - 1

  await addPart(kid.page, { qty: OVER_BUDGET_QTY })
  await openCart(kid.page)
  await expect(kid.page.getByText(/オーバーです/)).toBeVisible()
  await expect(sendButton(kid.page)).toBeDisabled()

  await kid.page.getByRole('button', { name: '来月に回す' }).click()
  await expect(kid.page.getByText(/オーバーです/)).toHaveCount(0)
  await send(kid.page, note)
  await kid.page.getByRole('link', { name: '履歴を見る' }).click()
  await expect(requestCard(kid.page, note).locator('.badge')).toHaveText('来月')

  const row = requestCard(parent.page, note)
  await expect(row.locator('.badge')).toHaveText('来月の分', LIVE)
  await expect(parent.page.locator('.family-code')).toContainText(UNUSED_BUDGET)
  await row.getByRole('link').click()

  await parent.page.getByRole('button', { name: '減らす' }).click()
  await expect(parent.page.locator('.cart-row')).toContainText(`× ${reduced} =`)
  await parent.page.getByLabel('子どもへのメッセージ（任意）').fill('少し減らしたよ')
  await parent.page.getByRole('button', { name: '今払う' }).click()

  // 操作した本人には Broadcast が届かない。それでも待たされずに支払い手順が出る
  await expect(parent.page.getByRole('heading', { name: /で支払う/ })).toBeVisible(LIVE)
  await expect(parent.page.locator('header .badge')).toHaveText('未払い')
  await expect(parent.page.locator('.qty-static')).toHaveText(`× ${reduced}`)
  await expect(parent.page.getByRole('button', { name: '今払う' })).toHaveCount(0)

  // 子どもの端末は履歴を開いたまま。別の端末の操作が届く
  const kidRow = requestCard(kid.page, note)
  await expect(kidRow.locator('.badge')).toHaveText('OK', LIVE)
  await expect(kidRow).toContainText('保護者から：少し減らしたよ')

  await parent.page.getByRole('button', { name: /注文済み/ }).click()
  await expect(requestCard(parent.page, note).locator('.badge')).toHaveText('注文済み', LIVE)
  await expect(kidRow.locator('.badge')).toHaveText('注文済み', LIVE)
  // 今払う分は枠の外
  await expect(parent.page.locator('.family-code')).toContainText(UNUSED_BUDGET)

  const { requests, notifyCalls } = await storedFamily(kid.code)
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ status: 'ordered', approved_by: 'parent', parent_note: '少し減らしたよ', pay_month: null })
  expect(requests[0].items[0].qty).toBe(reduced)
  expect(requests[0].total_yen).toBe(requests[0].items[0].unit_yen! * reduced)
  // 来月の分は親に通知しない
  expect(notifyCalls).toBe(0)

  expectNoLeak(kid.context, parent.context)
})

test('来月の分を親が見送る → 枠を使わず、子どもの履歴に反映', async ({ browser }) => {
  const kid = await openKid(browser)
  const parent = await openParent(browser, kid.code)
  const note = '大きなお城'

  await sendNextMonth(kid.page, note)
  await kid.page.getByRole('link', { name: '履歴を見る' }).click()

  const row = requestCard(parent.page, note)
  await expect(row.locator('.badge')).toHaveText('来月の分', LIVE)
  await row.getByRole('link').click()
  await parent.page.getByRole('button', { name: '今回は見送り' }).click()

  await expect(parent.page).toHaveURL(/#\/parent$/)
  await expect(requestCard(parent.page, note).locator('.badge')).toHaveText('見送り', LIVE)
  await expect(parent.page.locator('.family-code')).toContainText(UNUSED_BUDGET)
  await expect(requestCard(kid.page, note).locator('.badge')).toHaveText('今回は見送り', LIVE)

  const { requests } = await storedFamily(kid.code)
  expect(requests[0]).toMatchObject({ status: 'rejected', pay_month: null })

  expectNoLeak(kid.context, parent.context)
})

test('今月の分と来月の分を一緒に送ると、別々に届く', async ({ browser }) => {
  const kid = await openKid(browser)
  const parent = await openParent(browser, kid.code)

  await addPart(kid.page, { qty: 1 })
  await addPart(kid.page, { qty: OVER_BUDGET_QTY, tile: 1 })
  await openCart(kid.page)
  await kid.page.locator('.cart-row').last().getByRole('button', { name: '来月に回す' }).click()
  await send(kid.page)

  await expect(parent.page.locator('.req-card .badge')).toHaveText(['未払い', '来月の分'], LIVE)

  const { requests, notifyCalls } = await storedFamily(kid.code)
  expect(requests.map((r) => r.pay_month).sort()).toEqual([monthKey(), nextMonthKey()])
  expect(requests.map((r) => r.items.length)).toEqual([1, 1])
  expect(notifyCalls).toBe(1)

  expectNoLeak(kid.context, parent.context)
})

test('価格未確認の行だけ親の確認に回り、親が今払うと支払い手順が出る', async ({ browser }) => {
  const kid = await openKid(browser)
  const parent = await openParent(browser, kid.code)
  const note = '在庫のない色'

  await addPart(kid.page, { qty: 1, unknownPrice: true })
  await openCart(kid.page)
  await expect(kid.page.getByText('価格がわからないパーツは保護者が確認します')).toBeVisible()
  await expect(kid.page.getByRole('button', { name: '来月に回す' })).toHaveCount(0)
  await send(kid.page, note)

  const row = requestCard(parent.page, note)
  await expect(row.locator('.badge')).toHaveText('確認', LIVE)
  await expect(parent.page.getByRole('heading', { name: /確認が必要/ })).toBeVisible()
  await row.getByRole('link').click()
  await parent.page.getByRole('button', { name: '今払う' }).click()

  await expect(parent.page.getByRole('heading', { name: /で支払う/ })).toBeVisible(LIVE)

  const { requests, notifyCalls } = await storedFamily(kid.code)
  expect(requests[0]).toMatchObject({ status: 'approved', approved_by: 'parent', total_yen: null })
  expect(notifyCalls).toBe(1)

  expectNoLeak(kid.context, parent.context)
})
