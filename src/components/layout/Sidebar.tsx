import { NavLink } from 'react-router'
import { BookOpen } from 'lucide-react'
import { APP_NAME } from '@/constants/app'
import type { NavItem } from '@/constants/navigation'
import { cn } from '@/lib/utils'

export function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 px-5">
      <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <BookOpen className="size-4" />
      </div>
      <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  )
}

/** Navigation list. Rendered in the desktop sidebar and inside the mobile drawer. */
export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
