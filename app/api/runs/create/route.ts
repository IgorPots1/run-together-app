import { supabase } from '@/lib/supabaseClient'

type CreateRunBody = {
  creator_id: string
  time: string
  duration_minutes?: number
  distance_km?: number
  pace_sec_per_km?: number
  location_name: string
  lat: number
  lng: number
}

export async function POST(request: Request) {
  let body: CreateRunBody

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    creator_id,
    time,
    duration_minutes,
    distance_km,
    pace_sec_per_km,
    location_name,
    lat,
    lng,
  } = body

  if (duration_minutes == null && distance_km == null) {
    return Response.json(
      { error: 'Either duration_minutes or distance_km is required' },
      { status: 400 }
    )
  }

  if (
    !creator_id ||
    !time ||
    !location_name ||
    typeof lat !== 'number' ||
    typeof lng !== 'number'
  ) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: run, error: runError } = await supabase
    .from('runs')
    .insert({
      creator_id,
      time,
      duration_minutes,
      distance_km,
      pace_sec_per_km,
      location_name,
      lat,
      lng,
    })
    .select()
    .single()

  if (runError || !run) {
    return Response.json({ error: 'Failed to create run' }, { status: 500 })
  }

  const { error: participantError } = await supabase
    .from('run_participants')
    .insert({
      run_id: run.id,
      user_id: creator_id,
    })

  if (participantError) {
    return Response.json({ error: 'Failed to add creator to run' }, { status: 500 })
  }

  return Response.json(run, { status: 201 })
}
