const CHECK_INTERVAL_MS = 60_000

/**
 * 公開された新しい版へ自動で切り替える。Service Worker は新しい版を裏で取得するだけで、開いている画面は古いまま動き続ける。
 * 入力中に画面が飛ばないよう、再読み込みは次の画面移動かアプリから離れたときに行う（カートは localStorage にあるので消えない）。
 */
export function watchForNewVersion() {
  if (!('serviceWorker' in navigator)) return
  const sw = navigator.serviceWorker
  let hadController = !!sw.controller
  let ready = false
  let lastCheck = 0

  function check() {
    if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return
    lastCheck = Date.now()
    void sw
      .getRegistration()
      .then((r) => r?.update())
      .catch(() => undefined)
  }

  sw.addEventListener('controllerchange', () => {
    // 初回インストールでも発火する。このときの画面はすでに最新なので再読み込みしない
    if (!hadController) {
      hadController = true
      return
    }
    ready = true
    if (document.hidden) location.reload()
  })

  window.addEventListener('hashchange', () => {
    if (ready) location.reload()
    else check()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (ready) location.reload()
    } else {
      check()
    }
  })
}
