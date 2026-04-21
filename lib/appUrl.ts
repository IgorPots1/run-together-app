const DEFAULT_DEV_APP_URL = 'http://localhost:3000'

function normalizeAppUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function getAppUrl(): string {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL

  if (configuredAppUrl) {
    return normalizeAppUrl(configuredAppUrl)
  }

  if (typeof window !== 'undefined') {
    return normalizeAppUrl(window.location.origin)
  }

  return DEFAULT_DEV_APP_URL
}

export function getAuthCallbackUrl(): string {
  return `${getAppUrl()}/auth/callback`
}
