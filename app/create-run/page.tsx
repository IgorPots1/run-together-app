'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  LogOut,
  MapPinned,
  TimerReset,
  X,
} from 'lucide-react'

import { AuthSplash } from '@/components/AuthSplash'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/components/ui/page-container'
import { SectionBlock } from '@/components/ui/section-block'
import { cn } from '@/lib/utils'
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

const paceOptions = ['05:00', '05:30', '06:00', '06:30', '07:00']
const mapApiKey = process.env.NEXT_PUBLIC_2GIS_MAP_KEY
const calendarWeekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const calendarMonthFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
})
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

function normalizeDurationInput(value: string): string {
  return value.replace(/\D/g, '')
}

function normalizeTimeInput(value: string): string {
  const cleanedValue = value.replace(/[^\d:]/g, '')

  if (cleanedValue === '') {
    return ''
  }

  if (cleanedValue.includes(':')) {
    const [hoursPart = '', minutesPart = ''] = cleanedValue.split(':', 2)
    const hours = hoursPart.replace(/\D/g, '').slice(0, 2)
    const minutes = minutesPart.replace(/\D/g, '').slice(0, 2)

    if (cleanedValue.endsWith(':') && minutes === '') {
      return hours === '' ? '' : `${hours}:`
    }

    return minutes === '' ? hours : `${hours}:${minutes}`
  }

  const digits = cleanedValue.replace(/\D/g, '').slice(0, 4)

  if (digits.length <= 2) {
    return digits
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

function parseDateInput(value: string): { day: number; month: number; year: number } | null {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)

  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  if (month < 1 || month > 12 || day < 1) {
    return null
  }

  const candidateDate = new Date(year, month - 1, day)

  if (
    candidateDate.getFullYear() !== year ||
    candidateDate.getMonth() !== month - 1 ||
    candidateDate.getDate() !== day
  ) {
    return null
  }

  return { day, month, year }
}

function formatDateValue(value: Date): string {
  return [
    String(value.getDate()).padStart(2, '0'),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getFullYear()),
  ].join('.')
}

function getTodayDate(): Date {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function getCalendarMonthStart(value: string): Date {
  const parsedDate = parseDateInput(value)

  if (parsedDate) {
    return new Date(parsedDate.year, parsedDate.month - 1, 1)
  }

  const today = getTodayDate()
  return new Date(today.getFullYear(), today.getMonth(), 1)
}

function addMonths(value: Date, monthOffset: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + monthOffset, 1)
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function buildCalendarDays(monthStart: Date): Date[] {
  const firstVisibleDayOffset = (monthStart.getDay() + 6) % 7
  const firstVisibleDate = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - firstVisibleDayOffset
  )

  return Array.from({ length: 42 }, (_, index) => {
    const visibleDate = new Date(firstVisibleDate)
    visibleDate.setDate(firstVisibleDate.getDate() + index)
    return visibleDate
  })
}

function parseTimeInput(value: string): { hours: number; minutes: number } | null {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/)

  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return { hours, minutes }
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

