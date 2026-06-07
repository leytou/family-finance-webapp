export function formatCurrency(value: number): string {
  const rounded = Math.round(value)
  return rounded.toLocaleString('en-US')
}

export function formatPercent(value: number): string {
  const pct = value * 100
  const str = pct % 1 === 0 ? pct.toString() : pct.toFixed(1)
  return `${str}%`
}
