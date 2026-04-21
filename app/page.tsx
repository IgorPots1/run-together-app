'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [runs, setRuns] = useState([])

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

  useEffect(() => {
    fetchRuns()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>Пробежки</h1>

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