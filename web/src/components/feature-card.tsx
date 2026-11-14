import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  text: string
  className?: string
  children: ReactNode
}

export function FeatureCard({ icon: Icon, title, text, className, children }: FeatureCardProps) {
  return (
    <article
      className={cn(
        'flex flex-col justify-between gap-8 overflow-hidden rounded-[20px] border border-border bg-card p-6 shadow-[0_31px_13px_rgba(0,0,0,0.01),0_18px_11px_rgba(0,0,0,0.03),0_8px_8px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.05)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:rounded-[24px]',
        className,
      )}
    >
      <div aria-hidden className="flex min-h-40 items-center justify-center">
        {children}
      </div>
      <div className="flex flex-col gap-2.5">
        <h3 className="flex items-start gap-2 text-base leading-[1.3] font-medium tracking-[0.32px]">
          <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          {title}
        </h3>
        <p className="text-[15px] leading-[1.45] tracking-[0.3px] text-foreground/70">{text}</p>
      </div>
    </article>
  )
}
