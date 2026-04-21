'use client'

import { useEffect, useState, type FormEvent } from 'react'
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
}

export default function Home() {
  const [runs, setRuns] = useState<Run[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [time, setTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [paceSecPerKm, setPaceSecPerKm] = useState('')
  const [locationName, setLocationName] = useState('')

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

    await fetch('/api/runs/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        run_id: runId,
      }),
    })

    fetchRuns()
  }

  async function createRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!session?.access_token) {
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
          pace_sec_per_km: Number(paceSecPerKm),
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
      setPaceSecPerKm('')
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
    <div style={{ padding: 20 }}>
      <h1>Пробежки</h1>

      {!session && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" onClick={signInWithGoogle}>
            Login with Google
          </button>
        </div>
      )}

      {session?.user.email && (
        <div style={{ marginBottom: 16 }}>
          Logged in as {session.user.email}
        </div>
      )}

      <form onSubmit={createRun}>
        <div>
          <label htmlFor="time">time</label>
        </div>
        <input
          id="time"
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />

        <div>
          <label htmlFor="duration_minutes">duration_minutes</label>
        </div>
        <input
          id="duration_minutes"
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          required
        />

        <div>
          <label htmlFor="pace_sec_per_km">pace_sec_per_km</label>
        </div>
        <input
          id="pace_sec_per_km"
          type="number"
          value={paceSecPerKm}
          onChange={(e) => setPaceSecPerKm(e.target.value)}
          required
        />

        <div>
          <label htmlFor="location_name">location_name</label>
        </div>
        <input
          id="location_name"
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          required
        />

        <div>
          <button type="submit" disabled={!session}>
            Create run
          </button>
        </div>
      </form>

      {runs.length === 0 && <div>Нет пробежек</div>}

      {runs.map((run) => (
        <div key={run.id} style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10 }}>
          <div>{run.location_name}</div>
          <div>{new Date(run.time).toLocaleString()}</div>
          <div>{run.duration_minutes} мин</div>
          <div>Создатель: {run.creator_name ?? run.creator_id}</div>
          <div>Участников: {run.participants_count}</div>
          <div>
            Участники:
            {run.participants.length === 0 && ' Нет участников'}
          </div>
          {run.participants.length > 0 && (
            <ul>
              {run.participants.map((participant) => (
                <li key={participant.id}>
                  {participant.name ?? participant.id}
                </li>
              ))}
            </ul>
          )}

          <button onClick={() => joinRun(run.id)} disabled={!session}>
            Join
          </button>
        </div>
      ))}
    </div>
  )
}