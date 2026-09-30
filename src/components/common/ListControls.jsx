import { useEffect, useState } from 'react'
import { MoreHorizontal, Search } from 'lucide-react'
import { Input, NativeSelect } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'

/** Row of filters above a table; wraps on narrow screens. */
export function ListToolbar({ children }) {
  return <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
}

/** Search box that types instantly but only reports the value after typing pauses. */
export function SearchInput({ value, onSearch, placeholder = 'Search…', className }) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, 350)

  useEffect(() => {
    if (debounced !== value) onSearch(debounced)
    // Only react to the user's typing, not to `value` changing from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  )
}

/** Filter dropdown with an "All" choice that maps to ''. */
export function FilterSelect({ value, onChange, options, allLabel, label, className }) {
  return (
    <NativeSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label ?? allLabel}
      className={cn('sm:w-44', className)}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  )
}

/**
 * "⋯" menu for per-row actions. actions: [{ label, icon, onSelect, destructive?, hidden? }]
 * Destructive actions are separated and shown in red.
 */
export function RowActions({ actions, label = 'Row actions' }) {
  const visible = actions.filter((action) => !action.hidden)
  if (!visible.length) return null
  const normal = visible.filter((a) => !a.destructive)
  const destructive = visible.filter((a) => a.destructive)

  const renderItem = ({ label: itemLabel, icon: Icon, onSelect, destructive: isDestructive }) => (
    <DropdownMenuItem key={itemLabel} onSelect={onSelect} className={isDestructive ? 'text-danger' : undefined}>
      {Icon && <Icon />}
      {itemLabel}
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {normal.map(renderItem)}
        {normal.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
        {destructive.map(renderItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
