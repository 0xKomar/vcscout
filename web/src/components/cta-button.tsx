import type { ComponentProps } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CtaButtonProps extends ComponentProps<'button'> {
  size?: 'sm' | 'md'
  tone?: 'dark' | 'light'
}

export function CtaButton({
  size = 'md',
  tone = 'dark',
  className,
  children,
  ...props
}: CtaButtonProps) {
  return (
    <Button
      className={cn(
        'group/cta rounded-full shadow-[0_1px_0.5px_rgba(0,0,0,0.1),0_2px_1px_rgba(0,0,0,0.09),0_5px_1.5px_rgba(0,0,0,0.05)] hover:opacity-90',
        tone === 'dark'
          ? 'border-white/25 bg-linear-to-b from-[color-mix(in_oklab,var(--primary),white_12%)] to-primary to-[33%] hover:bg-primary'
          : 'bg-card text-foreground hover:bg-card',
        size === 'md' ? 'h-12 gap-3 pr-2 pl-5 text-base' : 'h-10 gap-2.5 pr-1.5 pl-4 text-sm',
        className,
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center rounded-full transition-transform duration-200 group-hover/cta:translate-x-0.5 motion-reduce:transition-none',
          tone === 'dark' ? 'bg-card text-foreground' : 'bg-primary text-primary-foreground',
          size === 'md' ? 'size-8' : 'size-7',
        )}
      >
        <ArrowRight className="size-4" />
      </span>
    </Button>
  )
}
