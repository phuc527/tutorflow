import { useEffect, useRef, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/common/States'
import { formatBillingMonth } from '@/utils/datetime'
import { formatCurrency } from '@/utils/format'

/*
  Stacked bars: paid (anchored to the baseline) + unpaid per billing month.
  Colours validated with the dataviz palette checker: green #15803d / amber #f59e0b pass
  colour-blind separation (ΔE 17.4; green/red was 5.0 → fail). Amber is below 3:1 against white,
  so identity never relies on colour alone: legend + tooltip text + a table view.
*/
const SERIES = [
  { key: 'paid_amount', label: 'Paid', color: '#15803d' },
  { key: 'unpaid_amount', label: 'Unpaid', color: '#f59e0b' },
]
const HEIGHT = 220
const MARGIN = { top: 12, right: 8, bottom: 28, left: 52 }
const GAP = 2 // surface gap between stacked segments
const RADIUS = 4 // rounded data end (top of the stack only)

const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })

function niceMax(value) {
  const step = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 2.5, 5, 10].map((m) => m * step).find((v) => v >= value)
}

/** Rectangle with only the top corners rounded. */
function topRoundedRect(x, y, w, h, r) {
  const radius = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`
}

function useWidth(ref) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return width
}

export function PaymentTrendChart({ data }) {
  const containerRef = useRef(null)
  const width = useWidth(containerRef) || 600
  const [hovered, setHovered] = useState(null)

  const rows = data.map((d) => ({ ...d, paid_amount: Number(d.paid_amount), unpaid_amount: Number(d.unpaid_amount) }))
  const maxTotal = Math.max(...rows.map((d) => d.paid_amount + d.unpaid_amount), 0)

  const innerW = Math.max(width - MARGIN.left - MARGIN.right, 50)
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom
  const max = maxTotal > 0 ? niceMax(maxTotal) : 1
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const y = (v) => innerH - (v / max) * innerH
  const band = innerW / Math.max(rows.length, 1)
  const barW = Math.min(40, band * 0.55)

  const hoveredRow = hovered === null ? null : rows[hovered]

  return (
    <div>
      {/* Legend: always present for 2 series */}
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={containerRef} className="relative">
        {maxTotal === 0 ? (
          <EmptyState icon={BarChart3} title="No payment records yet" description="Monthly totals appear here once records exist." className="py-8" />
        ) : (
          <svg width={width} height={HEIGHT} role="img" aria-label="Paid and unpaid amounts per month" className="block overflow-visible">
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Recessive grid + y labels */}
              {ticks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x1={0} x2={innerW} stroke="var(--color-border)" strokeDasharray={t === 0 ? undefined : '2 3'} />
                  <text x={-8} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                    {compact.format(t)}
                  </text>
                </g>
              ))}

              {rows.map((d, i) => {
                const cx = band * i + band / 2
                const x = cx - barW / 2
                const paidTop = y(d.paid_amount)
                const totalTop = y(d.paid_amount + d.unpaid_amount)
                const paidH = innerH - paidTop
                const hasUnpaid = d.unpaid_amount > 0
                const unpaidH = paidTop - totalTop - (paidH > 0 ? GAP : 0)
                const dim = hovered !== null && hovered !== i
                return (
                  <g key={d.billing_month} opacity={dim ? 0.45 : 1}>
                    {paidH > 0 && (
                      <path
                        d={hasUnpaid ? `M${x},${innerH} V${paidTop} H${x + barW} V${innerH} Z` : topRoundedRect(x, paidTop, barW, paidH, RADIUS)}
                        fill={SERIES[0].color}
                      />
                    )}
                    {hasUnpaid && unpaidH > 0 && <path d={topRoundedRect(x, totalTop, barW, unpaidH, RADIUS)} fill={SERIES[1].color} />}
                    <text x={cx} y={innerH + 18} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                      {formatBillingMonth(d.billing_month, 'MM/yy')}
                    </text>
                    {/* Hit target: the whole column, bigger than the mark */}
                    <rect
                      x={band * i}
                      y={0}
                      width={band}
                      height={innerH}
                      fill="transparent"
                      tabIndex={0}
                      aria-label={`${formatBillingMonth(d.billing_month)}: paid ${formatCurrency(d.paid_amount)}, unpaid ${formatCurrency(d.unpaid_amount)}`}
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(i)}
                      onBlur={() => setHovered(null)}
                      className="outline-none focus-visible:fill-primary/10 focus-visible:stroke-primary focus-visible:stroke-2"
                    />
                  </g>
                )
              })}
            </g>
          </svg>
        )}

        {hoveredRow && (
          <div
            className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 -translate-y-full rounded-md border bg-card p-2.5 text-xs shadow-md"
            style={{
              left: Math.min(Math.max(MARGIN.left + band * hovered + band / 2, 88), width - 88),
              top: MARGIN.top + y(hoveredRow.paid_amount + hoveredRow.unpaid_amount) - 8,
            }}
          >
            <div className="mb-1.5 font-semibold">{formatBillingMonth(hoveredRow.billing_month, 'MMMM yyyy')}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
                <span className="tabular-nums">{formatCurrency(hoveredRow[s.key])}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table view: the accessible, exact-number alternative to the chart */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Month</th>
                <th className="py-1 text-right font-medium">Paid</th>
                <th className="py-1 text-right font-medium">Unpaid</th>
                <th className="py-1 text-right font-medium">Records (paid / unpaid)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.billing_month} className="border-t">
                  <td className="py-1">{formatBillingMonth(d.billing_month)}</td>
                  <td className="py-1 text-right">{formatCurrency(d.paid_amount)}</td>
                  <td className="py-1 text-right">{formatCurrency(d.unpaid_amount)}</td>
                  <td className="py-1 text-right">
                    {d.paid_count} / {d.unpaid_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