function Field({
  htmlFor,
  label,
  children,
  hint,
}: {
  htmlFor: string
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label htmlFor={htmlFor} className="block max-w-full space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-sm text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

function CalendarDateField({
  id,
  value,
  onChange,
  placeholder,
  required,
  isInvalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  isInvalid?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => getCalendarMonthStart(value))
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedDate = parseDateInput(value)
  const selectedDateValue = selectedDate
    ? new Date(selectedDate.year, selectedDate.month - 1, selectedDate.day)
    : null
  const today = getTodayDate()
  const visibleDays = buildCalendarDays(visibleMonth)

  const openPicker = useCallback(() => {
    setVisibleMonth(getCalendarMonthStart(value))
    setIsOpen(true)
  }, [value])

  function handleDateSelect(nextDate: Date) {
    onChange(formatDateValue(nextDate))
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current) {
        return
      }

      const target = event.target

      if (target instanceof Node && !containerRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        type="text"
        inputMode="none"
        placeholder={placeholder}
        value={value}
        onClick={openPicker}
        onFocus={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault()
            openPicker()
          }
        }}
        readOnly
        required={required}
        aria-invalid={isInvalid}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={`${id}-calendar`}
        className="w-full max-w-full cursor-pointer bg-background pr-11"
      />
      <CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

      {isOpen ? (
        <div
          id={`${id}-calendar`}
          role="dialog"
          aria-label="Выбор даты"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-background p-3 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-xl"
              onClick={() => setVisibleMonth((currentMonth) => addMonths(currentMonth, -1))}
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-medium capitalize text-foreground">
              {calendarMonthFormatter.format(visibleMonth)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-xl"
              onClick={() => setVisibleMonth((currentMonth) => addMonths(currentMonth, 1))}
              aria-label="Следующий месяц"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {calendarWeekdayLabels.map((dayLabel) => (
              <span key={dayLabel} className="py-1">
                {dayLabel}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {visibleDays.map((day) => {
              const isSelected = selectedDateValue ? isSameDay(day, selectedDateValue) : false
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth()
              const isToday = isSameDay(day, today)

              return (
                <button
                  key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={cn(
                    'flex h-10 items-center justify-center rounded-xl text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                      : 'text-foreground hover:bg-muted',
                    !isCurrentMonth && !isSelected && 'text-muted-foreground/50',
                    isToday && !isSelected && 'border border-primary/30'
                  )}
                  aria-label={day.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  aria-pressed={isSelected}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex justify-between gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-xl px-3 text-sm"
              onClick={() => setIsOpen(false)}
            >
              Закрыть
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl px-3 text-sm"
              onClick={() => handleDateSelect(today)}
            >
              Сегодня
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function combineDateAndTime(date: string, time: string): string | null {
  const parsedDate = parseDateInput(date)
  const parsedTime = parseTimeInput(time)

  if (parsedDate == null || parsedTime == null) {
    return null
  }

  const combinedDateTime = new Date(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    parsedTime.hours,
    parsedTime.minutes
  )

  return combinedDateTime.toISOString()
}

function CreateRunPageShell({
  title,
  description,
  onBack,
  onSignOut,
  children,
}: {
  title: string
  description: string
  onBack: () => void
  onSignOut: () => void
  children: ReactNode
}) {
  return (
    <PageContainer className="gap-5">
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 rounded-xl px-3 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            Назад
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-xl px-3 text-muted-foreground"
            onClick={onSignOut}
          >
            <LogOut className="size-4" />
            Выйти
          </Button>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="max-w-[36ch] text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </PageContainer>
  )
}

export default function CreateRunPage() {
  const router = useRouter()
  const { session, authProfileStatus, isBootstrapResolved, profile, profileError, reloadProfile } =
    useAuthProfile()
  const [date, setDate] = useState('')
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
  const isDateValid = parseDateInput(date) !== null
  const isTimeValid = parseTimeInput(time) !== null
  const runDateTimeIso = combineDateAndTime(date, time)
  const trimmedLocationName = locationName.trim()
  const isLocationNameEmpty = trimmedLocationName === ''
  const isSubmitDisabled =
    !session ||
    !hasCompletedProfile ||
    !isPaceValid ||
    !isDateValid ||
    !isTimeValid ||
    runDateTimeIso == null ||
    !selectedCoordinates ||
    isLocationNameEmpty ||
    isResolvingLocationName
  const dateValidationMessage =
    date === ''
      ? null
      : !/^\d{2}\.\d{2}\.\d{4}$/.test(date)
        ? 'Введите дату в формате дд.мм.гггг.'
        : !isDateValid
          ? 'Проверьте дату.'
          : null
  const timeValidationMessage =
    time === ''
      ? null
      : !/^\d{2}:\d{2}$/.test(time)
        ? 'Введите время в формате чч:мм.'
        : !isTimeValid
          ? 'Проверьте время.'
          : null
  const locationStatusText = isResolvingLocationName
    ? 'Определяем место старта...'
    : selectedCoordinates
      ? trimmedLocationName !== ''
        ? `Выбрано: ${trimmedLocationName}`
        : `Выбрано: ${selectedCoordinates.latitude.toFixed(5)}, ${selectedCoordinates.longitude.toFixed(5)}`
      : 'Выберите место старта'
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

    if (paceSecPerKm == null || selectedCoordinates == null || runDateTimeIso == null) {
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
          time: runDateTimeIso,
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
      <CreateRunPageShell
        title="Создать пробежку"
        description="Заполните данные о пробежке и выберите точку на карте."
        onBack={() => router.push('/')}
        onSignOut={signOut}
      >
        <SectionBlock title="Не удалось загрузить профиль">
          <p className="text-sm text-muted-foreground">Попробуйте загрузить данные ещё раз.</p>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={reloadProfile}>
            Повторить
          </Button>
        </SectionBlock>
      </CreateRunPageShell>
    )
  }

  if (!hasCompletedProfile) {
    return (
      <CreateRunPageShell
        title="Создать пробежку"
        description="Заполните данные о пробежке и выберите точку на карте."
        onBack={() => router.push('/')}
        onSignOut={signOut}
      >
        <SectionBlock>
          <p className="text-sm text-muted-foreground">Перенаправляем на заполнение профиля...</p>
        </SectionBlock>
      </CreateRunPageShell>
    )
  }

  return (
    <>
      <CreateRunPageShell
        title="Создать пробежку"
        description="Заполните ключевые детали, выберите место старта и опубликуйте пробежку для других участников."
        onBack={() => router.push('/')}
        onSignOut={signOut}
      >
        <form id="create-run-form" onSubmit={createRun} className="w-full max-w-full space-y-4">
          <SectionBlock
            title="Основное"
            description="Дата, время и длительность пробежки."
            className="max-w-full border-border/60 shadow-none"
          >
            <div className="grid grid-cols-2 gap-2">
              <Field htmlFor="date" label="Дата">
                <CalendarDateField
                  id="date"
                  placeholder="24.04.2026"
                  value={date}
                  onChange={setDate}
                  required
                  isInvalid={!isDateValid && date !== ''}
                />
              </Field>

              <Field htmlFor="time" label="Время">
                <Input
                  id="time"
                  type="text"
                  inputMode="numeric"
                  placeholder="18:30"
                  value={time}
                  onChange={(event) => setTime(normalizeTimeInput(event.target.value))}
                  required
                  maxLength={5}
                  aria-invalid={!isTimeValid && time !== ''}
                  className="w-full max-w-full bg-background"
                />
              </Field>
            </div>

            {dateValidationMessage ? (
              <p className="text-sm text-destructive">{dateValidationMessage}</p>
            ) : null}

            {timeValidationMessage ? (
              <p className="text-sm text-destructive">{timeValidationMessage}</p>
            ) : null}

            <Field htmlFor="duration_minutes" label="Длительность, минут">
              <Input
                id="duration_minutes"
                type="text"
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(normalizeDurationInput(event.target.value))}
                required
                className="w-full max-w-full bg-background"
              />
            </Field>
          </SectionBlock>

          <SectionBlock
            title="Темп"
            description="Укажите целевой темп в формате мм:сс."
            className="max-w-full border-border/60 shadow-none"
          >
            <Field htmlFor="pace" label="Темп">
              <Input
                id="pace"
                type="text"
                inputMode="numeric"
                placeholder="05:30"
                value={pace}
                onChange={(event) => setPace(normalizePaceInput(event.target.value))}
                onBlur={(event) => setPace(finalizePaceInput(event.target.value))}
                required
                aria-invalid={!isPaceValid}
                className="w-full max-w-full bg-background"
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              {paceOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPace(option)}
                  className={cn(
                    'h-10 rounded-full px-4',
                    selectedPace === option && 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
                  )}
                >
                  {option}
                </Button>
              ))}
            </div>

            {!isPaceValid ? (
              <p className="text-sm text-destructive">Введите темп в формате мм:сс.</p>
            ) : null}
          </SectionBlock>

          <SectionBlock
            title="Место старта"
            description="Можно ввести адрес, выбрать точку на карте или использовать геолокацию."
            className="max-w-full border-border/60 shadow-none"
          >
            <Field htmlFor="location_name" label="Место">
              <div ref={locationInputGroupRef} className="relative max-w-full min-w-0">
                <Input
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
                  className="w-full max-w-full bg-background"
                />
                {showLocationSuggestions &&
                  (isLoadingLocationSuggestions || locationSuggestions.length > 0) && (
                    <ul className="absolute inset-x-0 top-full z-10 mt-2 max-h-60 max-w-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-background shadow-lg">
                      {isLoadingLocationSuggestions ? (
                        <li className="px-4 py-3 text-sm text-muted-foreground">Ищем адрес...</li>
                      ) : (
                        locationSuggestions.map((suggestion, index) => (
                          <li key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}>
                            <button
                              type="button"
                              onPointerDown={(event) => {
                                event.preventDefault()
                                selectLocationSuggestion(suggestion)
                              }}
                              className={cn(
                                'w-full px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted',
                                index !== locationSuggestions.length - 1 && 'border-b border-border'
                              )}
                            >
                              {suggestion.label}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
              </div>
            </Field>

            <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              {locationStatusText}
            </div>

            {locationLookupError ? (
              <p className="text-sm text-destructive">{locationLookupError}</p>
            ) : null}

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start rounded-xl"
                onClick={() => setShowMap((currentValue) => !currentValue)}
              >
                <MapPinned className="size-4" />
                {showMap ? 'Скрыть карту' : 'Выбрать на карте'}
              </Button>

              {showMap ? (
                <RunLocationPicker
                  apiKey={mapApiKey}
                  value={selectedCoordinates}
                  onChange={handleSelectedCoordinatesChange}
                />
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                onClick={useMyLocation}
                disabled={isLocatingUser}
              >
                <LocateFixed className="size-4" />
                {isLocatingUser ? 'Определяем геопозицию...' : 'Моя геопозиция'}
              </Button>
              {selectedCoordinates ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl"
                  onClick={() => handleSelectedCoordinatesChange(null)}
                >
                  <X className="size-4" />
                  Очистить точку
                </Button>
              ) : null}
            </div>

            {geolocationError ? (
              <p className="text-sm text-destructive">{geolocationError}</p>
            ) : null}
          </SectionBlock>
        </form>
      </CreateRunPageShell>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <Button
            type="submit"
            form="create-run-form"
            disabled={isSubmitDisabled}
            className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/20"
          >
            <TimerReset className="size-5" />
            Создать пробежку
          </Button>
        </div>
      </div>
    </>
  )
}
