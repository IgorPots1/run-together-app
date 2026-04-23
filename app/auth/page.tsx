'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { AuthSplash } from '@/components/AuthSplash'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/components/ui/page-container'
import { getAuthCallbackUrl } from '@/lib/appUrl'
import { isProfileComplete } from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'
import { useAuthProfile } from '@/lib/useAuthProfile'

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

function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <PageContainer className="justify-center gap-6 pb-10 pt-10">
      <div className="space-y-3">
        <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Run Together
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="max-w-[34ch] text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </PageContainer>
  )
}

function AuthField({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string
  label: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function AuthMessage({
  tone,
  children,
}: {
  tone: 'error' | 'info'
  children: ReactNode
}) {
  return (
    <div
      className={
        tone === 'error'
          ? 'rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'
          : 'rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-700'
      }
    >
      {children}
    </div>
  )
}

export default function AuthPage() {
  const router = useRouter()
  const { session, authProfileStatus, profile, profileError, reloadProfile } = useAuthProfile()
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authInfo, setAuthInfo] = useState<string | null>(null)
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)

  const hasCompletedProfile = isProfileComplete(profile)
  const shouldShowSplash =
    authProfileStatus === 'loading' ||
    authProfileStatus === 'profile_loading' ||
    (authProfileStatus === 'ready' && !!session)

  useEffect(() => {
    if (authProfileStatus === 'ready') {
      router.replace(hasCompletedProfile ? '/' : '/onboarding')
    }
  }, [authProfileStatus, hasCompletedProfile, router])

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

  if (shouldShowSplash) {
    return <AuthSplash />
  }

  if (authProfileStatus === 'error' && session && profileError) {
    return (
      <AuthShell
        title="Войти"
        description="Войдите по email или через Google, чтобы смотреть пробежки и создавать свои."
      >
        <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Не удалось загрузить профиль</h2>
            <p className="text-sm text-muted-foreground">Попробуйте загрузить данные ещё раз.</p>
          </div>
          <Button type="button" className="h-12 rounded-xl px-4" onClick={reloadProfile}>
            Повторить
          </Button>
        </section>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Войти"
      description="Войдите по email или через Google, чтобы смотреть пробежки и создавать свои."
    >
      <form
        onSubmit={signInWithEmail}
        className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Продолжить с email</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Используйте email и пароль для входа или создайте новый аккаунт.
          </p>
        </div>

        <div className="space-y-4">
          <AuthField htmlFor="auth_email" label="Email">
            <Input
              id="auth_email"
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              required
              className="bg-background"
            />
          </AuthField>

          <AuthField htmlFor="auth_password" label="Пароль">
            <Input
              id="auth_password"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              required
              className="bg-background"
            />
          </AuthField>
        </div>

        {authError ? <AuthMessage tone="error">{authError}</AuthMessage> : null}
        {authInfo ? <AuthMessage tone="info">{authInfo}</AuthMessage> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" disabled={isSubmittingAuth} className="h-12 rounded-xl text-sm font-semibold">
            {isSubmittingAuth ? 'Выполняем вход...' : 'Войти'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={signUpWithEmail}
            disabled={isSubmittingAuth}
            className="h-12 rounded-xl text-sm font-semibold"
          >
            Зарегистрироваться
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">или</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={signInWithGoogle}
          disabled={isSubmittingAuth}
          className="h-12 w-full rounded-xl text-sm font-medium"
        >
          Войти через Google
        </Button>
      </form>
    </AuthShell>
  )
}
