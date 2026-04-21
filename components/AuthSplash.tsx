'use client'

import type { CSSProperties } from 'react'

const splashStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 320,
  padding: '18px 20px',
  border: '1px solid #d1d5db',
  borderRadius: 16,
  backgroundColor: '#fff',
  color: '#475569',
  textAlign: 'center',
}

type AuthSplashProps = {
  message?: string
}

export function AuthSplash({ message = 'Загружаем...' }: AuthSplashProps) {
  return (
    <div style={splashStyle}>
      <div style={cardStyle}>{message}</div>
    </div>
  )
}
