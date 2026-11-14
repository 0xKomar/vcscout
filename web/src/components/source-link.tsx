import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hostLabel, safeHttpUrl } from '@/lib/format'

interface SourceLinkProps {
  url: string
  label?: string
  className?: string
}

export function SourceLink({ url, label, className }: SourceLinkProps) {
  const parsed = safeHttpUrl(url)
  if (!parsed) return null
  return (
    <a
      href={parsed.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
        className,
      )}
    >
      {label ?? hostLabel(url)}
      <ArrowUpRight className="size-3" aria-hidden />
    </a>
  )
}
