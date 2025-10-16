import { useEffect } from 'react'

function getSettings(): { enabled: boolean; pixelId?: string } {
  try {
    const enabled = localStorage.getItem('settings.pixelEnabled') === 'true'
    const pixelId = localStorage.getItem('settings.pixelId') || undefined
    return { enabled, pixelId }
  } catch {
    return { enabled: false, pixelId: undefined }
  }
}

export default function MetaPixel() {
  useEffect(() => {
    const { enabled, pixelId } = getSettings()
    if (!enabled || !pixelId) return
    if ((window as any).fbq) return

    // Insert Meta Pixel Script
    (function(f:any,b:any,e:any,v:any,n?:any,t?:any,s?:any){
      if(f.fbq)return; n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0';
      n.queue=[]; t=b.createElement(e); t.async=!0;
      t.src=v; s=b.getElementsByTagName(e)[0];
      s.parentNode!.insertBefore(t,s)
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    ;(window as any).fbq('init', pixelId)
    ;(window as any).fbq('track', 'PageView')

    // NoScript image fallback
    const noscript = document.createElement('noscript')
    noscript.id = 'meta-pixel-noscript'
    noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`
    document.body.appendChild(noscript)

    return () => {
      try { document.getElementById('meta-pixel-noscript')?.remove() } catch {}
    }
  }, [])
  return null
}


