'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'

import { getProfileDisplayName, isProfileComplete } from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'
import { useAuthProfile } from '@/lib/useAuthProfile'

type Participant = {
  id: string
  name: string | null
}

type Run = {
  id: string
  creator_id: string
  creator_name: string | null
  time: string
  duration_minutes: number | null
  distance_km: number | null
  pace_sec_per_km: number | null
  location_name: string
  latitude: number | null
  longitude: number | null
  created_at: string
  participants: Participant[]
  participants_count: number
  last_joined_user_name: string | null
  last_joined_at: string | null
}

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
  padding: 20,
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
  ...cardStyle,
  display: 'grid',
  gap: 14,
  marginBottom: 20,
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
}

const primaryButtonRowStyle: CSSProperties = {
  marginTop: 4,
}

const runMetaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 12,
  marginBottom: 12,
  fontSize: 14,
}

const mapActionLinkStyle: CSSProperties = {
  color: '#2563eb',
  textDecoration: 'none',
  fontWeight: 600,
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

function formatPace(seconds: number | null): string {
  if (seconds == null) {
    return 'Не указан'
  }

  const minutesPart = Math.floor(seconds / 60)
  const secondsPart = seconds % 60

  return `${String(minutesPart).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')} / км`
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

function formatRunDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU')
}

function formatCreatorName(run: Run): string {
  return run.creator_name ?? 'Пользователь'
}

function formatParticipantName(participant: Participant): string {
  return participant.name ?? 'Участник'
}

function build2GisUrl(latitude: number, longitude: number): string {
  return `https://2gis.ru/geo/${longitude},${latitude}`
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

function formatRunLocationName(locationName: string): string {
  const normalizedLocationName = locationName.trim()

  return normalizedLocationName === '' ? 'Точка на карте выбрана' : normalizedLocationName
}

function getAuthErrorMessage(message: string, fallbackMessage: string): string {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'Неверный email или пароль.'
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return 'Подтвердите email по ссылке из письма и войдите снова.'
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'Этот email уже зарегистрирован. Попробуйте войти.'
  }

  if (normalizedMessage.includes('password should be at least')) {
    return 'Пароль должен быть не короче 6 символов.'
  }

  return fallbackMessage
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function Home() {
  const router = useRouter()
  const { session, isAuthLoading, profile, isProfileLoading, profileError, reloadProfile } = useAuthProfile()
  const [runs, setRuns] = useState<Run[]>([])
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authInfo, setAuthInfo] = useState<string | null>(null)
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)
  const [time, setTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [pace, setPace] = useState('')
  const [locationName, setLocationName] = useState('')
  const [selectedCoordinates, setSelectedCoordinates] = useState<RunCoordinates | null>(null)
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
  const locationSubmitHint = isResolvingLocationName
    ? 'Создать пробежку можно после того, как место определится по карте.'
    : selectedCoordinates && isLocationNameEmpty
      ? 'Добавьте место вручную или через карту, чтобы создать пробежку.'
      : null
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

  async function fetchRuns() {
    try {
      const res = await fetch('/api/runs/list')
      const data: Run[] = await res.json()
      setRuns(data)
    } catch (e) {
      console.error(e)
    }
  }

  async function joinRun(runId: string) {
    if (!session?.access_token || !hasCompletedProfile) {
      return
    }

    const res = await fetch('/api/runs/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        run_id: runId,
      }),
    })

    if (!res.ok) {
      throw new Error('Failed to join run')
    }

    const data: {
      already_joined: boolean
      last_joined_user_name: string | null
      last_joined_at: string | null
    } = await res.json()

    setRuns((currentRuns) =>
      currentRuns.map((run) => {
        if (run.id !== runId) {
          return run
        }

        if (data.already_joined) {
          return run
        }

        const currentUserName = getProfileDisplayName(profile) ?? session.user.email ?? null

        const alreadyInParticipants = run.participants.some(
          (participant) => participant.id === session.user.id
        )

        return {
          ...run,
          participants_count: run.participants_count + 1,
          participants: alreadyInParticipants
            ? run.participants
            : [
                ...run.participants,
                {
                  id: session.user.id,
                  name: currentUserName,
                },
              ],
          last_joined_user_name: data.last_joined_user_name ?? currentUserName,
          last_joined_at: data.last_joined_at,
        }
      })
    )
  }

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

      setTime('')
      setDurationMinutes('')
      setPace('')
      setLocationName('')
      setSelectedCoordinates(null)
      fetchRuns()
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!isAuthLoading && session && !isProfileLoading && !profileError && !hasCompletedProfile) {
      router.replace('/onboarding')
    }
  }, [hasCompletedProfile, isAuthLoading, isProfileLoading, profileError, router, session])

  useEffect(() => {
    let isMounted = true

    void (async () => {
      try {
        const res = await fetch('/api/runs/list')
        const data: Run[] = await res.json()

        if (isMounted) {
          setRuns(data)
        }
      } catch (e) {
        console.error(e)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  async function signInWithGoogle() {
    setAuthError(null)
    setAuthInfo(null)
    setIsSubmittingAuth(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })

    setIsSubmittingAuth(false)

    if (error) {
      console.error(error)
      setAuthError('Не удалось начать вход через Google. Попробуйте ещё раз.')
    }
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = authEmail.trim()

    if (trimmedEmail === '' || authPassword === '') {
      setAuthInfo(null)
      setAuthError('Введите email и пароль.')
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setAuthInfo(null)
      setAuthError('Укажите корректный email.')
      return
    }

    setIsSubmittingAuth(true)
    setAuthError(null)
    setAuthInfo(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: authPassword,
    })

    setIsSubmittingAuth(false)

    if (error) {
      setAuthError(getAuthErrorMessage(error.message, 'Не удалось войти. Попробуйте ещё раз.'))
      return
    }

    setAuthPassword('')
  }

  async function signUpWithEmail() {
    const trimmedEmail = authEmail.trim()

    if (trimmedEmail === '') {
      setAuthInfo(null)
      setAuthError('Укажите email.')
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setAuthInfo(null)
      setAuthError('Укажите корректный email.')
      return
    }

    if (authPassword.length < 6) {
      setAuthInfo(null)
      setAuthError('Пароль должен быть не короче 6 символов.')
      return
    }

    setIsSubmittingAuth(true)
    setAuthError(null)
    setAuthInfo(null)

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: authPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })

    setIsSubmittingAuth(false)

    if (error) {
      setAuthError(getAuthErrorMessage(error.message, 'Не удалось зарегистрироваться. Попробуйте ещё раз.'))
      return
    }

    setAuthPassword('')

    if (!data.session) {
      setAuthInfo('Проверьте почту, подтвердите email и затем войдите в приложение.')
    }
  }

  async function signOut() {
    setAuthError(null)
    setAuthInfo(null)

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
    const trimmedLocationName = locationName.trim()

    if (!showLocationSuggestions || !mapApiKey || trimmedLocationName.length < 3) {
      return
    }

    const activeMapApiKey = mapApiKey
    const abortController = new AbortController()
    const searchTimeout = window.setTimeout(() => {

      async function loadLocationSuggestions() {
        setIsLoadingLocationSuggestions(true)

        try {
          const url = new URL('https://catalog.api.2gis.com/3.0/suggests')
          url.searchParams.set('q', trimmedLocationName)
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

  return (
    <div style={pageStyle}>
      <h1 style={{ marginBottom: 8 }}>Пробежки</h1>
      <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
        Найдите компанию для пробежки или создайте свою.
      </p>

      {isAuthLoading && (
        <div style={{ ...cardStyle, ...secondaryTextStyle }}>Проверяем вход...</div>
      )}

      {!isAuthLoading && !session && (
        <>
          <form onSubmit={signInWithEmail} style={formStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Вход или регистрация</h2>
            <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 4 }}>
              Войдите по email или через Google. После входа приложение само направит вас дальше.
            </p>

            <label htmlFor="auth_email" style={labelStyle}>
              Email
              <input
                id="auth_email"
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                required
                style={inputStyle}
              />
            </label>

            <label htmlFor="auth_password" style={labelStyle}>
              Пароль
              <input
                id="auth_password"
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                required
                style={inputStyle}
              />
            </label>

            {authError && <div style={{ color: '#b91c1c', fontSize: 14 }}>{authError}</div>}
            {authInfo && <div style={{ color: '#0f766e', fontSize: 14 }}>{authInfo}</div>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" disabled={isSubmittingAuth}>
                {isSubmittingAuth ? 'Выполняем вход...' : 'Войти по email'}
              </button>
              <button type="button" onClick={signUpWithEmail} disabled={isSubmittingAuth}>
                Зарегистрироваться
              </button>
            </div>
          </form>

          <div style={cardStyle}>
            <button type="button" onClick={signInWithGoogle} disabled={isSubmittingAuth}>
              Войти через Google
            </button>
          </div>
        </>
      )}

      {!isAuthLoading && session?.user.email && (
        <div style={{ ...secondaryTextStyle, marginBottom: 16 }}>
          Вы вошли как {session.user.email}{' '}
          <button type="button" onClick={signOut}>
            Выйти
          </button>
        </div>
      )}

      {!isAuthLoading && session && isProfileLoading && (
        <div style={{ ...cardStyle, ...secondaryTextStyle }}>Загружаем профиль...</div>
      )}

      {!isAuthLoading && session && !isProfileLoading && profileError && (
        <div style={cardStyle}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Не удалось загрузить профиль</div>
          <div style={secondaryTextStyle}>Попробуйте загрузить данные ещё раз.</div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={reloadProfile}>
              Повторить
            </button>
          </div>
        </div>
      )}

      {!isAuthLoading && session && !isProfileLoading && !profileError && !hasCompletedProfile && (
        <div style={{ ...cardStyle, ...secondaryTextStyle }}>
          Перенаправляем на заполнение профиля...
        </div>
      )}

      {!isAuthLoading && (!session || hasCompletedProfile) && (
        <>
          <form onSubmit={createRun} style={formStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Создать пробежку</h2>

        <label htmlFor="time" style={labelStyle}>
          Дата и время
          <input
            id="time"
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <label htmlFor="duration_minutes" style={labelStyle}>
          Длительность (мин)
          <input
            id="duration_minutes"
            type="number"
            min="1"
            step="1"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <label htmlFor="pace" style={labelStyle}>
          Темп
          <input
            id="pace"
            type="text"
            inputMode="numeric"
            placeholder="05:30"
            value={pace}
            onChange={(e) => setPace(normalizePaceInput(e.target.value))}
            onBlur={(e) => setPace(finalizePaceInput(e.target.value))}
            required
            aria-invalid={!isPaceValid}
            style={inputStyle}
          />
          <div style={chipListStyle}>
            {paceOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPace(option)}
                style={{
                  ...chipStyle,
                  borderColor: selectedPace === option ? '#2563eb' : '#cbd5e1',
                  backgroundColor: selectedPace === option ? '#eff6ff' : chipStyle.backgroundColor,
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </label>

        {!isPaceValid && (
          <div style={{ color: '#b91c1c', fontSize: 14, marginTop: -4, marginBottom: 12 }}>
            Введите темп в формате мм:сс, например 05:30.
          </div>
        )}

        <label htmlFor="location_name" style={labelStyle}>
          Место
          <div ref={locationInputGroupRef} style={inputGroupStyle}>
            <input
              id="location_name"
              type="text"
              value={locationName}
              onChange={(e) => {
                setLocationName(e.target.value)
                setLocationLookupError(null)
                if (e.target.value.trim().length < 3) {
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
            {showLocationSuggestions && (isLoadingLocationSuggestions || locationSuggestions.length > 0) && (
              <ul style={suggestionsListStyle}>
                {isLoadingLocationSuggestions && (
                  <li style={suggestionStatusStyle}>Ищем адрес...</li>
                )}
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
          {selectedCoordinates && isLocationNameEmpty && !isResolvingLocationName && (
            <div style={{ ...secondaryTextStyle, marginTop: 6 }}>
              Если адрес не подставился, укажите короткое название места вручную.
            </div>
          )}
          {isResolvingLocationName && (
            <div style={{ ...secondaryTextStyle, marginTop: 6 }}>
              Определяем короткое название места по выбранной точке...
            </div>
          )}
          {locationLookupError && (
            <div style={{ color: '#b91c1c', fontSize: 14, marginTop: 6 }}>{locationLookupError}</div>
          )}
        </label>

        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Точка на карте</div>
          <RunLocationPicker
            apiKey={mapApiKey}
            value={selectedCoordinates}
            onChange={handleSelectedCoordinatesChange}
          />
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={useMyLocation} disabled={isLocatingUser}>
              {isLocatingUser ? 'Определяем геопозицию...' : 'Моя геопозиция'}
            </button>
          </div>
          <div style={{ ...secondaryTextStyle, marginTop: 8 }}>
            {selectedCoordinates
              ? trimmedLocationName !== ''
                ? `Выбрано: ${trimmedLocationName}`
                : `Выбрано: ${selectedCoordinates.latitude.toFixed(5)}, ${selectedCoordinates.longitude.toFixed(5)}`
              : 'Выберите одну точку на карте.'}
          </div>
          {geolocationError && (
            <div style={{ color: '#b91c1c', fontSize: 14, marginTop: 8 }}>{geolocationError}</div>
          )}
          {selectedCoordinates && (
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => handleSelectedCoordinatesChange(null)}>
                Очистить точку
              </button>
            </div>
          )}
        </div>

        <div style={secondaryTextStyle}>
          Выберите точку на карте перед созданием пробежки.
        </div>

        <div style={primaryButtonRowStyle}>
          {locationSubmitHint && (
            <div style={{ ...secondaryTextStyle, marginBottom: 8 }}>{locationSubmitHint}</div>
          )}
          <button type="submit" disabled={isSubmitDisabled}>
            Создать пробежку
          </button>
        </div>
          </form>

          {runs.length === 0 && <div style={cardStyle}>Пока нет пробежек</div>}

          {runs.map((run) => (
            <div key={run.id} style={cardStyle}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>{formatRunLocationName(run.location_name)}</h3>
            <div style={secondaryTextStyle}>{formatRunDateTime(run.time)}</div>
          </div>

          <div style={runMetaRowStyle}>
            <div>
              <strong>Длительность:</strong> {run.duration_minutes ?? 'Не указана'} мин
            </div>
            <div>
              <strong>Темп:</strong> {formatPace(run.pace_sec_per_km)}
            </div>
          </div>

          <div style={{ ...secondaryTextStyle, marginBottom: 6 }}>
            <strong style={{ color: '#0f172a' }}>Создал:</strong> {formatCreatorName(run)}
          </div>

          <div style={{ ...secondaryTextStyle, marginBottom: 12 }}>
            <strong style={{ color: '#0f172a' }}>Участники:</strong> {run.participants_count}
            {run.participants.length > 0
              ? ` · ${run.participants.map((participant) => formatParticipantName(participant)).join(', ')}`
              : ' · Пока никто не присоединился'}
          </div>

          {run.latitude != null && run.longitude != null && (
            <div style={{ ...secondaryTextStyle, marginBottom: 12 }}>
              <strong style={{ color: '#0f172a' }}>Адрес:</strong> {formatRunLocationName(run.location_name)} ·{' '}
              <a
                href={build2GisUrl(run.latitude, run.longitude)}
                target="_blank"
                rel="noreferrer"
                style={mapActionLinkStyle}
              >
                Открыть на карте
              </a>
            </div>
          )}

          {run.last_joined_user_name && (
            <div style={{ ...secondaryTextStyle, marginBottom: 12 }}>
              Недавно присоединился: {run.last_joined_user_name}
            </div>
          )}

          {!run.last_joined_user_name && run.last_joined_at && (
            <div style={{ ...secondaryTextStyle, marginBottom: 12 }}>
              Недавно присоединился ещё один участник
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={() => joinRun(run.id)} disabled={!session || !hasCompletedProfile}>
              Присоединиться
            </button>
          </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}