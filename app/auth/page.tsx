'use client'

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { isProfileComplete } from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'
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

const formStyle: CSSProperties = {
  ...cardStyle,
  display: 'grid',
  gap: 14,
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  marginTop: 6,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: 0,
}

const secondaryTextStyle: CSSProperties = {
  color: '#475569',
  fontSize: 14,
}

function getAuthErrorMessage(message: string, fallbackMessage: string): string {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'Неверный email или пароль.'
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return 'Не удалось завершить вход. Попробуйте ещё раз позже.'
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'Этот email уже зарегистрирован. Попробуйте войти.'
  }

  if (normalizedMessage.includes('password should be at least')) {
    return 'Пароль должен быть не короче 6 символов.'
  }

  return fallbackMessage
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getAuthCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`
}

export default function AuthPage() {
  const router = useRouter()
  const { session, isAuthLoading, profile, isProfileLoading, profileError, reloadProfile } = useAuthProfile()
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authInfo, setAuthInfo] = useState<string | null>(null)
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)

  const hasCompletedProfile = isProfileComplete(profile)

  useEffect(() => {
    if (!isAuthLoading && session && !isProfileLoading && !profileError) {
      router.replace(hasCompletedProfile ? '/' : '/onboarding')
    }
  }, [hasCompletedProfile, isAuthLoading, isProfileLoading, profileError, router, session])

  async function signInWithGoogle() {
    setAuthError(null)
    setAuthInfo(null)
    setIsSubmittingAuth(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthCallbackUrl(),
      },
    })

    setIsSubmittingAuth(false)

    if (error) {
      console.error(error)
      setAuthError('Не удалось начать вход через Google. Попробуйте ещё раз.')
    }
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = authEmail.trim()

    if (trimmedEmail === '' || authPassword === '') {
      setAuthInfo(null)
      setAuthError('Введите email и пароль.')
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setAuthInfo(null)
      setAuthError('Укажите корректный email.')
      return
    }

    setIsSubmittingAuth(true)
    setAuthError(null)
    setAuthInfo(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: authPassword,
    })

    setIsSubmittingAuth(false)

    if (error) {
      setAuthError(getAuthErrorMessage(error.message, 'Не удалось войти. Попробуйте ещё раз.'))
      return
    }

    setAuthPassword('')
  }

  async function signUpWithEmail() {
    const trimmedEmail = authEmail.trim()

    if (trimmedEmail === '') {
      setAuthInfo(null)
      setAuthError('Укажите email.')
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setAuthInfo(null)
      setAuthError('Укажите корректный email.')
      return
    }

    if (authPassword.length < 6) {
      setAuthInfo(null)
      setAuthError('Пароль должен быть не короче 6 символов.')
      return
    }

    setIsSubmittingAuth(true)
    setAuthError(null)
    setAuthInfo(null)

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: authPassword,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    })

    setIsSubmittingAuth(false)

    if (error) {
      setAuthError(getAuthErrorMessage(error.message, 'Не удалось зарегистрироваться. Попробуйте ещё раз.'))
      return
    }

    setAuthPassword('')

    if (!data.session) {
      setAuthInfo('Аккаунт создан. Если вход не произошёл автоматически, попробуйте войти по email и паролю.')
    }
  }

  if (isAuthLoading) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginBottom: 8 }}>Вход</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Войдите по email или через Google, чтобы продолжить.
        </p>
        <div style={{ ...cardStyle, ...secondaryTextStyle }}>Проверяем вход...</div>
      </div>
    )
  }

  if (session && isProfileLoading) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginBottom: 8 }}>Вход</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Войдите по email или через Google, чтобы продолжить.
        </p>
        <div style={{ ...cardStyle, ...secondaryTextStyle }}>Подготавливаем профиль...</div>
      </div>
    )
  }

  if (session && profileError) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginBottom: 8 }}>Вход</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Войдите по email или через Google, чтобы продолжить.
        </p>
        <div style={cardStyle}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Не удалось загрузить профиль</div>
          <div style={secondaryTextStyle}>Попробуйте загрузить данные ещё раз.</div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={reloadProfile}>
              Повторить
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (session) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginBottom: 8 }}>Вход</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
          Войдите по email или через Google, чтобы продолжить.
        </p>
        <div style={{ ...cardStyle, ...secondaryTextStyle }}>
          {hasCompletedProfile ? 'Перенаправляем в приложение...' : 'Перенаправляем на заполнение профиля...'}
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ marginBottom: 8 }}>Вход</h1>
      <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
        Войдите по email или через Google, чтобы продолжить.
      </p>

      <form onSubmit={signInWithEmail} style={formStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Вход или регистрация</h2>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 4 }}>
          Используйте email и пароль или войдите через Google.
        </p>

        <label htmlFor="auth_email" style={labelStyle}>
          Email
          <input
            id="auth_email"
            type="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <label htmlFor="auth_password" style={labelStyle}>
          Пароль
          <input
            id="auth_password"
            type="password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            required
            style={inputStyle}
          />
        </label>

        {authError && <div style={{ color: '#b91c1c', fontSize: 14 }}>{authError}</div>}
        {authInfo && <div style={{ color: '#0f766e', fontSize: 14 }}>{authInfo}</div>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" disabled={isSubmittingAuth}>
            {isSubmittingAuth ? 'Выполняем вход...' : 'Войти по email'}
          </button>
          <button type="button" onClick={signUpWithEmail} disabled={isSubmittingAuth}>
            Зарегистрироваться
          </button>
        </div>
      </form>

      <div style={cardStyle}>
        <button type="button" onClick={signInWithGoogle} disabled={isSubmittingAuth}>
          Войти через Google
        </button>
      </div>
    </div>
  )
}
