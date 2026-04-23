'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'

import { AuthSplash } from '@/components/AuthSplash'
import { isProfileComplete } from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'
import { useAuthProfile } from '@/lib/useAuthProfile'

type RunCoordinates = {
  latitude: number
  longitude: number
}

type ReverseGeocodeItem = {
  name?: string
  address_name?: string
  building_name?: string
  full_name?: string
  search_attributes?: {
    suggested_text?: string
  }
}

type GeocodePoint = {
  lat?: number
  lon?: number
}

type GeocodeSearchItem = ReverseGeocodeItem & {
  point?: GeocodePoint
}

type ReverseGeocodeResponse = {
  meta?: {
    code?: number
  }
  result?: {
    items?: GeocodeSearchItem[]
  }
}

type LocationSuggestion = {
  label: string
  latitude: number
  longitude: number
}

const pageStyle: CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '24px 16px 120px',
}

const cardStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  backgroundColor: '#fff',
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  marginTop: 6,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: 0,
}

const secondaryTextStyle: CSSProperties = {
  color: '#475569',
  fontSize: 14,
}

const inputGroupStyle: CSSProperties = {
  position: 'relative',
}

const suggestionsListStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 10,
  marginTop: 6,
  padding: 0,
  listStyle: 'none',
  border: '1px solid #cbd5e1',
  borderRadius: 12,
  backgroundColor: '#fff',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
  overflow: 'hidden',
}

const suggestionButtonStyle: CSSProperties = {
  width: '100%',
  padding: '12px',
  border: 0,
  borderBottom: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  textAlign: 'left',
  fontSize: 15,
  lineHeight: 1.4,
  cursor: 'pointer',
}

const suggestionStatusStyle: CSSProperties = {
  padding: '12px',
  fontSize: 14,
  color: '#475569',
  backgroundColor: '#fff',
}

const formStyle: CSSProperties = {
  display: 'grid',
  gap: 0,
}

const sectionStyle: CSSProperties = {
  ...cardStyle,
  display: 'grid',
  gap: 14,
  marginBottom: 0,
}

const sectionSpacingStyle: CSSProperties = {
  marginTop: 28,
}

const chipListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10,
}

const chipStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 999,
  padding: '6px 10px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12,
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '10px 14px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
}

const stickyActionBarStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
  backgroundColor: 'rgba(255, 255, 255, 0.96)',
  borderTop: '1px solid #e2e8f0',
  boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.08)',
  backdropFilter: 'blur(10px)',
}

const stickyActionInnerStyle: CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
}

const primaryButtonStyle: CSSProperties = {
  width: '100%',
  border: 0,
  borderRadius: 12,
  padding: '14px 16px',
  backgroundColor: '#2563eb',
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
}

const paceOptions = ['05:00', '05:30', '06:00', '06:30', '07:00']
const mapApiKey = process.env.NEXT_PUBLIC_2GIS_MAP_KEY
const runnerFriendlyLocationPatterns = [
  /\bулиц/i,
  /\bул\./i,
  /\bпросп/i,
  /\bпарк/i,
  /\bсквер/i,
  /\bнабереж/i,
  /\bплощад/i,
  /\bрайон/i,
  /\bмикрорайон/i,
  /\bбульвар/i,
  /\bалле/i,
  /\bпроезд/i,
  /\bшоссе/i,
]
const verboseLocationPatterns = [
  /\bроссия\b/i,
  /\bобласть\b/i,
  /\bкрай\b/i,
  /\bреспублика\b/i,
  /\bгородской округ\b/i,
  /\bг\./i,
]
const RunLocationPicker = dynamic(() => import('@/components/RunLocationPicker'), {
  ssr: false,
})

function parsePaceInput(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/)

  if (!match) {
    return null
  }

  const minutes = Number(match[1])
  const seconds = Number(match[2])

  return minutes * 60 + seconds
}

