import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function joinUrl(familyId: string): string {
  return `${location.origin}${location.pathname}#/join/${familyId}`
}

/**
 * 親スマホをつなぐ。QR を出しておくだけ。親スマホのカメラで読むと /join/<code> が開き、「つなぐ」で完了。
 * カメラが使えない端末向けに、コードを下に添える（相手の設定「コードで入れる」用）。
 */
export function ConnectParent({ familyId }: { familyId: string }) {
  const url = joinUrl(familyId)
  const [png, setPng] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#141416', light: '#ffffff' } })
      .then((d) => alive && setPng(d))
      .catch(() => alive && setPng(null))
    return () => {
      alive = false
    }
  }, [url])

  return (
    <div className="connect">
      {png ? <img src={png} alt={`ファミリー ${familyId} につなぐ QR コード`} width={120} height={120} /> : <div className="join-qr-ph" aria-hidden="true" />}
      <div>
        <p className="connect-label">親スマホとつなぐ</p>
        <p className="muted small">カメラで読んで「つなぐ」</p>
        <p className="muted small">
          コード <code>{familyId}</code>
        </p>
      </div>
    </div>
  )
}
