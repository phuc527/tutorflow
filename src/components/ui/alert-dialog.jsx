import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { overlayClasses, panelClasses } from './dialog'

/*
  Unlike Dialog, an AlertDialog can't be dismissed by clicking outside it,
  which suits "are you sure?" confirmations.
*/
export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogCancel = AlertDialogPrimitive.Cancel

export function AlertDialogContent({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className={overlayClasses} />
      <AlertDialogPrimitive.Content className={cn(panelClasses, 'max-w-md', className)} {...props} />
    </AlertDialogPrimitive.Portal>
  )
}

export function AlertDialogTitle({ className, ...props }) {
  return <AlertDialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />
}

export function AlertDialogDescription({ className, ...props }) {
  return <AlertDialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
}
