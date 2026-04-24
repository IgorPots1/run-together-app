'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Gauge, LogOut, MapPin, Plus, TimerReset, Users } from 'lucide-react'

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
import { getProfileDisplayName, isProfileComplete, type ProfileGender } from '@/lib/profile'
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
  creator_gender: ProfileGender | null
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

function formatGenderLabel(gender: ProfileGender | null): string | null {
  if (gender === 'male') {
    return 'Мужчина'
  }

  if (gender === 'female') {
    return 'Женщина'
  }

  return null
}

function build2GisUrl(latitude: number, longitude: number): string {
  return `https://2gis.ru/geo/${longitude},${latitude}`
}

function formatRunLocationName(locationName: string): string {
  const normalizedLocationName = locationName.trim()

  return normalizedLocationName === '' ? 'Точка на карте выбрана' : normalizedLocationName
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
    <PageContainer className="gap-5 pb-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {email ? (
            <p className="min-w-0 text-sm text-muted-foreground">
              Вы вошли как <span className="break-all font-medium text-foreground">{email}</span>
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="ml-auto h-10 rounded-xl px-3 text-muted-foreground"
            onClick={onSignOut}
          >
            <LogOut className="size-4" />
            Выйти
          </Button>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Пробежки</h1>
          <p className="max-w-[34ch] text-sm leading-6 text-muted-foreground">
            Найдите компанию для пробежки или создайте свою.
          </p>
        </div>
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
  const [isRunsLoading, setIsRunsLoading] = useState(false)
  const [hasLoadedRuns, setHasLoadedRuns] = useState(false)
  const [runsLoadError, setRunsLoadError] = useState<string | null>(null)
  const [expandedRunIds, setExpandedRunIds] = useState<Record<string, boolean>>({})
  const hasCompletedProfile = isProfileComplete(profile)
  const shouldShowSplash =
    !isBootstrapResolved ||
    !session ||
    authProfileStatus === 'profile_loading' ||
    (authProfileStatus === 'ready' && !hasCompletedProfile)

  function toggleRunExpanded(runId: string) {
    setExpandedRunIds((current) => ({
      ...current,
      [runId]: !current[runId],
    }))
  }

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
    setIsRunsLoading(true)
    setRunsLoadError(null)

    void (async () => {
      try {
        const res = await fetch('/api/runs/list')

        if (!res.ok) {
          throw new Error('Failed to load runs')
        }

        const data: Run[] = await res.json()

        if (isMounted) {
          setRuns(data)
          setHasLoadedRuns(true)
          setIsRunsLoading(false)
        }
      } catch (error) {
        console.error(error)

        if (isMounted) {
          setRuns([])
          setRunsLoadError('Не удалось загрузить пробежки. Попробуйте обновить страницу.')
          setHasLoadedRuns(true)
          setIsRunsLoading(false)
        }
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

      <section className="divide-y divide-border/50">
        {isRunsLoading && !hasLoadedRuns ? (
          <SectionBlock>
            <p className="text-sm text-muted-foreground">Загружаем пробежки…</p>
          </SectionBlock>
        ) : runsLoadError ? (
          <SectionBlock>
            <p className="text-sm text-muted-foreground">
              Не удалось загрузить пробежки. Попробуйте обновить страницу.
            </p>
          </SectionBlock>
        ) : hasLoadedRuns && runs.length === 0 ? (
          <SectionBlock>
            <p className="text-sm text-muted-foreground">Пока нет пробежек.</p>
          </SectionBlock>
        ) : null}

        {runs.map((run) => {
          const isExpanded = expandedRunIds[run.id] ?? false
          const creatorGenderLabel = formatGenderLabel(run.creator_gender)

          return (
            <div key={run.id} className="py-3 first:pt-0 last:pb-0">
              <Card
                size="sm"
                className="gap-0 rounded-2xl border-border/70 py-0 shadow-sm transition-all duration-200 ease-out hover:border-border hover:shadow-md"
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => toggleRunExpanded(run.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleRunExpanded(run.id)
                  }
                }}
              >
                <CardHeader className="space-y-0 p-2.5 pb-1 sm:px-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0">
                      <CardTitle className="truncate text-[0.95rem] font-semibold leading-tight text-foreground sm:text-base">
                        {formatRunLocationName(run.location_name)}
                      </CardTitle>
                      <CardDescription className="truncate text-xs leading-snug text-muted-foreground">
                        {formatRunDateTime(run.time)}
                      </CardDescription>
                    </div>
                    <ChevronDown
                      className={`mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>

                <CardContent className="space-y-1 p-2.5 pt-0 sm:px-3.5">
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] text-muted-foreground">
                    <div className="inline-flex h-5 items-center gap-1 rounded-md bg-primary/[0.06] px-1.5 font-semibold text-foreground">
                      <Gauge className="size-3.5 text-primary" />
                      <span>{formatPace(run.pace_sec_per_km)}</span>
                    </div>
                    <div className="inline-flex h-5 items-center gap-1 rounded-md bg-muted px-1.5 font-semibold">
                      <Users className="size-3.5" />
                      <span>{run.participants_count} участ.</span>
                    </div>
                    {creatorGenderLabel ? (
                      <div className="inline-flex h-5 items-center rounded-md bg-muted px-1.5 font-semibold">
                        <span>{creatorGenderLabel}</span>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`grid overflow-hidden transition-all duration-300 ease-out ${
                      isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0">
                      <div
                        className={`overflow-hidden text-sm leading-6 text-muted-foreground transition-all duration-300 ease-out ${
                          isExpanded ? 'border-t border-border/60 pt-2' : 'pt-0'
                        }`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="space-y-2.5">
                          <p>
                            <span className="font-medium text-foreground">Длительность:</span>{' '}
                            {run.duration_minutes ?? 'Не указана'} мин
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Создал:</span> {formatCreatorName(run)}
                            {creatorGenderLabel ? ` (${creatorGenderLabel})` : ''}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Участники:</span>{' '}
                            {run.participants.length > 0
                              ? run.participants
                                  .map((participant) => formatParticipantName(participant))
                                  .join(', ')
                              : 'Пока никто не присоединился'}
                          </p>
                          {run.latitude != null && run.longitude != null ? (
                            <p>
                              <a
                                href={build2GisUrl(run.latitude, run.longitude)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                              >
                                <MapPin className="size-3.5" />
                                Открыть точку на карте
                              </a>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="border-0 bg-transparent p-2.5 pt-1 sm:px-3.5">
                  <Button
                    type="button"
                    className="h-9 w-full rounded-xl px-3 text-[13px] font-semibold shadow-lg shadow-primary/20"
                    onClick={(event) => {
                      event.stopPropagation()
                      void joinRun(run.id)
                    }}
                  >
                    <TimerReset className="size-4" />
                    Присоединиться
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )
        })}
      </section>
    </HomeShell>
  )
}