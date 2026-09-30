import { Fragment } from 'react'
import { Link, useMatches } from 'react-router'
import { ChevronRight } from 'lucide-react'

/** What a route may put in its `handle` (see router.tsx). */
export interface RouteHandle {
  crumb?: string
}

/**
 * Built from route config: any route with `handle: { crumb: 'Label' }` contributes a crumb.
 * Adding a page never requires editing this component.
 */
export function Breadcrumbs() {
  const crumbs = useMatches().flatMap((match) => {
    const crumb = (match.handle as RouteHandle | undefined)?.crumb
    return crumb ? [{ path: match.pathname, label: crumb }] : []
  })

  if (!crumbs.length) return null

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 truncate text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={crumb.path}>
              {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
              <li className="truncate">
                {isLast ? (
                  <span className="font-medium text-foreground" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link to={crumb.path} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
