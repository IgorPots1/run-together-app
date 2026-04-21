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

  const { run_id } = body

  if (!run_id) {
    return Response.json({ error: 'Missing run_id' }, { status: 400 })
  }

  const joinedAt = new Date().toISOString()
  const joinedUserName =
    user.user_metadata.name ??
    user.user_metadata.full_name ??
    user.email ??
    null

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
