'use client'

import { useEffect, useState, type FormEvent } from 'react'

export default function Home() {
  const [runs, setRuns] = useState([])
  const [time, setTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [paceSecPerKm, setPaceSecPerKm] = useState('')
  const [locationName, setLocationName] = useState('')

  async function fetchRuns() {
    try {
      const res = await fetch('/api/runs/list')
      const data = await res.json()
      setRuns(data)
    } catch (e) {
      console.error(e)
    }
  }

  async function joinRun(runId: string) {
    await fetch('/api/runs/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_id: runId,
        user_id: '3ecf99f4-7404-42b8-963c-19a91129574a',
      }),
    })

    fetchRuns()
  }

  async function createRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const res = await fetch('/api/runs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: '3ecf99f4-7404-42b8-963c-19a91129574a',
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
    fetchRuns()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>Пробежки</h1>

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
          <button type="submit">Create run</button>
        </div>
      </form>

      {runs.length === 0 && <div>Нет пробежек</div>}

      {runs.map((run: any) => (
        <div key={run.id} style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10 }}>
          <div>{run.location_name}</div>
          <div>{new Date(run.time).toLocaleString()}</div>
          <div>{run.duration_minutes} мин</div>
          <div>Участников: {run.participants_count}</div>

          <button onClick={() => joinRun(run.id)}>
            Join
          </button>
        </div>
      ))}
    </div>
  )
}