'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, Gauge, LogOut, MapPin, Plus, TimerReset, Users } from 'lucide-react'

import { AuthSplash } from '@/components/AuthSplash'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageContainer } from '@/components/ui/page-container'
import { SectionBlock } from '@/components/ui/section-block'
import { getProfileDisplayName, isProfileComplete } from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'
import { useAuthProfile } from '@/lib/useAuthProfile'

type Participant = {
  id: string
  name: string | null
}

type Run = {
  id: string
  creator_id: string
  creator_name: string | null
  time: string
  duration_minutes: number | null
  distance_km: number | null
  pace_sec_per_km: number | null
  location_name: string
  latitude: number | null
  longitude: number | null
  created_at: string
  participants: Participant[]
  participants_count: number
  last_joined_user_name: string | null
  last_joined_at: string | null
}

function formatPace(seconds: number | null): string {
  if (seconds == null) {
    return 'Не указан'
  }

  const minutesPart = Math.floor(seconds / 60)
  const secondsPart = seconds % 60

  return `${String(minutesPart).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')} / км`
}

function formatRunDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU')
}

function formatCreatorName(run: Run): string {
  return run.creator_name ?? 'Пользователь'
}

function formatParticipantName(participant: Participant): string {
  return participant.name ?? 'Участник'
}

function build2GisUrl(latitude: number, longitude: number): string {
  return `https://2gis.ru/geo/${longitude},${latitude}`
}

