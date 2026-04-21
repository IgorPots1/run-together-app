export const profileSelect = 'id, created_at, updated_at, name, nickname, city, gender'

export const profileGenders = ['male', 'female', 'prefer_not_to_say'] as const

export type ProfileGender = (typeof profileGenders)[number]

export type Profile = {
  id: string
  created_at: string
  updated_at: string
  name: string | null
  nickname: string | null
  city: string | null
  gender: ProfileGender | null
}

export type ProfileDraft = {
  name: string
  nickname: string
  city: string
  gender: ProfileGender | ''
}

type ProfileLike = Pick<Profile, 'name' | 'nickname' | 'city' | 'gender'>

export function normalizeProfileText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function isProfileGender(value: string | null | undefined): value is ProfileGender {
  return profileGenders.includes(value as ProfileGender)
}

export function normalizeProfileDraft(draft: ProfileDraft): ProfileDraft {
  return {
    name: normalizeProfileText(draft.name),
    nickname: normalizeProfileText(draft.nickname),
    city: normalizeProfileText(draft.city),
    gender: isProfileGender(draft.gender) ? draft.gender : '',
  }
}

export function validateProfileDraft(draft: ProfileDraft): string | null {
  const normalizedDraft = normalizeProfileDraft(draft)

  if (normalizedDraft.name === '') {
    return 'Укажите имя.'
  }

  if (normalizedDraft.nickname === '') {
    return 'Укажите никнейм.'
  }

  if (normalizedDraft.city === '') {
    return 'Укажите город.'
  }

  if (!isProfileGender(normalizedDraft.gender)) {
    return 'Выберите пол.'
  }

  return null
}

export function isProfileComplete(profile: Partial<ProfileLike> | null | undefined): boolean {
  return (
    normalizeProfileText(profile?.name) !== '' &&
    normalizeProfileText(profile?.nickname) !== '' &&
    normalizeProfileText(profile?.city) !== '' &&
    isProfileGender(profile?.gender ?? null)
  )
}

export function getProfileDisplayName(profile: Partial<ProfileLike> | null | undefined): string | null {
  const name = normalizeProfileText(profile?.name)

  if (name !== '') {
    return name
  }

  const nickname = normalizeProfileText(profile?.nickname)

  return nickname === '' ? null : nickname
}
