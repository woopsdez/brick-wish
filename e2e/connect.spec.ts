import { writeFile } from 'node:fs/promises'
import { chromium, expect, test, type Browser, type Page } from '@playwright/test'
import { expectNoLeak, LIVE, newDevice, openKid, requestCard, sendOverBudget } from './helpers'

const PIN = '1234'

async function setPin(page: Page) {
  await page.getByPlaceholder('••••').fill(PIN)
  await page.getByPlaceholder('もう一度').fill(PIN)
  await page.getByRole('button', { name: '決める' }).click()
}

/** 親画面を初めて開いて PIN を決め、「この端末はどっち？」まで進む */
async function openConnect(page: Page) {
  await page.goto('#/parent')
  await setPin(page)
  await expect(page.getByText('この端末はどっち？')).toBeVisible()
}

/** 子どもの端末の親画面に出ている QR の画素を読む */
async function readQrPixels(page: Page) {
  const img = page.getByRole('img', { name: /につなぐ QR コード/ })
  await expect(img).toBeVisible()
  return img.evaluate((el: HTMLImageElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = el.naturalWidth
    canvas.height = el.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(el, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { rgba: Array.from(data), width, height }
  })
}

/** 画面の QR を中央に置いた 1 コマの動画（Y4M）。Chromium の偽カメラはこれを繰り返し流す */
function toY4m({ rgba, width, height }: { rgba: number[]; width: number; height: number }) {
  const W = 640
  const H = 480
  const luma = Buffer.alloc(W * H, 255)
  const left = Math.floor((W - width) / 2)
  const top = Math.floor((H - height) / 2)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      luma[(top + y) * W + left + x] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2])
    }
  }
  const chroma = Buffer.alloc((W * H) / 2, 128)
  return Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\nFRAME\n`), luma, chroma])
}

/** つながったことを、親の一覧に子どものおねがいが届くことで確かめる */
async function expectConnected(kid: Page, parent: Page, note: string) {
  await expect(parent.getByText('この端末はどっち？')).toHaveCount(0)
  await expect(parent.getByText('子どもの端末の QR を映す')).toHaveCount(0)
  await kid.getByRole('link', { name: '子ども画面へ' }).click()
  await sendOverBudget(kid, note)
  await expect(requestCard(parent, note).locator('.badge')).toHaveText('承認待ち', LIVE)
}

async function withBrowser(args: string[], run: (browser: Browser) => Promise<void>) {
  const browser = await chromium.launch({ args })
  try {
    await run(browser)
  } finally {
    await browser.close()
  }
}

test('この端末はどっち？: 子どもの端末には QR、親のスマホにはカメラ。選び直せる', async ({ browser }) => {
  const kid = await openKid(browser)
  await openConnect(kid.page)

  await kid.page.getByRole('button', { name: '子どもの端末' }).click()
  await expect(kid.page.getByRole('img', { name: `ファミリー ${kid.code} につなぐ QR コード` })).toBeVisible()
  await expect(kid.page.locator('.connect code')).toHaveText(kid.code)

  await kid.page.getByRole('button', { name: '選び直す' }).click()
  await expect(kid.page.getByText('この端末はどっち？')).toBeVisible()

  await kid.page.getByRole('button', { name: '親のスマホ' }).click()
  await expect(kid.page.getByText('子どもの端末の QR を映す')).toBeVisible()
  await expect(kid.page.getByRole('img', { name: /QR コード/ })).toHaveCount(0)

  expectNoLeak(kid.context)
})

test('親のスマホのカメラで子どもの端末の QR を読んでつなぐ', async ({ browser }, testInfo) => {
  const kid = await openKid(browser)
  await openConnect(kid.page)
  await kid.page.getByRole('button', { name: '子どもの端末' }).click()

  const video = testInfo.outputPath('kid-qr.y4m')
  await writeFile(video, toY4m(await readQrPixels(kid.page)))

  await withBrowser(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`], async (phone) => {
    const parent = await newDevice(phone, 'parent')
    await openConnect(parent.page)
    await parent.page.getByRole('button', { name: '親のスマホ' }).click()

    await expectConnected(kid.page, parent.page, 'QR でつないだ')
    expectNoLeak(kid.context, parent.context)
  })
})

test('カメラを拒否したらコード入力に切り替わり、コードでつなげる', async ({ browser }) => {
  const kid = await openKid(browser)
  await openConnect(kid.page)
  await kid.page.getByRole('button', { name: '子どもの端末' }).click()

  await withBrowser(['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream=deny'], async (phone) => {
    const parent = await newDevice(phone, 'parent')
    await openConnect(parent.page)
    const unavailable = parent.page.waitForEvent('console', (m) => m.text().includes('camera unavailable'))
    await parent.page.getByRole('button', { name: '親のスマホ' }).click()

    // カメラが無いのではなく、許可を拒否されて切り替わったことを確かめる
    expect((await unavailable).text()).toContain('NotAllowedError')
    const input = parent.page.getByLabel('コード')
    await expect(input).toBeVisible(LIVE)
    await expect(parent.page.getByLabel('カメラの映像')).toHaveCount(0)

    // 打ち間違いは画面で分かり、そのまま打ち直せる
    await input.fill('ZZZZZZ')
    await parent.page.getByRole('button', { name: 'つなぐ' }).click()
    await expect(parent.page.getByText('そのコードの家族は見つかりません')).toBeVisible()

    await input.fill(kid.code.toLowerCase())
    await expect(input).toHaveValue(kid.code)
    await parent.page.getByRole('button', { name: 'つなぐ' }).click()

    await expectConnected(kid.page, parent.page, 'コードでつないだ')
    expectNoLeak(kid.context, parent.context)
  })
})
