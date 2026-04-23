import * as React from "react"

import { cn } from "@/lib/utils"

type SectionBlockProps = React.ComponentProps<"section"> & {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  contentClassName?: string
}

function SectionBlock({
  className,
  title,
  description,
  action,
  children,
  contentClassName,
  ...props
}: SectionBlockProps) {
  return (
    <section
      className={cn("rounded-xl border border-border/70 bg-card p-5 shadow-sm", className)}
      {...props}
    >
      {(title || description || action) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            {title ? <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  )
}

export { SectionBlock }
