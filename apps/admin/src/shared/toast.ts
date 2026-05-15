import { message, notification } from 'antd'

const isRtl = (() => {
  try {
    return (localStorage.getItem('console_lang') || 'ar') === 'ar'
  } catch {
    return true
  }
})()

// Configure antd message once at module load.
message.config({ top: 80, duration: 3, maxCount: 4, rtl: isRtl })
notification.config({ placement: isRtl ? 'topLeft' : 'topRight', duration: 4, rtl: isRtl })

export const toast = {
  success(text: string) {
    void message.success(text)
  },
  error(text: string) {
    void message.error(text)
  },
  info(text: string) {
    void message.info(text)
  },
  warning(text: string) {
    void message.warning(text)
  },
  loading(text: string, key?: string) {
    void message.loading({ content: text, key, duration: 0 })
    return () => message.destroy(key)
  },
}
