import { useEffect, useRef, useState } from 'react'
import { parseJoinUrl } from '../lib/ids'

const SCAN_INTERVAL_MS = 150
const MAX_FRAME_WIDTH = 640

/**
 * アプリ内カメラでつなぐ QR を読む。iPhone はホーム画面のアプリと Safari の保存領域が別なので、
 * 標準カメラで読むと Safari 側につながってしまう。アプリの中で読めば通知を受けるアプリ自身につながる。
 */
export function QrScanner({ onCode, onUnavailable }: { onCode: (code: string) => void; onUnavailable: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const handlers = useRef({ onCode, onUnavailable })
  const [foreign, setForeign] = useState(false)

  useEffect(() => {
    handlers.current = { onCode, onUnavailable }
  })

  useEffect(() => {
    let alive = true
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    function stop() {
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api')
      const [{ default: jsQR }, s] = await Promise.all([
        import('jsqr'),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
      ])
      stream = s
      const el = video.current
      if (!alive || !el) return stop()
      el.srcObject = s
      await el.play()

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('no canvas')

      const scan = () => {
        if (!alive) return
        if (el.readyState >= el.HAVE_CURRENT_DATA && el.videoWidth > 0) {
          const scale = Math.min(1, MAX_FRAME_WIDTH / el.videoWidth)
          canvas.width = Math.round(el.videoWidth * scale)
          canvas.height = Math.round(el.videoHeight * scale)
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const hit = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })
          if (hit) {
            const code = parseJoinUrl(hit.data)
            if (code) {
              stop()
              handlers.current.onCode(code)
              return
            }
            setForeign(true)
          }
        }
        timer = setTimeout(scan, SCAN_INTERVAL_MS)
      }
      scan()
    }

    start().catch((e) => {
      console.warn('camera unavailable', e)
      stop()
      if (alive) handlers.current.onUnavailable()
    })
    return () => {
      alive = false
      stop()
    }
  }, [])

  return (
    <div className="scanner">
      <video ref={video} muted playsInline aria-label="カメラの映像" />
      {foreign && <p className="muted small">Brick Wish の QR ではありません</p>}
    </div>
  )
}
