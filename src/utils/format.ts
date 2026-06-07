export function formatCurrency(value: number): string {
  const rounded = Math.round(value)
  return rounded.toLocaleString('en-US')
}

export function formatPercent(value: number): string {
  const pct = Number((value * 100).toFixed(1))
  const str = Number.isInteger(pct) ? pct.toString() : pct.toFixed(1)
  return `${str}%`
}
