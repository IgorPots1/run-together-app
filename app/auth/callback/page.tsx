'use client'

import { useEffect, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

import { isProfileComplete } from '@/lib/profile'
import { useAuthProfile } from '@/lib/useAuthProfile'

const pageStyle: CSSProperties = {
  maxWidth: 520,
  margin: '0 auto',
  padding: 20,
}

const cardStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  backgroundColor: '#fff',
}

const secondaryTextStyle: CSSProperties = {
  color: '#475569',
  fontSize: 14,
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const { session, isAuthLoading, profile, isProfileLoading, profileError, reloadProfile } = useAuthProfile()
  const hasCompletedProfile = isProfileComplete(profile)

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!session) {
      router.replace('/auth')
      return
    }

    if (isProfileLoading || profileError) {
      return
    }

    router.replace(hasCompletedProfile ? '/' : '/onboarding')
  }, [hasCompletedProfile, isAuthLoading, isProfileLoading, profileError, router, session])

  if (profileError) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginBottom: 8 }}>Завершаем вход</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Проверяем аккаунт и подготавливаем ваш профиль.
        </p>
        <div style={cardStyle}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Не удалось загрузить профиль</div>
          <div style={secondaryTextStyle}>Попробуйте ещё раз.</div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={reloadProfile}>
              Повторить
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ marginBottom: 8 }}>Завершаем вход</h1>
      <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
        Проверяем аккаунт и подготавливаем ваш профиль.
      </p>
      <div style={{ ...cardStyle, ...secondaryTextStyle }}>Подождите немного...</div>
    </div>
  )
}