function formatRunLocationName(locationName: string): string {
  const normalizedLocationName = locationName.trim()

  return normalizedLocationName === '' ? 'Точка на карте выбрана' : normalizedLocationName
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

function HomeShell({
  email,
  onSignOut,
  children,
}: {
  email?: string
  onSignOut: () => void
  children: ReactNode
}) {
  return (
    <PageContainer className="gap-4 pb-10">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Run Together</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Пробежки</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Найдите компанию для пробежки или создайте свою.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-xl px-3 text-muted-foreground"
            onClick={onSignOut}
          >
            <LogOut className="size-4" />
            Выйти
          </Button>
        </div>
        {email ? (
          <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            Вы вошли как <span className="font-medium text-foreground">{email}</span>
          </div>
        ) : null}
      </header>
      {children}
    </PageContainer>
  )
}

export default function Home() {
  const router = useRouter()
  const { session, authProfileStatus, isBootstrapResolved, profile, profileError, reloadProfile } =
    useAuthProfile()
  const [runs, setRuns] = useState<Run[]>([])
  const hasCompletedProfile = isProfileComplete(profile)
  const shouldShowSplash =
    !isBootstrapResolved ||
    !session ||
    authProfileStatus === 'profile_loading' ||
    (authProfileStatus === 'ready' && !hasCompletedProfile)

  async function joinRun(runId: string) {
    if (!session?.access_token || !hasCompletedProfile) {
      return
    }

    const res = await fetch('/api/runs/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        run_id: runId,
      }),
    })

    if (!res.ok) {
      throw new Error('Failed to join run')
    }

    const data: {
      already_joined: boolean
      last_joined_user_name: string | null
      last_joined_at: string | null
    } = await res.json()

    setRuns((currentRuns) =>
      currentRuns.map((run) => {
        if (run.id !== runId) {
          return run
        }

        if (data.already_joined) {
          return run
        }

        const currentUserName = getProfileDisplayName(profile) ?? session.user.email ?? null

        const alreadyInParticipants = run.participants.some(
          (participant) => participant.id === session.user.id
        )

        return {
          ...run,
          participants_count: run.participants_count + 1,
          participants: alreadyInParticipants
            ? run.participants
            : [
                ...run.participants,
                {
                  id: session.user.id,
                  name: currentUserName,
                },
              ],
          last_joined_user_name: data.last_joined_user_name ?? currentUserName,
          last_joined_at: data.last_joined_at,
        }
      })
    )
  }

  useEffect(() => {
    if (isBootstrapResolved && !session) {
      router.replace('/auth')
    }
  }, [isBootstrapResolved, router, session])

  useEffect(() => {
    if (authProfileStatus === 'ready' && !hasCompletedProfile) {
      router.replace('/onboarding')
    }
  }, [authProfileStatus, hasCompletedProfile, router])

  useEffect(() => {
    if (authProfileStatus !== 'ready' || !session || !hasCompletedProfile) {
      return
    }

    let isMounted = true

    void (async () => {
      try {
        const res = await fetch('/api/runs/list')
        const data: Run[] = await res.json()

        if (isMounted) {
          setRuns(data)
        }
      } catch (error) {
        console.error(error)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [authProfileStatus, hasCompletedProfile, session])

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error(error)
    }
  }

  if (shouldShowSplash) {
    return <AuthSplash />
  }

  if (authProfileStatus === 'error' && profileError) {
    return (
      <HomeShell email={session?.user.email} onSignOut={signOut}>
        <SectionBlock title="Не удалось загрузить профиль">
          <p className="text-sm text-muted-foreground">Попробуйте загрузить данные ещё раз.</p>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={reloadProfile}>
            Повторить
          </Button>
        </SectionBlock>
      </HomeShell>
    )
  }

  if (!hasCompletedProfile) {
    return (
      <HomeShell email={session?.user.email} onSignOut={signOut}>
        <SectionBlock>
          <p className="text-sm text-muted-foreground">Перенаправляем на заполнение профиля...</p>
        </SectionBlock>
      </HomeShell>
    )
  }

  return (
    <HomeShell email={session?.user.email} onSignOut={signOut}>
      <Button
        type="button"
        className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/20"
        onClick={() => router.push('/create-run')}
      >
        <Plus className="size-5" />
        Создать пробежку
      </Button>

      <section className="space-y-3">
        {runs.length === 0 ? (
          <SectionBlock>
            <p className="text-sm text-muted-foreground">Пока нет пробежек.</p>
          </SectionBlock>
        ) : null}

        {runs.map((run) => (
          <Card key={run.id} className="rounded-xl">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    {formatRunLocationName(run.location_name)}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {formatRunDateTime(run.time)}
                  </CardDescription>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {run.participants_count} участ.
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MetaItem
                  icon={<CalendarDays className="size-3.5" />}
                  label="Время"
                  value={formatRunDateTime(run.time)}
                />
                <MetaItem
                  icon={<Gauge className="size-3.5" />}
                  label="Темп"
                  value={formatPace(run.pace_sec_per_km)}
                />
                <MetaItem
                  icon={<MapPin className="size-3.5" />}
                  label="Локация"
                  value={formatRunLocationName(run.location_name)}
                />
                <MetaItem
                  icon={<Users className="size-3.5" />}
                  label="Участники"
                  value={String(run.participants_count)}
                />
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Создал:</span> {formatCreatorName(run)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Длительность:</span>{' '}
                  {run.duration_minutes ?? 'Не указана'} мин
                </p>
                <p>
                  <span className="font-medium text-foreground">Состав:</span>{' '}
                  {run.participants.length > 0
                    ? run.participants.map((participant) => formatParticipantName(participant)).join(', ')
                    : 'Пока никто не присоединился'}
                </p>
                {run.latitude != null && run.longitude != null ? (
                  <p>
                    <a
                      href={build2GisUrl(run.latitude, run.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      Открыть точку на карте
                    </a>
                  </p>
                ) : null}
                {run.last_joined_user_name ? (
                  <p>Недавно присоединился: {run.last_joined_user_name}</p>
                ) : null}
                {!run.last_joined_user_name && run.last_joined_at ? (
                  <p>Недавно присоединился ещё один участник</p>
                ) : null}
              </div>
            </CardContent>

            <CardFooter className="border-t-0 bg-transparent p-4 pt-0">
              <Button
                type="button"
                className="h-11 w-full rounded-xl"
                onClick={() => joinRun(run.id)}
              >
                <TimerReset className="size-4" />
                Присоединиться
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </HomeShell>
  )
}