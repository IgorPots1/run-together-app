'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { profileSelect, type Profile } from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'

function getBootstrapProfileName(user: User): string | null {
  const metadataName =
    typeof user.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null

  const normalizedMetadataName = metadataName?.trim() ?? ''

  return normalizedMetadataName === '' ? null : normalizedMetadataName
}

type UseAuthProfileResult = {
  session: Session | null
  isAuthLoading: boolean
  profile: Profile | null
  isProfileLoading: boolean
  profileError: string | null
  reloadProfile: () => void
  setProfile: (value: Profile | null) => void
}

export function useAuthProfile(): UseAuthProfileResult {
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileReloadToken, setProfileReloadToken] = useState(0)

  const resetProfileState = useCallback(() => {
    setProfile(null)
    setProfileError(null)
    setIsProfileLoading(false)
  }, [])

  const reloadProfile = useCallback(() => {
    setProfileReloadToken((current) => current + 1)
  }, [])

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }

      setSession(data.session ?? null)

      if (!data.session) {
        resetProfileState()
      }

      setIsAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)

      if (!nextSession) {
        resetProfileState()
      }

      setIsAuthLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [resetProfileState])

  useEffect(() => {
    if (!session?.user) {
      return
    }

    const user = session.user
    const sessionUserId = user.id
    let isCancelled = false

    async function ensureAndLoadProfile() {
      setIsProfileLoading(true)
      setProfileError(null)

      const bootstrapName = getBootstrapProfileName(user)
      const bootstrapPayload = bootstrapName === null ? { id: sessionUserId } : { id: sessionUserId, name: bootstrapName }

      const { error: bootstrapError } = await supabase.from('profiles').upsert(bootstrapPayload, {
        onConflict: 'id',
        ignoreDuplicates: true,
      })

      if (isCancelled) {
        return
      }

      if (bootstrapError) {
        setProfile(null)
        setProfileError('Не удалось подготовить профиль. Попробуйте ещё раз.')
        setIsProfileLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(profileSelect)
        .eq('id', sessionUserId)
        .maybeSingle()

      if (isCancelled) {
        return
      }

      if (error) {
        setProfile(null)
        setProfileError('Не удалось загрузить профиль. Попробуйте ещё раз.')
        setIsProfileLoading(false)
        return
      }

      setProfile(data ?? null)
      setIsProfileLoading(false)
    }

    void ensureAndLoadProfile()

    return () => {
      isCancelled = true
    }
  }, [profileReloadToken, session])

  return {
    session,
    isAuthLoading,
    profile,
    isProfileLoading,
    profileError,
    reloadProfile,
    setProfile,
  }
}
