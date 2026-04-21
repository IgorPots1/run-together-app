'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'

type Coordinates = {
  latitude: number
  longitude: number
}

type RunLocationPickerProps = {
  apiKey?: string
  value: Coordinates | null
  onChange: (value: Coordinates | null) => void
}

type MapClickEvent = {
  lngLat: [number, number]
}

type MapInstance = {
  on: (event: 'click', handler: (event: MapClickEvent) => void) => void
  setCenter: (coordinates: [number, number]) => void
  destroy: () => void
}

type MarkerInstance = {
  setCoordinates: (coordinates: [number, number]) => void
  destroy: () => void
}

type MapGlApi = {
  Map: new (
    container: string,
    options: {
      center: [number, number]
      zoom: number
      key: string
    }
  ) => MapInstance
  Marker: new (
    map: MapInstance,
    options: {
      coordinates: [number, number]
    }
  ) => MarkerInstance
}

declare global {
  interface Window {
    mapgl?: MapGlApi
  }
}

const mapShellStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 12,
  overflow: 'hidden',
  backgroundColor: '#f8fafc',
}

const mapContainerStyle: CSSProperties = {
  width: '100%',
  height: 260,
}

const helperTextStyle: CSSProperties = {
  color: '#475569',
  fontSize: 14,
  padding: '10px 12px 12px',
}

const defaultCenter: [number, number] = [37.618423, 55.751244]
const mapGlScriptSrc = 'https://mapgl.2gis.com/api/js/v1'

let mapGlPromise: Promise<MapGlApi> | null = null

function loadMapGl(): Promise<MapGlApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Map can only load in the browser'))
  }

  if (window.mapgl) {
    return Promise.resolve(window.mapgl)
  }

  if (mapGlPromise) {
    return mapGlPromise
  }

  mapGlPromise = new Promise<MapGlApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${mapGlScriptSrc}"]`
    )

    const handleLoad = () => {
      if (window.mapgl) {
        resolve(window.mapgl)
        return
      }

      reject(new Error('2GIS script loaded without map API'))
    }

    const handleError = () => {
      reject(new Error('Failed to load 2GIS map script'))
    }

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true })
      existingScript.addEventListener('error', handleError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = mapGlScriptSrc
    script.async = true
    script.defer = true
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    mapGlPromise = null
    throw error
  })

  return mapGlPromise
}

export default function RunLocationPicker({
  apiKey,
  value,
  onChange,
}: RunLocationPickerProps) {
  const mapId = useId().replace(/:/g, '')
  const mapRef = useRef<MapInstance | null>(null)
  const markerRef = useRef<MarkerInstance | null>(null)
  const mapGlRef = useRef<MapGlApi | null>(null)
  const valueRef = useRef(value)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    if (!apiKey) {
      return
    }

    const activeApiKey = apiKey
    let isActive = true

    async function setupMap() {
      setStatus('loading')

      try {
        const mapgl = await loadMapGl()

        if (!isActive) {
          return
        }

        mapGlRef.current = mapgl

        const initialValue = valueRef.current
        const center: [number, number] = initialValue
          ? [initialValue.longitude, initialValue.latitude]
          : defaultCenter

        const map = new mapgl.Map(mapId, {
          center,
          zoom: initialValue ? 15 : 11,
          key: activeApiKey,
        })

        mapRef.current = map

        if (initialValue) {
          markerRef.current = new mapgl.Marker(map, {
            coordinates: [initialValue.longitude, initialValue.latitude],
          })
        }

        map.on('click', (event) => {
          const [longitude, latitude] = event.lngLat
          const nextValue = { latitude, longitude }

          if (markerRef.current) {
            markerRef.current.setCoordinates([longitude, latitude])
          } else if (mapGlRef.current) {
            markerRef.current = new mapGlRef.current.Marker(map, {
              coordinates: [longitude, latitude],
            })
          }

          onChange(nextValue)
        })

        setStatus('ready')
      } catch (error) {
        console.error(error)

        if (isActive) {
          setStatus('error')
        }
      }
    }

    void setupMap()

    return () => {
      isActive = false
      markerRef.current?.destroy()
      markerRef.current = null
      mapRef.current?.destroy()
      mapRef.current = null
    }
  }, [apiKey, mapId, onChange])

  useEffect(() => {
    if (!mapRef.current || !mapGlRef.current) {
      return
    }

    if (!value) {
      markerRef.current?.destroy()
      markerRef.current = null
      mapRef.current.setCenter(defaultCenter)
      return
    }

    const coordinates: [number, number] = [value.longitude, value.latitude]

    if (markerRef.current) {
      markerRef.current.setCoordinates(coordinates)
    } else {
      markerRef.current = new mapGlRef.current.Marker(mapRef.current, {
        coordinates,
      })
    }

    mapRef.current.setCenter(coordinates)
  }, [value])

  if (!apiKey) {
    return (
      <div style={mapShellStyle}>
        <div style={helperTextStyle}>
          Добавьте переменную окружения NEXT_PUBLIC_2GIS_MAP_KEY, чтобы выбрать точку на карте.
        </div>
      </div>
    )
  }

  return (
    <div style={mapShellStyle}>
      <div id={mapId} style={mapContainerStyle} />
      {status === 'loading' && (
        <div style={helperTextStyle}>Загружаем карту 2GIS...</div>
      )}
      {status === 'error' && (
        <div style={helperTextStyle}>Не удалось загрузить карту. Попробуйте обновить страницу.</div>
      )}
      {status === 'ready' && (
        <div style={helperTextStyle}>Кликните по карте, чтобы выбрать место старта.</div>
      )}
    </div>
  )
}