function normalizePaceInput(value: string): string {
  const cleanedValue = value.replace(/[^\d:]/g, '')

  if (cleanedValue === '') {
    return ''
  }

  if (cleanedValue.includes(':')) {
    const [minutesPart = '', secondsPart = ''] = cleanedValue.split(':', 2)
    const minutes = minutesPart.replace(/\D/g, '').slice(0, 2)
    const seconds = secondsPart.replace(/\D/g, '').slice(0, 2)

    if (cleanedValue.endsWith(':') && seconds === '') {
      return minutes === '' ? '' : `${minutes}:`
    }

    return seconds === '' ? minutes : `${minutes}:${seconds}`
  }

  const digits = cleanedValue.replace(/\D/g, '').slice(0, 4)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length === 3) {
    return `0${digits[0]}:${digits.slice(1)}`
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

function finalizePaceInput(value: string): string {
  const paceSeconds = parsePaceInput(value)

  if (paceSeconds == null) {
    return value.trim()
  }

  const minutesPart = Math.floor(paceSeconds / 60)
  const secondsPart = paceSeconds % 60

  return `${String(minutesPart).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}`
}

function normalizeLocationPart(value?: string): string | null {
  if (!value) {
    return null
  }

  const normalizedValue = value.replace(/\s+/g, ' ').trim()

  return normalizedValue === '' ? null : normalizedValue
}

function splitLocationCandidates(value?: string): string[] {
  const normalizedValue = normalizeLocationPart(value)

  if (!normalizedValue) {
    return []
  }

  return normalizedValue
    .split(',')
    .map((part) => normalizeLocationPart(part) ?? '')
    .filter((part) => part !== '')
}

function hasHouseNumber(value: string): boolean {
  return /\b\d+[а-яa-z]?(?:\/\d+)?\b/i.test(value)
}

function isRunnerFriendlyLocation(value: string): boolean {
  return runnerFriendlyLocationPatterns.some((pattern) => pattern.test(value))
}

function isVerboseLocation(value: string): boolean {
  return verboseLocationPatterns.some((pattern) => pattern.test(value))
}

function scoreLocationCandidate(value: string): number {
  let score = 0

  if (isRunnerFriendlyLocation(value)) {
    score += 50
  }

  if (hasHouseNumber(value)) {
    score -= 14
  }

  if (value.includes(',')) {
    score -= 12
  }

  if (value.length <= 32) {
    score += 8
  } else if (value.length <= 48) {
    score += 3
  } else {
    score -= 10
  }

  if (isVerboseLocation(value)) {
    score -= 20
  }

  return score
}

function resolveShortLocation(item: ReverseGeocodeItem): string | null {
  const candidates = Array.from(
    new Set(
      [
        normalizeLocationPart(item.name),
        normalizeLocationPart(item.address_name),
        normalizeLocationPart(item.building_name),
        ...splitLocationCandidates(item.address_name),
        ...splitLocationCandidates(item.full_name),
      ].filter((value): value is string => value !== null)
    )
  )

  if (candidates.length === 0) {
    return null
  }

  return [...candidates].sort((left, right) => {
    const scoreDifference = scoreLocationCandidate(right) - scoreLocationCandidate(left)

    if (scoreDifference !== 0) {
      return scoreDifference
    }

    return left.length - right.length
  })[0]
}

function getGeolocationErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Не удалось получить геопозицию: доступ запрещён.'
    case 2:
      return 'Не удалось определить вашу геопозицию.'
    case 3:
      return 'Не удалось получить геопозицию вовремя. Попробуйте ещё раз.'
    default:
      return 'Не удалось получить вашу геопозицию.'
  }
}

function buildSuggestionFromItem(item: GeocodeSearchItem): LocationSuggestion | null {
  if (item.point?.lat == null || item.point?.lon == null) {
    return null
  }

  const label =
    item.search_attributes?.suggested_text ??
    item.address_name ??
    item.name ??
    item.full_name

  if (!label) {
    return null
  }

  return {
    label,
    latitude: item.point.lat,
    longitude: item.point.lon,
  }
}

