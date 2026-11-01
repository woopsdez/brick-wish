import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Icon } from './Icon'

/** 親スマホで開くとその家族につながるリンク */
function joinUrl(familyId: string): string {
  return `${location.origin}${location.pathname}#/join/${familyId}`
}

/** 親スマホをつなぐための QR とリンク。子の端末の親画面に出す */
export function JoinQr({ familyId, collapsed }: { familyId: string; collapsed?: boolean }) {
  const url = joinUrl(familyId)
  const [png, setPng] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#141416', light: '#ffffff' } })
      .then((d) => alive && setPng(d))
      .catch(() => alive && setPng(null))
    return () => {
      alive = false
    }
  }, [url])

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <details className="join-card" open={!collapsed}>
      <summary>親スマホをつなぐ（カメラで QR を読む）</summary>
      <div className="join-body">
        {png ? <img src={png} alt={`ファミリー ${familyId} につなぐ QR コード`} width={120} height={120} /> : <div className="join-qr-ph" aria-hidden="true" />}
        <div className="stack-tight">
          <p className="muted small">親スマホのカメラでこの QR を読むと、入力なしでつながります。</p>
          <p className="small">
            ファミリーコード <code>{familyId}</code>
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => void copy()}>
            <Icon name="copy" size={16} />
            {copied ? 'コピーした' : 'リンクをコピー'}
          </button>
        </div>
      </div>
    </details>
  )
}
