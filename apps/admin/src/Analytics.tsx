import { useEffect } from 'react'

function getEnvGtmId(): string | undefined {
  const env = (import.meta as any).env || {}
  const id = env.VITE_GTM_ID || (window as any).NEXT_PUBLIC_GTM_ID
  return typeof id === 'string' && id ? id : undefined
}

function getSettings(): { enabled: boolean; gtmId?: string } {
  try {
    const enabled = localStorage.getItem('settings.analyticsEnabled') === 'true'
    const gtmId = localStorage.getItem('settings.gtmId') || getEnvGtmId()
    return { enabled, gtmId: gtmId || undefined }
  } catch {
    return { enabled: false, gtmId: getEnvGtmId() }
  }
}

export default function Analytics() {
  useEffect(() => {
    const { enabled, gtmId } = getSettings()
    if (!enabled || !gtmId) return
    if (document.getElementById('gtm-script')) return

    // dataLayer
    ;(window as any).dataLayer = (window as any).dataLayer || []
    ;(window as any).dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })

    // Script
    const script = document.createElement('script')
    script.id = 'gtm-script'
    script.async = true
    script.innerHTML = `\n(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\nnew Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\n j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n})(window,document,'script','dataLayer','${gtmId}');\n`
    document.head.appendChild(script)

    // NoScript (optional)
    const noscript = document.createElement('noscript')
    noscript.id = 'gtm-noscript'
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
    document.body.appendChild(noscript)

    return () => {
      try {
        document.getElementById('gtm-script')?.remove()
        document.getElementById('gtm-noscript')?.remove()
      } catch {}
    }
  }, [])

  return null
}


