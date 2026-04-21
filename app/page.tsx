'use client'

import { useEffect, useState } from 'react'

type Run = {
  id: string
  location_name: string
  time: string
  duration_minutes: number
  participants_count: number
}

const USER_ID = '3ecf99f4-7404-42b8-963c-19a91129574a'

export default function Home() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joiningRunId, setJoiningRunId] = useState('')

  async function loadRuns() {
    try {
      setError('')

      const response = await fetch('/api/runs/list')

      if (!response.ok) {
        throw new Error('Failed to load runs')
      }

      const data = await response.json()
      setRuns(data)
    } catch {
      setError('Failed to load runs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRuns()
  }, [])

  async function handleJoin(runId: string) {
    try {
      setJoiningRunId(runId)
      setError('')

      const response = await fetch('/api/runs/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          run_id: runId,
          user_id: USER_ID,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to join run')
      }

      await loadRuns()
    } catch {
      setError('Failed to join run')
    } finally {
      setJoiningRunId('')
    }
  }

  return (
    <div>
      <h1>Runs</h1>

      {loading ? <div>Loading...</div> : null}
      {error ? <div>{error}</div> : null}

      {!loading && runs.length === 0 ? <div>No runs found.</div> : null}

      <div>
        {runs.map((run) => (
          <div key={run.id}>
            <div>location_name: {run.location_name}</div>
            <div>time: {run.time}</div>
            <div>duration_minutes: {run.duration_minutes}</div>
            <div>participants_count: {run.participants_count}</div>
            <button
              type="button"
              onClick={() => handleJoin(run.id)}
              disabled={joiningRunId === run.id}
            >
              {joiningRunId === run.id ? 'Joining...' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
