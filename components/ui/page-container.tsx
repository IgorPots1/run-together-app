import * as React from "react"

import { cn } from "@/lib/utils"

function PageContainer({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-28 pt-6 sm:px-5 sm:pt-8",
        className
      )}
      {...props}
    />
  )
}

export { PageContainer }
