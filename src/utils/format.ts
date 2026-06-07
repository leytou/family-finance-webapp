export function formatCurrency(value: number): string {
  const rounded = Math.round(value)
  return rounded.toLocaleString('en-US')
}

