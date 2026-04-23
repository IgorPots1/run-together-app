'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'

import { AuthSplash } from '@/components/AuthSplash'
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

const secondaryTextStyle: CSSProperties = {
  color: '#475569',
  fontSize: 14,
}

const ctaRowStyle: CSSProperties = {
  marginBottom: 20,
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

function formatPace(seconds: number | null): string {
  if (seconds == null) {
    return 'Не указан'
  }

  const minutesPart = Math.floor(seconds / 60)
  const secondsPart = seconds % 60

  return `${String(minutesPart).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')} / км`
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

function formatRunLocationName(locationName: string): string {
  const normalizedLocationName = locationName.trim()

  return normalizedLocationName === '' ? 'Точка на карте выбрана' : normalizedLocationName
}

export default function Home() {
  const router = useRouter()
  const { session, authProfileStatus, isBootstrapResolved, profile, profileError, reloadProfile } =
    useAuthProfile()
  const [runs, setRuns] = useState<Run[]>([])
  const hasCompletedProfile = isProfileComplete(profile)
  const shouldShowSplash =
    !isBootstrapResolved ||
    !session ||
    authProfileStatus === 'profile_loading' ||
    (authProfileStatus === 'ready' && !hasCompletedProfile)

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

  useEffect(() => {
    if (authProfileStatus !== 'ready' || !session || !hasCompletedProfile) {
      return
    }

    let isMounted = true

    void (async () => {
      try {
        const res = await fetch('/api/runs/list')
        const data: Run[] = await res.json()

        if (isMounted) {
          setRuns(data)
        }
      } catch (error) {
        console.error(error)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [authProfileStatus, hasCompletedProfile, session])

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error(error)
    }
  }

  if (shouldShowSplash) {
    return <AuthSplash />
  }

  if (authProfileStatus === 'error' && profileError) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginBottom: 8 }}>Пробежки</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Найдите компанию для пробежки или создайте свою.
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
        <h1 style={{ marginBottom: 8 }}>Пробежки</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Найдите компанию для пробежки или создайте свою.
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
      <h1 style={{ marginBottom: 8 }}>Пробежки</h1>
      <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
        Найдите компанию для пробежки или создайте свою.
      </p>

      <div style={{ ...secondaryTextStyle, marginBottom: 16 }}>
        Вы вошли как {session.user.email}{' '}
        <button type="button" onClick={signOut}>
          Выйти
        </button>
      </div>

      <div style={ctaRowStyle}>
        <button type="button" onClick={() => router.push('/create-run')}>
          Создать пробежку
        </button>
      </div>

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
            <button type="button" onClick={() => joinRun(run.id)}>
              Присоединиться
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}