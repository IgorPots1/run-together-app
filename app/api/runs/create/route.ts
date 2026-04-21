import { isProfileComplete } from '@/lib/profile'
import {
  createAuthenticatedSupabaseServerClient,
  supabase,
} from '@/lib/supabaseClient'

type CreateRunBody = {
  time: string
  duration_minutes?: number
  distance_km?: number
  pace_sec_per_km?: number
  location_name: string
  latitude?: number | null
  longitude?: number | null
  lat?: number | null
  lng?: number | null
}

export async function POST(request: Request) {
  let body: CreateRunBody

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  if (!accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken)

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('run create user.id', user.id)

  const authenticatedSupabase = createAuthenticatedSupabaseServerClient(accessToken)

  const { data: profile, error: profileError } = await authenticatedSupabase
    .from('profiles')
    .select('name, nickname, city, gender')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.log(profileError)
    return Response.json(
      { error: profileError?.message || 'Failed to load profile' },
      { status: 500 }
    )
  }

  if (!isProfileComplete(profile)) {
    return Response.json({ error: 'Profile is incomplete' }, { status: 403 })
  }

  const {
    time,
    duration_minutes,
    distance_km,
    pace_sec_per_km,
    location_name,
    lat,
    lng,
  } = body
  const latitude =
    typeof body.latitude === 'number'
      ? body.latitude
      : typeof lat === 'number'
        ? lat
        : null
  const longitude =
    typeof body.longitude === 'number'
      ? body.longitude
      : typeof lng === 'number'
        ? lng
        : null

  if (duration_minutes == null && distance_km == null) {
    return Response.json(
      { error: 'Either duration_minutes or distance_km is required' },
      { status: 400 }
    )
  }

  if (
    !time ||
    !location_name ||
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const runInsertPayload = {
    creator_id: user.id,
    time,
    duration_minutes,
    distance_km,
    pace_sec_per_km,
    location_name,
    latitude,
    longitude,
  }

  console.log('run create payload', runInsertPayload)

  const { data: run, error: runError } = await authenticatedSupabase
    .from('runs')
    .insert(runInsertPayload)
    .select()
    .single()

  if (runError || !run) {
    console.log(runError)
    return Response.json(
      { error: runError?.message || 'Failed to create run' },
      { status: 500 }
    )
  }

  const participantInsertPayload = {
    run_id: run.id,
    user_id: user.id,
    created_at: new Date().toISOString(),
  }

  console.log('run participant payload', participantInsertPayload)

  const { error: participantError } = await authenticatedSupabase
    .from('run_participants')
    .insert(participantInsertPayload)

  if (participantError) {
    console.log(participantError)
    return Response.json(
      { error: participantError?.message || 'Failed to create run participant' },
      { status: 500 }
    )
  }

  return Response.json(run, { status: 201 })
}
