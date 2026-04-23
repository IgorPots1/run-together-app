'use client'

import { Card, CardContent } from '@/components/ui/card'
import { PageContainer } from '@/components/ui/page-container'

type AuthSplashProps = {
  message?: string
}

export function AuthSplash({ message = 'Загружаем...' }: AuthSplashProps) {
  return (
    <PageContainer className="items-center justify-center pb-6">
      <Card className="w-full max-w-sm rounded-2xl">
        <CardContent className="px-5 py-6 text-center text-sm text-muted-foreground">
          {message}
        </CardContent>
      </Card>
    </PageContainer>
  )
}
