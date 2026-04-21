import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const now = new Date().toISOString()

  const { data: runs, error } = await supabase
    .from('runs')
    .select(
      'id, creator_id, time, duration_minutes, distance_km, pace_sec_per_km, location_name, lat, lng, created_at, run_participants(run_id)'
    )
    .gt('time', now)
    .order('time', { ascending: true })

  if (error) {
    return Response.json({ error: 'Failed to fetch runs' }, { status: 500 })
  }

  return Response.json(
    (runs ?? []).map((run) => ({
      id: run.id,
      creator_id: run.creator_id,
      time: run.time,
      duration_minutes: run.duration_minutes,
      distance_km: run.distance_km,
      pace_sec_per_km: run.pace_sec_per_km,
      location_name: run.location_name,
      lat: run.lat,
      lng: run.lng,
      created_at: run.created_at,
      participants_count: run.run_participants?.length ?? 0,
    }))
  )
}
