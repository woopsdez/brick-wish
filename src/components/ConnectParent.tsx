import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Icon } from './Icon'

function joinUrl(familyId: string): string {
  return `${location.origin}${location.pathname}#/join/${familyId}`
}

/**
 * 親スマホをつなぐ。基本は「リンクを送る」（共有シート。無ければコピー）。相手がリンクを開いて「つなぐ」を押せば完了。
 * QR は押したときだけ出す。
 */
export function ConnectParent({ familyId }: { familyId: string }) {
  const url = joinUrl(familyId)
  const [showQr, setShowQr] = useState(false)
  const [png, setPng] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!showQr) return
    let alive = true
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#141416', light: '#ffffff' } })
      .then((d) => alive && setPng(d))
      .catch(() => alive && setPng(null))
    return () => {
      alive = false
    }
  }, [url, showQr])

  async function share() {
    setMsg(null)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Brick Wish', text: '親スマホでこのリンクを開いて「つなぐ」を押すと、子どものおねがいが届きます', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setMsg('リンクをコピーしました。相手に送ってください')
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return
      setMsg('送れませんでした。QR を読んでもらってください')
    }
  }

  return (
    <div className="connect">
      <div className="connect-row">
        <span className="connect-label">親スマホとつなぐ</span>
        <button type="button" className="btn" onClick={() => void share()}>
          <Icon name="send" size={18} />
          リンクを送る
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
          QR
        </button>
      </div>
      {msg && <p className="muted small">{msg}</p>}
      {showQr && (
        <div className="join-body">
          {png ? <img src={png} alt={`ファミリー ${familyId} につなぐ QR コード`} width={120} height={120} /> : <div className="join-qr-ph" aria-hidden="true" />}
          <p className="muted small">
            親スマホのカメラで読む。読めないときは、相手の設定の「コードで入れる」にコード <code>{familyId}</code>
          </p>
        </div>
      )}
    </div>
  )
}
