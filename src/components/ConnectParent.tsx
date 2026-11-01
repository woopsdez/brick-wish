import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { joinUrl, normalizeFamilyCode } from '../lib/ids'
import { resubscribeParentPush } from '../lib/push'
import { joinFamily } from '../store/family'
import { saveSettings, useSettings } from '../store/settings'
import { QrScanner } from './QrScanner'

/** 親のスマホ側: アプリ内カメラで子どもの端末の QR を読む。カメラが使えないときはコードを入れる */
function ParentPhoneJoin({ redo }: { redo: React.ReactNode }) {
  const [typing, setTyping] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  async function join(c: string) {
    setBusy(true)
    setErr(null)
    try {
      await joinFamily(c)
      // 通知を許可済みの端末なら、購読をこの家族に付け替える
      await resubscribeParentPush(c).catch(() => undefined)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setAttempt((n) => n + 1)
      setBusy(false)
    }
  }

  return (
    <div className="connect connect-column">
      <p className="connect-label">子どもの端末の QR を映す</p>
      {!typing && !busy && <QrScanner key={attempt} onCode={(c) => void join(c)} onUnavailable={() => setTyping(true)} />}
      {typing ? (
        <div className="connect-code">
          <p className="muted small">子どもの端末の QR の下に出ているコードを入れる</p>
          <div className="row">
            <input value={code} onChange={(e) => setCode(normalizeFamilyCode(e.target.value))} placeholder="6 文字" autoCapitalize="characters" aria-label="コード" />
            <button type="button" className="btn btn-ghost" onClick={() => void join(code)} disabled={code.length !== 6 || busy}>
              つなぐ
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="connect-redo" onClick={() => setTyping(true)}>
          コードを入力する
        </button>
      )}
      {err && <p className="error">{err}</p>}
      {redo}
    </div>
  )
}

/**
 * 親スマホをつなぐ。親のスマホで子どもの端末の QR を読む、の一方向だけ。
 * つなぐ前は端末の種類が分からないので最初に 1 回聞き、QR は子どもの端末に、カメラは親のスマホに出す。
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
          <p className="connect-label">親のスマホのアプリで読む</p>
          <p className="muted small">親のスマホでこの画面を開き「親のスマホ」を選ぶ</p>
          <p className="muted small">
            コード <code>{familyId}</code>
          </p>
          {redo}
        </div>
      </div>
    )
  }

  if (deviceRole === 'parent') return <ParentPhoneJoin redo={redo} />

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
