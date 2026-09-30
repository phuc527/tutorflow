const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

export function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '—'
  return vnd.format(Number(amount))
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
