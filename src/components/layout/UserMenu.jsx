import { ChevronDown, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/common/StatusBadge'
import { initials } from '@/utils/format'

export function UserMenu({ profile, onSignOut }) {
  if (!profile) return null
  const name = profile.full_name || profile.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
          {initials(name)}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium md:block">{name}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <div className="truncate font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{profile.email}</div>
          <StatusBadge status={profile.role} className="mt-2" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className="text-danger">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
