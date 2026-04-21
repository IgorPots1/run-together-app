import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const now = new Date().toISOString()

  const { data: runs, error } = await supabase
    .from('runs')
    .select(
      'id, creator_id, time, duration_minutes, distance_km, pace_sec_per_km, location_name, lat, lng, created_at, run_participants(user_id, created_at)'
    )
    .gt('time', now)
    .order('time', { ascending: true })

  if (error) {
    return Response.json({ error: 'Failed to fetch runs' }, { status: 500 })
  }

  const userIds = Array.from(
    new Set(
      (runs ?? []).flatMap((run) => [
        run.creator_id,
        ...(run.run_participants?.map((participant) => participant.user_id) ?? []),
      ])
    )
  )

  const usersById = new Map()

  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds)

    if (usersError) {
      return Response.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    for (const user of users ?? []) {
      usersById.set(user.id, user)
    }
  }

  return Response.json(
    (runs ?? []).map((run) => {
      const lastJoinedParticipant =
        (run.run_participants ?? []).reduce<{
          user_id: string
          created_at: string | null
        } | null>((latest, participant) => {
          if (!participant.created_at) {
            return latest
          }

          if (!latest || participant.created_at > latest.created_at!) {
            return participant
          }

          return latest
        }, null) ?? null

      return {
        id: run.id,
        creator_id: run.creator_id,
        creator_name: usersById.get(run.creator_id)?.name ?? null,
        time: run.time,
        duration_minutes: run.duration_minutes,
        distance_km: run.distance_km,
        pace_sec_per_km: run.pace_sec_per_km,
        location_name: run.location_name,
        lat: run.lat,
        lng: run.lng,
        created_at: run.created_at,
        participants: (run.run_participants ?? []).map((participant) => ({
          id: participant.user_id,
          name: usersById.get(participant.user_id)?.name ?? null,
        })),
        participants_count: run.run_participants?.length ?? 0,
        last_joined_user_name: lastJoinedParticipant
          ? usersById.get(lastJoinedParticipant.user_id)?.name ?? null
          : null,
        last_joined_at: lastJoinedParticipant?.created_at ?? null,
      }
    })
  )
}
