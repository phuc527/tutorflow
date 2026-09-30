import { useEffect, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingState } from './States'

export interface Column<T> {
  key: string
  header: ReactNode
  /** Renders the cell; without it the row's `key` property is shown as-is. */
  cell?: (row: T) => ReactNode
  className?: string
}

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[] | undefined
  rowKey?: (row: T) => string
  isLoading: boolean
  error: { message: string } | null
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: ReactNode
  emptyAction?: ReactNode
  pagination?: PaginationProps
}

/**
 * Generic table that owns the loading / error / empty / pagination states,
 * so feature pages only describe their columns.
 *
 * columns: [{ key, header, cell?: (row) => node, className? }]
 * pagination: { page (1-based), pageSize, total, onPageChange } (server-side)
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  rowKey = (row) => row.id,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pagination,
}: DataTableProps<T>) {
  // If the current page no longer exists (e.g. its last row was deleted), step back to the last real page.
  const lastPage = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1
  const pageOutOfRange = Boolean(pagination && !isLoading && !error && pagination.total > 0 && pagination.page > lastPage)
  useEffect(() => {
    if (pageOutOfRange) pagination?.onPageChange(lastPage)
  }, [pageOutOfRange, lastPage, pagination])

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState title="Could not load data" error={error} onRetry={onRetry} />
  if (!data?.length) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.cell ? col.cell(row) : (((row as Record<string, unknown>)[col.key] as ReactNode) ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pagination && <Pagination {...pagination} />}
    </div>
  )
}

function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft /> Prev
        </Button>
        <span className="tabular-nums">
          {page} / {pageCount}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
