import { getProfileDisplayName } from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const now = new Date().toISOString()

  const { data: runs, error } = await supabase
    .from('runs')
    .select(
      'id, creator_id, time, duration_minutes, distance_km, pace_sec_per_km, location_name, latitude, longitude, created_at, run_participants(user_id, created_at)'
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

  const profilesById = new Map()

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, nickname')
      .in('id', userIds)

    if (profilesError) {
      return Response.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    for (const profile of profiles ?? []) {
      profilesById.set(profile.id, profile)
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
        creator_name: getProfileDisplayName(profilesById.get(run.creator_id)),
        time: run.time,
        duration_minutes: run.duration_minutes,
        distance_km: run.distance_km,
        pace_sec_per_km: run.pace_sec_per_km,
        location_name: run.location_name,
        latitude: run.latitude,
        longitude: run.longitude,
        created_at: run.created_at,
        participants: (run.run_participants ?? []).map((participant) => ({
          id: participant.user_id,
          name: getProfileDisplayName(profilesById.get(participant.user_id)),
        })),
        participants_count: run.run_participants?.length ?? 0,
        last_joined_user_name: lastJoinedParticipant
          ? getProfileDisplayName(profilesById.get(lastJoinedParticipant.user_id))
          : null,
        last_joined_at: lastJoinedParticipant?.created_at ?? null,
      }
    })
  )
}
