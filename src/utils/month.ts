export function addMonths(yyyymm: number, offset: number): number {
  const year = Math.floor(yyyymm / 100)
  const month = yyyymm % 100
  const zeroBasedMonth = year * 12 + month - 1 + offset
  const nextYear = Math.floor(zeroBasedMonth / 12)
  const nextMonth = (zeroBasedMonth % 12) + 1

  return nextYear * 100 + nextMonth
}

export function monthRange(start: number, end: number): number[] {
  const months: number[] = []

  for (let month = start; compareMonth(month, end) <= 0; month = addMonths(month, 1)) {
    months.push(month)
  }

  return months
}

export function isInRange(month: number, start: number, end: number): boolean {
  return compareMonth(month, start) >= 0 && compareMonth(month, end) <= 0
}

export function compareMonth(a: number, b: number): number {
  return a - b
}

export function formatMonth(yyyymm: number): string {
  const year = Math.floor(yyyymm / 100)
  const month = String(yyyymm % 100).padStart(2, '0')

  return `${year}-${month}`
}

export function getCurrentMonth(): number {
  const now = new Date()

  return now.getFullYear() * 100 + now.getMonth() + 1
}
