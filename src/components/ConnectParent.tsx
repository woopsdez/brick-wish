import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { saveSettings, useSettings } from '../store/settings'

function joinUrl(familyId: string): string {
  return `${location.origin}${location.pathname}#/join/${familyId}`
}

/**
 * 親スマホをつなぐ。親スマホのカメラで子どもの端末の QR を読む、の一方向だけ。
 * つなぐ前は端末の種類が分からないので最初に 1 回聞き、QR は子どもの端末にだけ出す。
 */
export function ConnectParent({ familyId }: { familyId: string }) {
  const { deviceRole } = useSettings()
  const url = joinUrl(familyId)
  const [png, setPng] = useState<string | null>(null)

  useEffect(() => {
    if (deviceRole !== 'kid') return
    let alive = true
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#141416', light: '#ffffff' } })
      .then((d) => alive && setPng(d))
      .catch(() => alive && setPng(null))
    return () => {
      alive = false
    }
  }, [url, deviceRole])

  const redo = (
    <button type="button" className="connect-redo" onClick={() => saveSettings({ deviceRole: null })}>
      選び直す
    </button>
  )

  if (deviceRole === 'kid') {
    return (
      <div className="connect">
        {png ? <img src={png} alt={`ファミリー ${familyId} につなぐ QR コード`} width={120} height={120} /> : <div className="join-qr-ph" aria-hidden="true" />}
        <div>
          <p className="connect-label">親のスマホのカメラで読む</p>
          <p className="muted small">開いた画面で「つなぐ」を押す</p>
          <p className="muted small">
            コード <code>{familyId}</code>
          </p>
          {redo}
        </div>
      </div>
    )
  }

  if (deviceRole === 'parent') {
    return (
      <div className="connect connect-column">
        <p className="connect-label">子どもの端末の QR をカメラで読む</p>
        <p className="muted small">子どもの端末でこの画面を開くと QR が出ます。カメラが使えないときは 設定 › コードで入れる</p>
        {redo}
      </div>
    )
  }

  return (
    <div className="connect connect-column">
      <p className="connect-label">この端末はどっち？</p>
      <div className="connect-choices">
        <button type="button" className="btn btn-ghost" onClick={() => saveSettings({ deviceRole: 'kid' })}>
          子どもの端末
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => saveSettings({ deviceRole: 'parent' })}>
          親のスマホ
        </button>
      </div>
    </div>
  )
}
