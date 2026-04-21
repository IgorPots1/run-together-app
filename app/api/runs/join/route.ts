import { supabase } from '@/lib/supabaseClient'

type JoinRunBody = {
  run_id: string
  user_id: string
}

export async function POST(request: Request) {
  let body: JoinRunBody

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { run_id, user_id } = body

  if (!run_id || !user_id) {
    return Response.json({ error: 'Missing run_id or user_id' }, { status: 400 })
  }

  const { error } = await supabase.from('run_participants').insert({
    run_id,
    user_id,
  })

  if (error && error.code !== '23505') {
    return Response.json({ error: 'Failed to join run' }, { status: 500 })
  }

  return Response.json({ success: true })
}
