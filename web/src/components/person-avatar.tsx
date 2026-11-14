import type { ComponentProps } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PersonAvatarProps extends ComponentProps<typeof Avatar> {
  name: string
  photo?: string
}

export function PersonAvatar({ name, photo, className, children, ...props }: PersonAvatarProps) {
  return (
    <Avatar className={cn('font-semibold', className)} {...props}>
      {photo && <AvatarImage src={photo} alt="" referrerPolicy="no-referrer" draggable={false} />}
      <AvatarFallback className="bg-secondary text-[length:inherit] text-secondary-foreground">
        {initials(name)}
      </AvatarFallback>
      {children}
    </Avatar>
  )
}