export default function CreateRunPage() {
  const router = useRouter()
  const { session, authProfileStatus, isBootstrapResolved, profile, profileError, reloadProfile } =
    useAuthProfile()
  const [time, setTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [pace, setPace] = useState('05:30')
  const [locationName, setLocationName] = useState('')
  const [selectedCoordinates, setSelectedCoordinates] = useState<RunCoordinates | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [isLocatingUser, setIsLocatingUser] = useState(false)
  const [geolocationError, setGeolocationError] = useState<string | null>(null)
  const [isResolvingLocationName, setIsResolvingLocationName] = useState(false)
  const [locationLookupError, setLocationLookupError] = useState<string | null>(null)
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [isLoadingLocationSuggestions, setIsLoadingLocationSuggestions] = useState(false)
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const hasCompletedProfile = isProfileComplete(profile)
  const isPaceValid = pace === '' || parsePaceInput(pace) !== null
  const selectedPace = parsePaceInput(pace) == null ? pace : finalizePaceInput(pace)
  const trimmedLocationName = locationName.trim()
  const isLocationNameEmpty = trimmedLocationName === ''
  const isSubmitDisabled =
    !session ||
    !hasCompletedProfile ||
    !isPaceValid ||
    !selectedCoordinates ||
    isLocationNameEmpty ||
    isResolvingLocationName
  const locationSubmitHint = !selectedCoordinates
    ? 'Выберите место старта.'
    : isResolvingLocationName
      ? 'Определяем место старта...'
      : isLocationNameEmpty
        ? 'Укажите место старта.'
        : null
  const shouldShowSplash =
    !isBootstrapResolved ||
    !session ||
    authProfileStatus === 'profile_loading' ||
    (authProfileStatus === 'ready' && !hasCompletedProfile)
  const shouldSkipReverseGeocodeRef = useRef(false)
  const locationInputGroupRef = useRef<HTMLDivElement | null>(null)

  const handleSelectedCoordinatesChange = useCallback((value: RunCoordinates | null) => {
    setSelectedCoordinates(value)
    setGeolocationError(null)
    setShowLocationSuggestions(false)
    setIsLoadingLocationSuggestions(false)
    setLocationSuggestions([])

    if (value == null) {
      setIsResolvingLocationName(false)
      setLocationLookupError(null)
    }
  }, [])

  async function createRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!session?.access_token || !hasCompletedProfile) {
      return
    }

    const paceSecPerKm = parsePaceInput(pace)

    if (paceSecPerKm == null || selectedCoordinates == null) {
      return
    }

    try {
      const res = await fetch('/api/runs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          time: new Date(time).toISOString(),
          duration_minutes: Number(durationMinutes),
          pace_sec_per_km: paceSecPerKm,
          location_name: locationName,
          latitude: selectedCoordinates.latitude,
          longitude: selectedCoordinates.longitude,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to create run')
      }

      router.replace('/')
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (isBootstrapResolved && !session) {
      router.replace('/auth')
    }
  }, [isBootstrapResolved, router, session])

  useEffect(() => {
    if (authProfileStatus === 'ready' && !hasCompletedProfile) {
      router.replace('/onboarding')
    }
  }, [authProfileStatus, hasCompletedProfile, router])

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error(error)
    }
  }

  function selectLocationSuggestion(suggestion: LocationSuggestion) {
    shouldSkipReverseGeocodeRef.current = true
    setIsResolvingLocationName(false)
    setLocationName(suggestion.label)
    setLocationLookupError(null)
    setIsLoadingLocationSuggestions(false)
    setLocationSuggestions([])
    setShowLocationSuggestions(false)
    handleSelectedCoordinatesChange({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    })
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeolocationError('Ваш браузер не поддерживает геолокацию.')
      return
    }

    setIsLocatingUser(true)
    setGeolocationError(null)
    setLocationLookupError(null)
    setShowLocationSuggestions(false)
    setIsLoadingLocationSuggestions(false)
    setLocationSuggestions([])

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSelectedCoordinatesChange({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setIsLocatingUser(false)
      },
      (error) => {
        setGeolocationError(getGeolocationErrorMessage(error.code))
        setIsLocatingUser(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }

  useEffect(() => {
    const trimmedValue = locationName.trim()

    if (!showLocationSuggestions || !mapApiKey || trimmedValue.length < 3) {
      return
    }

    const activeMapApiKey = mapApiKey
    const abortController = new AbortController()
    const searchTimeout = window.setTimeout(() => {
      async function loadLocationSuggestions() {
        setIsLoadingLocationSuggestions(true)

        try {
          const url = new URL('https://catalog.api.2gis.com/3.0/suggests')
          url.searchParams.set('q', trimmedValue)
          url.searchParams.set('suggest_type', 'address')
          url.searchParams.set('fields', 'items.point')
          url.searchParams.set('locale', 'ru_RU')
          url.searchParams.set('limit', '5')
          url.searchParams.set('key', activeMapApiKey)

          if (selectedCoordinates) {
            url.searchParams.set(
              'location',
              `${selectedCoordinates.longitude},${selectedCoordinates.latitude}`
            )
            url.searchParams.set('sort', 'distance')
          }

          const response = await fetch(url, {
            signal: abortController.signal,
          })

          if (!response.ok) {
            throw new Error(`Location search failed with status ${response.status}`)
          }

          const data: ReverseGeocodeResponse = await response.json()
          const nextSuggestions = (data.result?.items ?? [])
            .map(buildSuggestionFromItem)
            .filter((item): item is LocationSuggestion => item !== null)

          setLocationSuggestions(nextSuggestions)
        } catch (error) {
          if (abortController.signal.aborted) {
            return
          }

          console.error(error)
          setLocationSuggestions([])
        } finally {
          if (!abortController.signal.aborted) {
            setIsLoadingLocationSuggestions(false)
          }
        }
      }

      void loadLocationSuggestions()
    }, 250)

    return () => {
      window.clearTimeout(searchTimeout)
      abortController.abort()
    }
  }, [locationName, selectedCoordinates, showLocationSuggestions])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!locationInputGroupRef.current) {
        return
      }

      const target = event.target

      if (target instanceof Node && !locationInputGroupRef.current.contains(target)) {
        setShowLocationSuggestions(false)
        setIsLoadingLocationSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (!selectedCoordinates || !mapApiKey) {
      return
    }

    const { latitude, longitude } = selectedCoordinates
    const activeMapApiKey = mapApiKey
    const abortController = new AbortController()

    if (shouldSkipReverseGeocodeRef.current) {
      shouldSkipReverseGeocodeRef.current = false
      return
    }

    async function reverseGeocode() {
      setIsResolvingLocationName(true)
      setLocationLookupError(null)

      try {
        const url = new URL('https://catalog.api.2gis.com/3.0/items/geocode')
        url.searchParams.set('lat', String(latitude))
        url.searchParams.set('lon', String(longitude))
        url.searchParams.set('locale', 'ru_RU')
        url.searchParams.set('key', activeMapApiKey)

        const response = await fetch(url, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Reverse geocoding failed with status ${response.status}`)
        }

        const data: ReverseGeocodeResponse = await response.json()

        if (data.meta?.code && data.meta.code >= 400) {
          throw new Error(`Reverse geocoding failed with API code ${data.meta.code}`)
        }

        const resolvedLocation = resolveShortLocation(data.result?.items?.[0] ?? {})

        if (!resolvedLocation) {
          setLocationLookupError('Не удалось определить адрес. Укажите место вручную.')
          return
        }

        setLocationName(resolvedLocation)
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        console.error(error)
        setLocationLookupError('Не удалось определить адрес. Укажите место вручную.')
      } finally {
        if (!abortController.signal.aborted) {
          setIsResolvingLocationName(false)
        }
      }
    }

    void reverseGeocode()

    return () => {
      abortController.abort()
    }
  }, [selectedCoordinates])

  if (shouldShowSplash) {
    return <AuthSplash />
  }

  if (authProfileStatus === 'error' && profileError) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginBottom: 8 }}>Создать пробежку</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Заполните данные о пробежке и выберите точку на карте.
        </p>
        <div style={{ ...secondaryTextStyle, marginBottom: 16 }}>
          Вы вошли как {session.user.email}{' '}
          <button type="button" onClick={signOut}>
            Выйти
          </button>
        </div>
        <div style={cardStyle}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Не удалось загрузить профиль</div>
          <div style={secondaryTextStyle}>Попробуйте загрузить данные ещё раз.</div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={reloadProfile}>
              Повторить
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!hasCompletedProfile) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginBottom: 8 }}>Создать пробежку</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Заполните данные о пробежке и выберите точку на карте.
        </p>
        <div style={{ ...secondaryTextStyle, marginBottom: 16 }}>
          Вы вошли как {session.user.email}{' '}
          <button type="button" onClick={signOut}>
            Выйти
          </button>
        </div>
        <div style={{ ...cardStyle, ...secondaryTextStyle }}>Перенаправляем на заполнение профиля...</div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ marginBottom: 8 }}>Создать пробежку</h1>

      <div style={{ ...secondaryTextStyle, marginBottom: 16 }}>
        Вы вошли как {session.user.email}{' '}
        <button type="button" onClick={signOut}>
          Выйти
        </button>
      </div>

      <form id="create-run-form" onSubmit={createRun} style={formStyle}>
        <div style={sectionStyle}>
          <label htmlFor="time" style={labelStyle}>
            Дата и время
            <input
              id="time"
              type="datetime-local"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <label htmlFor="duration_minutes" style={labelStyle}>
            Длительность
            <input
              id="duration_minutes"
              type="number"
              min="1"
              step="1"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              required
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ ...sectionStyle, ...sectionSpacingStyle }}>
          <label htmlFor="pace" style={labelStyle}>
            Темп
            <input
              id="pace"
              type="text"
              inputMode="numeric"
              placeholder="05:30"
              value={pace}
              onChange={(event) => setPace(normalizePaceInput(event.target.value))}
              onBlur={(event) => setPace(finalizePaceInput(event.target.value))}
              required
              aria-invalid={!isPaceValid}
              style={inputStyle}
            />
          </label>

          <div style={chipListStyle}>
            {paceOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPace(option)}
                style={{
                  ...chipStyle,
                  borderColor: selectedPace === option ? '#2563eb' : '#cbd5e1',
                  backgroundColor: selectedPace === option ? '#dbeafe' : chipStyle.backgroundColor,
                  color: selectedPace === option ? '#1d4ed8' : '#0f172a',
                }}
              >
                {option}
              </button>
            ))}
          </div>

          {!isPaceValid && (
            <div style={{ color: '#b91c1c', fontSize: 14 }}>Введите темп в формате мм:сс.</div>
          )}
        </div>

        <div style={{ ...sectionStyle, ...sectionSpacingStyle }}>
          <label htmlFor="location_name" style={labelStyle}>
            Место
            <div ref={locationInputGroupRef} style={inputGroupStyle}>
              <input
                id="location_name"
                type="text"
                value={locationName}
                onChange={(event) => {
                  setLocationName(event.target.value)
                  setLocationLookupError(null)
                  if (event.target.value.trim().length < 3) {
                    setIsLoadingLocationSuggestions(false)
                    setLocationSuggestions([])
                  }
                  setShowLocationSuggestions(true)
                }}
                onFocus={() => {
                  if (locationName.trim().length >= 3) {
                    setShowLocationSuggestions(true)
                  } else {
                    setIsLoadingLocationSuggestions(false)
                  }
                }}
                autoComplete="off"
                required
                style={inputStyle}
              />
              {showLocationSuggestions &&
                (isLoadingLocationSuggestions || locationSuggestions.length > 0) && (
                  <ul style={suggestionsListStyle}>
                    {isLoadingLocationSuggestions && <li style={suggestionStatusStyle}>Ищем адрес...</li>}
                    {!isLoadingLocationSuggestions &&
                      locationSuggestions.map((suggestion, index) => (
                        <li key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}>
                          <button
                            type="button"
                            onPointerDown={(event) => {
                              event.preventDefault()
                              selectLocationSuggestion(suggestion)
                            }}
                            style={{
                              ...suggestionButtonStyle,
                              borderBottom:
                                index === locationSuggestions.length - 1
                                  ? '0'
                                  : suggestionButtonStyle.borderBottom,
                            }}
                          >
                            {suggestion.label}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
            </div>
          </label>

          {isResolvingLocationName && (
            <div style={secondaryTextStyle}>Определяем место старта...</div>
          )}
          {locationLookupError && (
            <div style={{ color: '#b91c1c', fontSize: 14 }}>{locationLookupError}</div>
          )}

          <div style={actionRowStyle}>
            {!showMap && (
              <button type="button" onClick={() => setShowMap(true)} style={secondaryButtonStyle}>
                Выбрать на карте
              </button>
            )}
            <button
              type="button"
              onClick={useMyLocation}
              disabled={isLocatingUser}
              style={secondaryButtonStyle}
            >
              {isLocatingUser ? 'Определяем геопозицию...' : 'Моя геопозиция'}
            </button>
            {selectedCoordinates && (
              <button
                type="button"
                onClick={() => handleSelectedCoordinatesChange(null)}
                style={secondaryButtonStyle}
              >
                Очистить точку
              </button>
            )}
          </div>

          {showMap && (
            <RunLocationPicker
              apiKey={mapApiKey}
              value={selectedCoordinates}
              onChange={handleSelectedCoordinatesChange}
            />
          )}

          <div style={secondaryTextStyle}>
            {selectedCoordinates
              ? trimmedLocationName !== ''
                ? `Выбрано: ${trimmedLocationName}`
                : `Выбрано: ${selectedCoordinates.latitude.toFixed(5)}, ${selectedCoordinates.longitude.toFixed(5)}`
              : 'Выберите место старта'}
          </div>

          {geolocationError && <div style={{ color: '#b91c1c', fontSize: 14 }}>{geolocationError}</div>}
        </div>
      </form>

      <div style={stickyActionBarStyle}>
        <div style={stickyActionInnerStyle}>
          {locationSubmitHint && <div style={{ ...secondaryTextStyle, marginBottom: 8 }}>{locationSubmitHint}</div>}
          <button
            type="submit"
            form="create-run-form"
            disabled={isSubmitDisabled}
            style={{
              ...primaryButtonStyle,
              opacity: isSubmitDisabled ? 0.7 : 1,
            }}
          >
            Создать пробежку
          </button>
        </div>
      </div>
    </div>
  )
}
