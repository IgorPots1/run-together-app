'use client'

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { AuthSplash } from '@/components/AuthSplash'
import {
  isProfileComplete,
  normalizeProfileDraft,
  profileSelect,
  validateProfileDraft,
  type ProfileGender,
} from '@/lib/profile'
import { supabase } from '@/lib/supabaseClient'
import { useAuthProfile } from '@/lib/useAuthProfile'

type ProfileFormGender = ProfileGender | ''
const onboardingGenderOptions: ProfileGender[] = ['male', 'female']

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

const genderLabels: Record<(typeof onboardingGenderOptions)[number], string> = {
  male: 'Мужчина',
  female: 'Женщина',
}

export default function OnboardingPage() {
  const router = useRouter()
  const { session, authProfileStatus, isBootstrapResolved, profile, profileError, reloadProfile, setProfile } =
    useAuthProfile()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const hasCompletedProfile = isProfileComplete(profile)
  const shouldShowSplash =
    !isBootstrapResolved ||
    !session ||
    authProfileStatus === 'profile_loading' ||
    (authProfileStatus === 'ready' && hasCompletedProfile)

  useEffect(() => {
    if (isBootstrapResolved && !session) {
      router.replace('/auth')
    }
  }, [isBootstrapResolved, router, session])

  useEffect(() => {
    if (authProfileStatus === 'ready' && hasCompletedProfile) {
      router.replace('/')
    }
  }, [authProfileStatus, hasCompletedProfile, router])

  const submitDisabled = isSaving || authProfileStatus !== 'ready' || !session
  const formDefaults = normalizeProfileDraft({
    name: profile?.name ?? '',
    nickname: profile?.nickname ?? '',
    city: profile?.city ?? '',
    gender: profile?.gender ?? '',
  })

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!session?.user.id) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const draft = normalizeProfileDraft({
      name: String(formData.get('name') ?? ''),
      nickname: String(formData.get('nickname') ?? ''),
      city: String(formData.get('city') ?? ''),
      gender: String(formData.get('gender') ?? '') as ProfileFormGender,
    })
    const validationError = validateProfileDraft(draft)

    if (validationError) {
      setSubmitError(validationError)
      return
    }

    setIsSaving(true)
    setSubmitError(null)

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: session.user.id,
          name: draft.name,
          nickname: draft.nickname,
          city: draft.city,
          gender: draft.gender,
        },
        {
          onConflict: 'id',
        }
      )
      .select(profileSelect)
      .single()

    setIsSaving(false)

    if (error) {
      if (error.code === '23505') {
        setSubmitError('Этот никнейм уже занят. Выберите другой.')
        return
      }

      console.error(error)
      setSubmitError('Не удалось сохранить профиль. Попробуйте ещё раз.')
      return
    }

    setProfile(data)
    router.replace('/')
  }

  if (shouldShowSplash) {
    return <AuthSplash />
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ marginBottom: 8 }}>Заполните профиль</h1>
      <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 20 }}>
        После этого можно будет создавать пробежки и присоединяться к другим.
      </p>

      {session.user.email && (
        <div style={{ ...secondaryTextStyle, marginBottom: 16 }}>Вы вошли как {session.user.email}</div>
      )}

      {authProfileStatus === 'error' && profileError && (
        <div style={cardStyle}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Не удалось загрузить профиль</div>
          <div style={secondaryTextStyle}>Попробуйте ещё раз.</div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={reloadProfile}>
              Повторить
            </button>
          </div>
        </div>
      )}

      {authProfileStatus === 'ready' && !profileError && !hasCompletedProfile && (
        <form key={profile?.updated_at ?? profile?.id ?? 'new-profile'} onSubmit={saveProfile} style={formStyle}>
          <label htmlFor="profile_name" style={labelStyle}>
            Имя
            <input
              id="profile_name"
              name="name"
              type="text"
              defaultValue={formDefaults.name}
              required
              style={inputStyle}
            />
          </label>

          <label htmlFor="profile_nickname" style={labelStyle}>
            Никнейм
            <input
              id="profile_nickname"
              name="nickname"
              type="text"
              defaultValue={formDefaults.nickname}
              required
              style={inputStyle}
            />
          </label>

          <label htmlFor="profile_city" style={labelStyle}>
            Город
            <input
              id="profile_city"
              name="city"
              type="text"
              defaultValue={formDefaults.city}
              required
              style={inputStyle}
            />
          </label>

          <label htmlFor="profile_gender" style={labelStyle}>
            Пол
            <select
              id="profile_gender"
              name="gender"
              defaultValue={formDefaults.gender}
              required
              style={inputStyle}
            >
              <option value="">Выберите вариант</option>
              {onboardingGenderOptions.map((profileGender) => (
                <option key={profileGender} value={profileGender}>
                  {genderLabels[profileGender]}
                </option>
              ))}
            </select>
          </label>

          {submitError && <div style={{ color: '#b91c1c', fontSize: 14 }}>{submitError}</div>}

          <div>
            <button type="submit" disabled={submitDisabled}>
              {isSaving ? 'Сохраняем...' : 'Сохранить профиль'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
