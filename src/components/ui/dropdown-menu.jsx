import { DropdownMenu as DropdownPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...props }) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('z-50 min-w-48 rounded-md border bg-card p-1 shadow-md', className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }) {
  return <DropdownPrimitive.Label className={cn('px-2 py-1.5 text-sm', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }) {
  return <DropdownPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}
