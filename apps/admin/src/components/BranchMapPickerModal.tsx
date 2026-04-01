import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Button, message, Spin } from 'antd'
import { useTranslation } from 'react-i18next'

const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753 }

function getMapsKey(): string | undefined {
  const env = (import.meta as { env?: Record<string, string> }).env
  const fromVite = env?.VITE_GOOGLE_MAPS_API_KEY?.trim()
  if (fromVite) return fromVite
  // Docker/nginx: .env is dockerignored at build time; runtime-entrypoint.sh sets this on window
  if (typeof window !== 'undefined') {
    const w = window as Window & { VITE_GOOGLE_MAPS_API_KEY?: string }
    const fromRuntime = w.VITE_GOOGLE_MAPS_API_KEY?.trim()
    if (fromRuntime) return fromRuntime
  }
  return undefined
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  const w = window as Window & { google?: { maps: unknown } }
  if (w.google?.maps) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>('script[data-branch-map-loader]')
  if (existing) {
    return new Promise((resolve, reject) => {
      const done = () => {
        if (w.google?.maps) resolve()
        else reject(new Error('Google Maps not available'))
      }
      if (existing.dataset.loaded === '1') {
        done()
        return
      }
      existing.addEventListener('load', done)
      existing.addEventListener('error', () => reject(new Error('load failed')))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
    script.async = true
    script.defer = true
    script.dataset.branchMapLoader = ''
    script.addEventListener('load', () => {
      script.dataset.loaded = '1'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error('load failed')))
    document.head.appendChild(script)
  })
}

type Props = {
  open: boolean
  onClose: () => void
  initialLat?: number | null
  initialLng?: number | null
  onConfirm: (lat: number, lng: number) => void
}

export default function BranchMapPickerModal({
  open,
  onClose,
  initialLat,
  initialLng,
  onConfirm,
}: Props) {
  const { t } = useTranslation()
  const mapElRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<{ setMap: (m: null) => void; setPosition: (p: unknown) => void; addListener: (ev: string, fn: () => void) => void } | null>(
    null,
  )
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const apiKey = getMapsKey()

  const teardown = useCallback(() => {
    markerRef.current?.setMap(null)
    markerRef.current = null
    if (mapElRef.current) mapElRef.current.innerHTML = ''
  }, [])

  useEffect(() => {
    if (!open) {
      teardown()
      setPicked(null)
      return
    }
    if (!apiKey) return

    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        await loadGoogleMapsScript(apiKey)
        if (cancelled || !mapElRef.current) return

        const gmaps = (window as unknown as { google: { maps: Record<string, new (...args: unknown[]) => unknown> } }).google.maps
        const MapCtor = gmaps.Map as new (el: HTMLElement, opts: object) => {
          addListener: (ev: string, fn: (e: { latLng?: { lat: () => number; lng: () => number } | null }) => void) => void
        }
        const MarkerCtor = gmaps.Marker as new (opts: object) => {
          setPosition: (p: unknown) => void
          setMap: (m: unknown) => void
          getPosition: () => { lat: () => number; lng: () => number } | null | undefined
          addListener: (ev: string, fn: () => void) => void
        }

        const lat =
          initialLat != null && Number.isFinite(Number(initialLat))
            ? Number(initialLat)
            : DEFAULT_CENTER.lat
        const lng =
          initialLng != null && Number.isFinite(Number(initialLng))
            ? Number(initialLng)
            : DEFAULT_CENTER.lng
        const center = { lat, lng }

        const map = new MapCtor(mapElRef.current, {
          center,
          zoom: 16,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        })

        const marker = new MarkerCtor({
          position: center,
          map,
          draggable: true,
        })
        markerRef.current = marker
        setPicked(center)

        const syncFromLatLng = (ll: { lat: () => number; lng: () => number }) => {
          setPicked({ lat: ll.lat(), lng: ll.lng() })
        }

        map.addListener('click', (e) => {
          if (!e.latLng) return
          marker.setPosition(e.latLng)
          syncFromLatLng(e.latLng)
        })

        marker.addListener('dragend', () => {
          const p = marker.getPosition?.()
          if (p) syncFromLatLng(p)
        })
      } catch {
        message.error(t('branches.map_picker_load_failed') || 'Failed to load Google Maps')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const id = window.setTimeout(run, 50)
    return () => {
      cancelled = true
      window.clearTimeout(id)
      teardown()
    }
  }, [open, apiKey, initialLat, initialLng, teardown, t])

  const handleConfirm = () => {
    if (!picked) return
    onConfirm(picked.lat, picked.lng)
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={880}
      destroyOnClose
      title={t('branches.map_picker_title') || 'Select branch location'}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common.cancel') || 'Cancel'}
        </Button>,
        <Button key="ok" type="primary" disabled={!picked || loading} onClick={handleConfirm}>
          {t('branches.map_picker_use') || 'Use this location'}
        </Button>,
      ]}
    >
      {!apiKey ? (
        <p style={{ color: '#cf1322' }}>{t('branches.map_picker_missing_key') || 'Google Maps API key is missing'}</p>
      ) : (
        <>
          <p style={{ marginBottom: 12, color: '#666' }}>
            {t('branches.map_picker_help') || 'Click on the map to choose coordinates'}
          </p>
          <Spin spinning={loading}>
            <div
              ref={mapElRef}
              style={{
                width: '100%',
                height: 420,
                borderRadius: 8,
                background: '#e8e8e8',
              }}
            />
          </Spin>
        </>
      )}
    </Modal>
  )
}
