'use client'

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabaseClient'

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
  lat: number
  lng: number
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
  marginBottom: 12,
}

const secondaryTextStyle: CSSProperties = {
  color: '#475569',
  fontSize: 14,
}

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

function formatRunDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU')
}

function formatCreatorName(run: Run): string {
  return run.creator_name ?? 'Пользователь'
}

function formatParticipantName(participant: Participant): string {
  return participant.name ?? 'Участник'
}

export default function Home() {
  const [runs, setRuns] = useState<Run[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [time, setTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [pace, setPace] = useState('')
  const [locationName, setLocationName] = useState('')
  const isPaceValid = pace === '' || parsePaceInput(pace) !== null

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
    if (!session?.access_token) {
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

        const currentUserName =
          session.user.user_metadata.name ??
          session.user.user_metadata.full_name ??
          session.user.email ??
          null

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

    if (!session?.access_token) {
      return
    }

    const paceSecPerKm = parsePaceInput(pace)

    if (paceSecPerKm == null) {
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
          lat: 0,
          lng: 0,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to create run')
      }

      setTime('')
      setDurationMinutes('')
      setPace('')
      setLocationName('')
      fetchRuns()
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session ?? null)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      console.error(error)
    }
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ marginBottom: 8 }}>Пробежки</h1>
      <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
        Найдите компанию для пробежки или создайте свою.
      </p>

      {!session && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" onClick={signInWithGoogle}>
            Войти через Google
          </button>
        </div>
      )}

      {session?.user.email && (
        <div style={{ ...secondaryTextStyle, marginBottom: 16 }}>
          Вы вошли как {session.user.email}
        </div>
      )}

      {!session && (
        <div style={{ ...cardStyle, ...secondaryTextStyle }}>
          Чтобы создать пробежку или присоединиться, войдите через Google.
        </div>
      )}

      <form onSubmit={createRun} style={{ ...cardStyle, marginBottom: 20 }}>
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
            onChange={(e) => setPace(e.target.value)}
            required
            aria-invalid={!isPaceValid}
            style={inputStyle}
          />
        </label>

        {!isPaceValid && (
          <div style={{ color: '#b91c1c', fontSize: 14, marginTop: -4, marginBottom: 12 }}>
            Введите темп в формате мм:сс, например 05:30.
          </div>
        )}

        <label htmlFor="location_name" style={labelStyle}>
          Место
          <input
            id="location_name"
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <div style={secondaryTextStyle}>Темп указывается в формате минут и секунд на километр.</div>

        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={!session || !isPaceValid}>
            Создать пробежку
          </button>
        </div>
      </form>

      {runs.length === 0 && <div style={cardStyle}>Пока нет пробежек</div>}

      {runs.map((run) => (
        <div key={run.id} style={cardStyle}>
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <div>
              <strong>Место:</strong> {run.location_name}
            </div>
            <div>
              <strong>Дата и время:</strong> {formatRunDateTime(run.time)}
            </div>
            <div>
              <strong>Длительность:</strong> {run.duration_minutes ?? 'Не указана'} мин
            </div>
            <div>
              <strong>Темп:</strong> {formatPace(run.pace_sec_per_km)}
            </div>
            <div>
              <strong>Создал:</strong> {formatCreatorName(run)}
            </div>
            <div>
              <strong>Участники:</strong> {run.participants_count}
            </div>
          </div>

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

          <div style={{ fontWeight: 600, marginBottom: 8 }}>Список участников</div>
          {run.participants.length > 0 && (
            <ul style={{ marginTop: 0, paddingLeft: 20 }}>
              {run.participants.map((participant) => (
                <li key={participant.id}>{formatParticipantName(participant)}</li>
              ))}
            </ul>
          )}
          {run.participants.length === 0 && (
            <div style={{ ...secondaryTextStyle, marginBottom: 12 }}>Пока никто не присоединился</div>
          )}

          <button type="button" onClick={() => joinRun(run.id)} disabled={!session}>
            Присоединиться
          </button>
        </div>
      ))}
    </div>
  )
}