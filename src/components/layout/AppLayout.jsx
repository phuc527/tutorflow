import { useState } from 'react'
import { Outlet } from 'react-router'
import { Menu } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { navItemsForRole } from '@/constants/navigation'
import { Brand, SidebarNav } from './Sidebar'
import { Breadcrumbs } from './Breadcrumbs'
import { UserMenu } from './UserMenu'

/**
 * Shell for every authenticated page:
 * - desktop (lg+): fixed sidebar on the left
 * - mobile/tablet: sidebar hidden, opened as a slide-in drawer from the menu button
 */
export function AppLayout({ profile, navItems, onSignOut }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const items = navItems ?? navItemsForRole(profile?.role ?? null)

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-card lg:block">
        <Brand />
        <SidebarNav items={items} />
      </aside>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card shadow-lg lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Main navigation menu</DialogPrimitive.Description>
            <Brand />
            <SidebarNav items={items} onNavigate={() => setDrawerOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
            <Menu />
            <span className="sr-only">Open navigation</span>
          </Button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <UserMenu profile={profile} onSignOut={onSignOut} />
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
