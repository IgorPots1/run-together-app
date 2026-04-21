import { getProfileDisplayName, isProfileComplete } from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'

type JoinRunBody = {
  run_id: string
}

export async function POST(request: Request) {
  let body: JoinRunBody

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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name, nickname, city, gender')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return Response.json({ error: 'Failed to verify profile' }, { status: 500 })
  }

  if (!isProfileComplete(profile)) {
    return Response.json({ error: 'Profile is incomplete' }, { status: 403 })
  }

  const { run_id } = body

  if (!run_id) {
    return Response.json({ error: 'Missing run_id' }, { status: 400 })
  }

  const joinedAt = new Date().toISOString()
  const joinedUserName = getProfileDisplayName(profile) ?? user.email ?? null

  const { error } = await supabase.from('run_participants').insert({
    run_id,
    user_id: user.id,
    created_at: joinedAt,
  })

  if (error && error.code !== '23505') {
    return Response.json({ error: 'Failed to join run' }, { status: 500 })
  }

  return Response.json({
    success: true,
    already_joined: error?.code === '23505',
    last_joined_user_name: joinedUserName,
    last_joined_at: joinedAt,
  })
}
