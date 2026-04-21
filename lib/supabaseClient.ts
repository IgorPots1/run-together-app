import { createClient } from '@supabase/supabase-js'

function getRequiredEnvVar(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing required Supabase environment variable: ${name}. Add it to your local .env.local and your Vercel project environment settings.`
    )
  }

  return value
}

const supabaseUrl = getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const isBrowser = typeof window !== 'undefined'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
  },
})
