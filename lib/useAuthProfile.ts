'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  authProfileStatus: AuthProfileStatus
  isBootstrapResolved: boolean
  isAuthLoading: boolean
  profile: Profile | null
  isProfileLoading: boolean
  profileError: string | null
  reloadProfile: () => void
  setProfile: (value: Profile | null) => void
}

export type AuthProfileStatus = 'loading' | 'signed_out' | 'profile_loading' | 'ready' | 'error'

type ProfileLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useAuthProfile(): UseAuthProfileResult {
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [profile, setRawProfile] = useState<Profile | null>(null)
  const [profileLoadStatus, setProfileLoadStatus] = useState<ProfileLoadStatus>('idle')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileStateUserId, setProfileStateUserId] = useState<string | null>(null)
  const [profileReloadToken, setProfileReloadToken] = useState(0)
  const currentSessionUserIdRef = useRef<string | null>(null)

  const resetProfileState = useCallback((nextUserId: string | null, nextStatus: ProfileLoadStatus) => {
    setRawProfile(null)
    setProfileError(null)
    setProfileStateUserId(nextUserId)
    setProfileLoadStatus(nextStatus)
  }, [])

  const setProfile = useCallback(
    (value: Profile | null) => {
      setRawProfile(value)
      setProfileStateUserId(currentSessionUserIdRef.current)
    },
    [],
  )

  const reloadProfile = useCallback(() => {
    setProfileReloadToken((current) => current + 1)
  }, [])

  useEffect(() => {
    let isMounted = true

    function applySession(nextSession: Session | null) {
      const nextUserId = nextSession?.user.id ?? null

      if (currentSessionUserIdRef.current !== nextUserId) {
        resetProfileState(nextUserId, nextUserId ? 'loading' : 'idle')
      }

      currentSessionUserIdRef.current = nextUserId
      setSession(nextSession)
      setIsAuthLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }

      applySession(data.session ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [resetProfileState])

  const sessionUserId = session?.user.id ?? null

  useEffect(() => {
    if (!session?.user || !sessionUserId) {
      return
    }

    const user = session.user
    let isCancelled = false

    async function ensureAndLoadProfile() {
      setProfileStateUserId(sessionUserId)
      setProfileLoadStatus('loading')
      setRawProfile(null)
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
        setRawProfile(null)
        setProfileError('Не удалось подготовить профиль. Попробуйте ещё раз.')
        setProfileStateUserId(sessionUserId)
        setProfileLoadStatus('error')
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
        setRawProfile(null)
        setProfileError('Не удалось загрузить профиль. Попробуйте ещё раз.')
        setProfileStateUserId(sessionUserId)
        setProfileLoadStatus('error')
        return
      }

      setRawProfile(data ?? null)
      setProfileStateUserId(sessionUserId)
      setProfileLoadStatus('ready')
    }

    void ensureAndLoadProfile()

    return () => {
      isCancelled = true
    }
  }, [profileReloadToken, session, sessionUserId])

  const isCurrentProfileState = sessionUserId !== null && profileStateUserId === sessionUserId
  const currentProfile = isCurrentProfileState ? profile : null
  const currentProfileError = isCurrentProfileState ? profileError : null

  const authProfileStatus: AuthProfileStatus = isAuthLoading
    ? 'loading'
    : !session
      ? 'signed_out'
      : !isCurrentProfileState
        ? 'profile_loading'
        : profileLoadStatus === 'error'
        ? 'error'
        : profileLoadStatus === 'ready'
          ? 'ready'
          : 'profile_loading'

  const isBootstrapResolved = authProfileStatus === 'signed_out' || authProfileStatus === 'ready' || authProfileStatus === 'error'
  const isProfileLoading = authProfileStatus === 'profile_loading'

  return {
    session,
    authProfileStatus,
    isBootstrapResolved,
    isAuthLoading,
    profile: currentProfile,
    isProfileLoading,
    profileError: currentProfileError,
    reloadProfile,
    setProfile,
  }
}
